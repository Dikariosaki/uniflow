import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import {
  pool,
  appOrigin,
  api,
  initialize,
  reset,
  users,
  password,
  category,
  product,
  mainSlot,
  slot,
  orderBody,
  createOrder,
  trackOrder,
  setStatus,
  signLocalClaims,
} from "../fixtures.mjs";

test.beforeAll(initialize);
test.beforeEach(reset);
test.afterAll(async () => pool.end());

test("Swagger documents request bodies, JWT protection and order idempotency through Docker proxy", async ({ page }) => {
  const response = await fetch(`${appOrigin}/swagger/v1/swagger.json`);
  expect(response.status).toBe(200);
  const document = await response.json();
  expect(document.info.title).toBe("UniFlow API");
  expect(Object.keys(document.paths).length).toBeGreaterThan(20);
  expect(document.paths["/api/v1/orders"].post.requestBody.required).toBe(true);
  expect(document.paths["/api/v1/orders"].post.parameters).toContainEqual(
    expect.objectContaining({ name: "Idempotency-Key", in: "header", required: true }),
  );
  expect(document.paths["/api/v1/orders"].post.security ?? []).toEqual([]);
  expect(document.paths["/api/v1/staff/me"].get.security).toEqual([{ Bearer: [] }]);
  expect(document.components.securitySchemes.Bearer.scheme).toBe("bearer");
  await page.goto("/swagger/");
  await expect(page.getByRole("heading", { name: /UniFlow API/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Authorize/ }).first()).toBeVisible();
});

test("checkout shows server rejection details, keeps cart on 503 and can confirm after recovery", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: `Agregar ${product.name}`, exact: true }).click();
  await page.getByRole("button", { name: /Mi pedido ·/ }).click();
  await page.getByRole("button", { name: "Elegir recogida" }).click();
  await page.getByLabel(/alias/i).fill("Reintento después del error");
  await page.getByLabel(/Teléfono/).fill("3005550177");
  const confirm = page.getByRole("button", { name: /Confirmar pedido/ });
  await expect(confirm).toBeEnabled();
  await pool.query('update business_settings set "OrdersPaused"=true');
  await confirm.click();
  await expect(page.getByText("La cafetería pausó temporalmente los pedidos.", { exact: true })).toBeVisible();
  expect(Number((await pool.query('select count(*) from orders')).rows[0].count)).toBe(0);
  await pool.query('update business_settings set "OrdersPaused"=false');
  await page.route("**/api/v1/orders", route => route.fulfill({
    status: 503, contentType: "application/problem+json",
    body: JSON.stringify({ title: "Servicio temporalmente no disponible", detail: "No pudimos conectar con la base de datos. Intenta nuevamente en unos momentos; conserva tu carrito." }),
  }));
  await confirm.click();
  await expect(page.getByText("No pudimos conectar con la base de datos. Intenta nuevamente en unos momentos; conserva tu carrito.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Confirma y recoge" })).toBeVisible();
  await expect(confirm).toBeEnabled();
  await page.unroute("**/api/v1/orders");
  await confirm.click();
  await expect(page).toHaveURL(/seguimiento#/);
  await expect(page.getByRole("heading", { name: "Confirmado", exact: true })).toBeVisible();
  expect(Number((await pool.query('select count(*) from orders')).rows[0].count)).toBe(1);
});

test("order snapshots, COP totals, private receipt, UTC dates and audit persist", async () => {
  const result = await createOrder();
  expect(result.status).toBe(201);
  expect(result.body.totalCop).toBe(19000);
  expect(result.body.token).not.toBe(result.body.code);
  const tracked = await trackOrder(result.body.token);
  expect(tracked.status).toBe(200);
  expect(tracked.body.items[0]).toMatchObject({
    nameSnapshot: product.name,
    quantity: 2,
    unitPriceCop: 9500,
    subtotalCop: 19000,
  });
  expect(tracked.body).not.toHaveProperty("customerPhone");
  expect(tracked.body).not.toHaveProperty("trackingTokenHash");
  await pool.query(
    'update products set "Name"=$2,"PriceCop"=10000 where "Id"=$1',
    [product.id, "Nombre nuevo"],
  );
  const persisted = await pool.query(
    'select "NameSnapshot", "UnitPriceCop" from order_items where "OrderId"=$1',
    [result.body.orderId],
  );
  expect(persisted.rows[0]).toEqual({
    NameSnapshot: product.name,
    UnitPriceCop: 9500,
  });
  const events = await pool.query(
    'select "NewStatus","ActorId" from order_events where "OrderId"=$1',
    [result.body.orderId],
  );
  expect(events.rows).toEqual([
    { NewStatus: "CONFIRMADO", ActorId: "customer" },
  ]);
});

test("sold out, inactive category and changed price reject stale carts", async () => {
  await pool.query('update products set "Available"=false where "Id"=$1', [
    product.id,
  ]);
  expect((await createOrder()).status).toBe(409);
  await pool.query(
    'update products set "Available"=true,"PriceCop"=10000 where "Id"=$1',
    [product.id],
  );
  const changed = await createOrder();
  expect(changed.status).toBe(409);
  expect(changed.body).toMatchObject({
    priceChanged: true,
    currentPrices: [{ productId: product.id, currentPriceCop: 10000 }],
  });
  await pool.query('update categories set "Active"=false where "Id"=$1', [
    category.id,
  ]);
  expect((await createOrder()).status).toBe(409);
  expect(
    Number((await pool.query("select count(*) from orders")).rows[0].count),
  ).toBe(0);
});

test("last capacity is atomic under simultaneous requests and ASAP chooses next viable slot", async () => {
  await pool.query('update pickup_slots set "Capacity"=1 where "Id"=$1', [
    mainSlot.id,
  ]);
  const responses = await Promise.all(
    Array.from({ length: 8 }, () => createOrder()),
  );
  expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
  expect(responses.filter((r) => r.status === 409)).toHaveLength(7);
  const next = await slot(35, 50, 2);
  const asap = await createOrder({ pickupMode: "ready", slotId: null });
  expect(asap.status).toBe(201);
  expect(new Date(asap.body.slot).getTime()).toBe(
    new Date(next.startsAt).getTime(),
  );
  expect(
    Number(
      (
        await pool.query('select count(*) from orders where "SlotId"=$1', [
          mainSlot.id,
        ])
      ).rows[0].count,
    ),
  ).toBe(1);
});

test("concurrent and repeated idempotency keys return one order, mismatched payload conflicts", async () => {
  await pool.query('update pickup_slots set "Capacity"=1 where "Id"=$1', [
    mainSlot.id,
  ]);
  const key = randomUUID();
  const responses = await Promise.all(
    Array.from({ length: 6 }, () => createOrder({}, key)),
  );
  expect(responses.map((r) => r.status).sort()).toEqual([
    200, 200, 200, 200, 200, 201,
  ]);
  expect(new Set(responses.map((r) => r.body.orderId)).size).toBe(1);
  const retry = await createOrder({}, key);
  expect(retry.status).toBe(200);
  expect((await trackOrder(retry.body.token)).status).toBe(200);
  expect((await createOrder({ alias: "Otro estudiante" }, key)).status).toBe(
    409,
  );
  expect(
    Number((await pool.query("select count(*) from orders")).rows[0].count),
  ).toBe(1);
});

test("closed, paused, minimum notice, missing scheduled slot and dated exceptions are enforced", async () => {
  await pool.query('update business_settings set "OrdersPaused"=true');
  expect((await createOrder()).status).toBe(422);
  await pool.query(
    'update business_settings set "OrdersPaused"=false,"MinimumNoticeMinutes"=60',
  );
  expect((await createOrder()).status).toBe(409);
  await pool.query('update business_settings set "MinimumNoticeMinutes"=0');
  expect((await createOrder({ slotId: null })).status).toBe(422);
  await pool.query('update opening_hours set "Closed"=true');
  expect((await createOrder()).status).toBe(422);
  await pool.query('update opening_hours set "Closed"=false');
  await pool.query(
    'insert into opening_hours ("Id","Date","OpensAt","ClosesAt","Closed") values ($1,(now() at time zone $2)::date,$3,$4,true)',
    [randomUUID(), "America/Bogota", "00:00", "23:59"],
  );
  expect((await createOrder()).status).toBe(422);
});

test("privacy, JWT signature/issuer/audience/expiry and staff roles protect all surfaces", async () => {
  const order = (await createOrder()).body;
  expect((await trackOrder("incorrect-token")).status).toBe(404);
  expect((await trackOrder(order.code)).status).toBe(404);
  expect((await api(`/orders/${order.orderId}`)).status).toBe(404);
  expect((await api("/staff/orders")).status).toBe(401);
  expect(
    (await api("/staff/me", { token: users.operator.token })).body.role,
  ).toBe("operator");
  expect(
    (await api("/staff/orders", { token: users.outsider.token })).status,
  ).toBe(403);
  expect(
    (await api("/admin/products", { token: users.operator.token })).status,
  ).toBe(403);
  const parts = users.operator.token.split(".");
  const body = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  const tampered = `${parts[0]}.${Buffer.from(JSON.stringify({ ...body, sub: users.administrator.id })).toString("base64url")}.${parts[2]}`;
  expect((await api("/staff/me", { token: tampered })).status).toBe(401);
  expect(
    (await api("/staff/me", { token: signLocalClaims(body) })).status,
  ).toBe(200);
  for (const altered of [
    { ...body, iss: "https://invalid.example" },
    { ...body, aud: "other" },
    { ...body, exp: 1 },
  ]) {
    const token = signLocalClaims(altered);
    expect((await api("/staff/me", { token })).status).toBe(401);
  }
  const tables = await pool.query(
    "select tablename, rowsecurity from pg_tables where schemaname='public' and tablename != '__EFMigrationsHistory'",
  );
  expect(tables.rows.length).toBeGreaterThanOrEqual(10);
  expect(tables.rows.every((t) => t.rowsecurity)).toBe(true);
  const direct = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/orders?select=*`,
    { headers: { apikey: process.env.SUPABASE_ANON_KEY } },
  );
  expect(direct.status === 200 ? await direct.json() : []).toEqual([]);
});

test("status transition locking, code verification, delivery actor/time and cancellation capacity", async () => {
  const order = (await createOrder()).body;
  expect((await setStatus(order.orderId, "LISTO")).status).toBe(409);
  const concurrent = await Promise.all([
    setStatus(order.orderId, "EN_PREPARACION"),
    setStatus(order.orderId, "EN_PREPARACION"),
  ]);
  expect(concurrent.map((r) => r.status).sort()).toEqual([200, 409]);
  expect((await setStatus(order.orderId, "LISTO")).status).toBe(200);
  expect(
    (
      await api(`/staff/orders/${order.orderId}/deliver`, {
        method: "POST",
        token: users.operator.token,
        data: { code: "invalid" },
      })
    ).status,
  ).toBe(422);
  expect(
    (
      await api(`/staff/orders/${order.orderId}/deliver`, {
        method: "POST",
        token: users.operator.token,
        data: { code: order.code },
      })
    ).status,
  ).toBe(200);
  const detail = (
    await api(`/staff/orders/${order.orderId}`, { token: users.operator.token })
  ).body;
  expect(detail.events.map((e) => e.newStatus)).toEqual([
    "CONFIRMADO",
    "EN_PREPARACION",
    "LISTO",
    "ENTREGADO",
  ]);
  expect(detail.events.at(-1).actorId).toBe(users.operator.id);
  expect(detail.deliveredAt).toBeTruthy();
  expect(
    (await setStatus(order.orderId, "CANCELADO", "No recogido")).status,
  ).toBe(409);
  const cancel = (await createOrder()).body;
  expect((await setStatus(cancel.orderId, "CANCELADO")).status).toBe(422);
  expect(
    (await setStatus(cancel.orderId, "CANCELADO", "Solicitud en mostrador"))
      .status,
  ).toBe(200);
  expect(
    (
      await pool.query('select "ConsumesCapacity" from orders where "Id"=$1', [
        cancel.orderId,
      ])
    ).rows[0].ConsumesCapacity,
  ).toBe(false);
  const noShow = (await createOrder()).body;
  await setStatus(noShow.orderId, "EN_PREPARACION");
  await setStatus(noShow.orderId, "LISTO");
  expect(
    (await setStatus(noShow.orderId, "CANCELADO", "No recogido; cierre manual"))
      .status,
  ).toBe(200);
  expect(
    (
      await pool.query('select "ConsumesCapacity" from orders where "Id"=$1', [
        noShow.orderId,
      ])
    ).rows[0].ConsumesCapacity,
  ).toBe(true);
});

test("protected real Storage upload, public product image, MIME and size limits", async () => {
  const path = `/admin/products/${product.id}/image-upload`;
  const data = { contentType: "image/png", sizeBytes: 68 };
  expect((await api(path, { method: "POST", data })).status).toBe(401);
  expect(
    (await api(path, { method: "POST", token: users.operator.token, data }))
      .status,
  ).toBe(403);
  expect(
    (
      await api(path, {
        method: "POST",
        token: users.administrator.token,
        data: { ...data, contentType: "text/html" },
      })
    ).status,
  ).toBe(422);
  expect(
    (
      await api(path, {
        method: "POST",
        token: users.administrator.token,
        data: { ...data, sizeBytes: 5000001 },
      })
    ).status,
  ).toBe(422);
  const signed = await api(path, {
    method: "POST",
    token: users.administrator.token,
    data,
  });
  expect(signed.status).toBe(200);
  const signedPath = signed.body.upload.url ?? signed.body.upload.signedURL;
  const url = signedPath.startsWith("http")
    ? signedPath
    : `${process.env.SUPABASE_URL}/storage/v1${signedPath}`;
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6D1sAAAAASUVORK5CYII=",
    "base64",
  );
  expect(
    (
      await api(`/admin/products/${product.id}/image`, {
        method: "POST",
        token: users.administrator.token,
        data: { path: signed.body.path },
      })
    ).status,
  ).toBe(422);
  const uploaded = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: png,
  });
  expect(uploaded.status).toBe(200);
  expect(
    (
      await api(`/admin/products/${product.id}/image`, {
        method: "POST",
        token: users.administrator.token,
        data: { path: signed.body.path },
      })
    ).status,
  ).toBe(200);
  expect((await fetch(signed.body.publicUrl)).status).toBe(200);
  const menu = await api("/catalog/products");
  expect(menu.body.find((p) => p.id === product.id).imageUrl).toBe(
    signed.body.publicUrl,
  );
  const bucket = await fetch(
    `${process.env.SUPABASE_URL}/storage/v1/bucket/product-images`,
    {
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: process.env.SUPABASE_ANON_KEY,
      },
    },
  ).then((r) => r.json());
  expect(bucket.public).toBe(true);
  expect(bucket.file_size_limit).toBe(5000000);
});

test("administration, schedule validation, overlapping capacity, reporting, pagination and audit", async () => {
  const token = users.administrator.token;
  const overlap = await api("/admin/pickup-slots", {
    method: "POST",
    token,
    data: { startsAt: mainSlot.startsAt, endsAt: mainSlot.endsAt, capacity: 5 },
  });
  expect(overlap.status).toBe(409);
  const schedule = {
    hours: [
      {
        weekday: 1,
        date: null,
        opensAt: "07:00",
        closesAt: "18:00",
        closed: false,
      },
      {
        weekday: 1,
        date: null,
        opensAt: "08:00",
        closesAt: "17:00",
        closed: false,
      },
    ],
  };
  expect(
    (await api("/admin/schedule", { method: "PUT", token, data: schedule }))
      .status,
  ).toBe(422);
  const order = (await createOrder()).body;
  expect(
    (
      await api(`/admin/pickup-slots/${mainSlot.id}`, {
        method: "PUT",
        token,
        data: {
          startsAt: mainSlot.startsAt,
          endsAt: mainSlot.endsAt,
          capacity: 0,
        },
      })
    ).status,
  ).toBe(409);
  const list = await api("/staff/orders?page=1&pageSize=1", {
    token: users.operator.token,
  });
  expect(list.body).toHaveLength(1);
  expect(list.headers.get("x-total-count")).toBe("1");
  expect(
    (
      await api("/staff/orders?page=2&pageSize=1", {
        token: users.operator.token,
      })
    ).body,
  ).toEqual([]);
  expect((await api("/admin/reports/daily", { token })).body.created).toBe(1);
  expect((await api("/admin/reports/orders.csv", { token })).body).toContain(
    order.orderId,
  );
  expect(
    (await api("/admin/reports/orders.csv", { token: users.operator.token }))
      .status,
  ).toBe(403);
  await pool.query("delete from business_settings");
  const initialSettings = await api("/admin/settings", {
    method: "PUT",
    token,
    data: {
      name: "Cafetería de verificación",
      ordersPaused: false,
      minimumNoticeMinutes: 0,
    },
  });
  expect(initialSettings.status).toBe(200);
  expect(
    (await api("/admin/audit", { token })).body.some(
      (e) => e.action === "business_settings.updated",
    ),
  ).toBe(true);
});

async function login(page, role = "administrator") {
  await page.goto("/personal");
  await page.getByLabel("Correo electrónico").fill(users[role].email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(
    page.getByRole("heading", { name: "Pedidos en vivo" }),
  ).toBeVisible();
}

test("administrator UI persists catalog, availability, photo, schedule and Bogotá pickup slots", async ({
  browser,
}) => {
  const context = await browser.newContext({ timezoneId: "UTC" });
  const page = await context.newPage();
  await login(page);
  await page.goto("/personal/inventory");
  const name = `Producto UI ${randomUUID().slice(0, 8)}`;
  await page.getByLabel("Nombre", { exact: true }).fill(name);
  await page
    .getByLabel("Descripción", { exact: true })
    .fill("Creado desde el panel de administración");
  await page.getByLabel("Precio en COP").fill("7500");
  await page
    .getByRole("button", { name: "Guardar producto", exact: true })
    .click();
  const card = page.locator(".admin-product").filter({ hasText: name });
  await expect(card).toBeVisible();
  const created = (
    await pool.query('select "Id", "PriceCop" from products where "Name"=$1', [
      name,
    ])
  ).rows[0];
  expect(created.PriceCop).toBe(7500);
  await card.getByLabel("Disponible", { exact: true }).uncheck();
  await expect
    .poll(
      async () =>
        (
          await pool.query('select "Available" from products where "Id"=$1', [
            created.Id,
          ])
        ).rows[0].Available,
    )
    .toBe(false);
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6D1sAAAAASUVORK5CYII=",
    "base64",
  );
  await card.locator("input[type=file]").setInputFiles({
    name: "producto.png",
    mimeType: "image/png",
    buffer: image,
  });
  await expect(card.getByRole("img")).toBeVisible();
  expect(
    (
      await pool.query('select "ImagePath" from products where "Id"=$1', [
        created.Id,
      ])
    ).rows[0].ImagePath,
  ).toMatch(/\.png$/);
  await page.goto("/personal/reports");
  await page.getByLabel("Pausar nuevos pedidos").check();
  await page
    .getByRole("button", { name: "Guardar configuración", exact: true })
    .click();
  await expect
    .poll(async () => (await api("/status")).body.ordersPaused)
    .toBe(true);
  await page.getByLabel("Pausar nuevos pedidos").uncheck();
  await page
    .getByRole("button", { name: "Guardar configuración", exact: true })
    .click();
  const start = new Date(Date.now() + 65 * 60000);
  start.setUTCSeconds(0, 0);
  const end = new Date(start.getTime() + 15 * 60000);
  const local = (date) =>
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .format(date)
      .replace(" ", "T");
  await page
    .getByLabel("Inicio (hora de Bogotá)", { exact: true })
    .fill(local(start));
  await page
    .getByLabel("Fin (hora de Bogotá)", { exact: true })
    .fill(local(end));
  await page.getByLabel("Capacidad (pedidos)", { exact: true }).fill("7");
  await page.getByRole("button", { name: "Crear franja", exact: true }).click();
  await expect
    .poll(async () =>
      Number(
        (
          await pool.query(
            'select count(*) from pickup_slots where "StartsAt"=$1 and "Capacity"=7',
            [start],
          )
        ).rows[0].count,
      ),
    )
    .toBe(1);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await page.getByLabel("Fecha", { exact: true }).fill(tomorrow);
  await page.getByLabel("Cerrado este día").check();
  await page
    .getByRole("button", { name: "Guardar excepción", exact: true })
    .click();
  await expect
    .poll(async () =>
      Number(
        (
          await pool.query(
            'select count(*) from opening_hours where "Date"=$1 and "Closed"',
            [tomorrow],
          )
        ).rows[0].count,
      ),
    )
    .toBe(1);
  await context.close();
});

test("staff invitation uses real local Auth and role changes revoke operation access", async () => {
  const token = users.administrator.token;
  const email = `invited-${randomUUID()}@example.test`;
  const data = { email, role: "operator" };
  expect(
    (
      await api("/admin/staff/invitations", {
        method: "POST",
        token: users.operator.token,
        data,
      })
    ).status,
  ).toBe(403);
  expect(
    (await api("/admin/staff/invitations", { method: "POST", token, data }))
      .status,
  ).toBe(202);
  const invite = await pool.query(
    'select s."Role" from staff_roles s join auth.users u on s."UserId"=u.id::text where u.email=$1',
    [email],
  );
  expect(invite.rows).toEqual([{ Role: "operator" }]);
  expect(
    (
      await api(`/admin/staff/${users.operator.id}/role`, {
        method: "PUT",
        token,
        data: { role: "operator", active: false },
      })
    ).status,
  ).toBe(200);
  expect(
    (await api("/staff/orders", { token: users.operator.token })).status,
  ).toBe(403);
  expect(
    (
      await api(`/admin/staff/${users.operator.id}/role`, {
        method: "PUT",
        token,
        data: { role: "operator", active: true },
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await api(`/admin/staff/${users.administrator.id}/role`, {
        method: "PUT",
        token,
        data: { role: "operator", active: false },
      })
    ).status,
  ).toBe(409);
});

test("real browser menu → cart → pickup → receipt, SignalR update and polling fallback", async ({
  browser,
}) => {
  const customer = await browser.newContext();
  const page = await customer.newPage();
  const staffContext = await browser.newContext();
  const operatorPage = await staffContext.newPage();
  await login(operatorPage, "operator");
  await page.goto("/");
  await page
    .getByRole("button", { name: "Agregar Arepa de verificación", exact: true })
    .click();
  await page.getByRole("button", { name: /Mi pedido ·/ }).click();
  await page.getByRole("button", { name: "Elegir recogida" }).click();
  await page.getByLabel(/alias/i).fill("Pedido desde navegador");
  await page.getByRole("button", { name: /Elegir horario/ }).click();
  await page.locator(".slot-list button:not(:disabled)").first().click();
  await page.getByLabel(/Teléfono/).fill("3005550123");
  await page.getByRole("button", { name: /Confirmar pedido/ }).click();
  await expect(page).toHaveURL(/seguimiento#/);
  await expect(
    page.getByRole("heading", { name: "Confirmado", exact: true }),
  ).toBeVisible();
  const row = (
    await pool.query('select "Id" from orders where "CustomerAlias"=$1', [
      "Pedido desde navegador",
    ])
  ).rows[0];
  await expect(
    operatorPage
      .locator(".order-card")
      .filter({ hasText: "Pedido desde navegador" }),
  ).toBeVisible({ timeout: 5000 });
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      scan.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await page.screenshot({
      path: `artifacts/tracking-${width}.png`,
      fullPage: true,
    });
  }
  await expect
    .poll(async () =>
      page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .some((r) => r.name.includes("/hubs/orders")),
      ),
    )
    .toBe(true);
  await setStatus(row.Id, "EN_PREPARACION");
  await expect(
    page.getByRole("heading", { name: "En preparación", exact: true }),
  ).toBeVisible({ timeout: 5000 });
  await page.route("**/hubs/**", (route) => route.abort());
  await operatorPage.route("**/hubs/**", (route) => route.abort());
  await operatorPage.reload();
  await expect(operatorPage.locator(".order-card .status-chip")).toContainText(
    "En preparación",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "En preparación", exact: true }),
  ).toBeVisible();
  const changedAt = Date.now();
  await setStatus(row.Id, "LISTO");
  await expect(
    page.getByRole("heading", { name: "Listo para recoger" }),
  ).toBeVisible({ timeout: 18000 });
  expect(Date.now() - changedAt).toBeGreaterThan(5000);
  await expect(operatorPage.locator(".order-card .status-chip")).toContainText(
    "Listo para recoger",
    { timeout: 35000 },
  );
  await page.screenshot({
    path: "artifacts/tracking-desktop.png",
    fullPage: true,
  });
  await customer.close();
  await staffContext.close();
});

test("offline PWA shell blocks confirmation and refreshes catalog and slots on reconnect", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Agregar Arepa de verificación", exact: true })
    .click();
  await page.getByRole("button", { name: /Mi pedido ·/ }).click();
  await page.getByRole("button", { name: "Elegir recogida" }).click();
  await page.getByLabel(/alias/i).fill("Sin conexión");
  await page.getByLabel(/Teléfono/).fill("3005550123");
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cdp = await context.newCDPSession(page);
  expect(
    (await cdp.send("Page.getInstallabilityErrors")).installabilityErrors,
  ).toEqual([]);
  await context.setOffline(true);
  await expect(
    page.getByRole("button", { name: /Confirmar pedido/ }),
  ).toBeDisabled();
  await expect(
    page.getByText("Estás sin conexión.", { exact: false }),
  ).toBeVisible();
  expect(
    Number((await pool.query("select count(*) from orders")).rows[0].count),
  ).toBe(0);
  await pool.query('update products set "PriceCop"=12000 where "Id"=$1', [
    product.id,
  ]);
  await page.route("**/api/v1/catalog/products", (route) => route.abort());
  await context.setOffline(false);
  await expect(
    page.getByRole("button", { name: /Confirmar pedido/ }),
  ).toBeDisabled();
  await expect(page.getByRole("status")).toBeVisible();
  await page.unroute("**/api/v1/catalog/products");
  await context.setOffline(true);
  const reloads = [];
  page.on("request", (r) => {
    if (/catalog\/products|pickup-slots/.test(r.url())) reloads.push(r.url());
  });
  await context.setOffline(false);
  await expect.poll(() => reloads.length).toBeGreaterThanOrEqual(2);
  await expect(
    page.getByRole("button", { name: /Confirmar pedido/ }),
  ).toContainText("12.000");
  await context.setOffline(true);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Tu pausa favorita/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Estás sin conexión.", { exact: false }),
  ).toBeVisible();
  await context.close();
});

test("responsive student and staff screens, keyboard focus, modal and WCAG 2.2 AA states", async ({
  browser,
}) => {
  await createOrder();
  const context = await browser.newContext();
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on("pageerror", (e) => runtimeErrors.push(e.message));
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Tu pausa favorita/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Agregar Arepa de verificación",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      scan.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await page.screenshot({
      path: `artifacts/menu-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", {
        name: "Agregar Arepa de verificación",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: /Mi pedido/ }).click();
    for (const screen of ["cart", "checkout"]) {
      if (screen === "checkout")
        await page.getByRole("button", { name: "Elegir recogida" }).click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        audit.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
      await page.screenshot({
        path: `artifacts/${screen}-${width}.png`,
        fullPage: true,
      });
    }
  }
  await login(page);
  await page.goto("/personal/history");
  await page.getByRole("button", { name: "Bitácora" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cerrar detalle", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Cerrar detalle", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Bitácora" }).first(),
  ).toBeFocused();
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/personal",
      "/personal/history",
      "/personal/inventory",
      "/personal/reports",
    ]) {
      await page.goto(route);
      await expect(page.locator(".staff-main").first()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const scan = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        scan.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
      await page.screenshot({
        path: `artifacts/${route.split("/").at(-1)}-${width}.png`,
        fullPage: true,
      });
    }
  }
  expect(runtimeErrors).toEqual([]);
  await page
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bienvenido de nuevo" }),
  ).toBeVisible();
  expect(await page.locator(".staff-sidebar").count()).toBe(0);
  await context.close();
});

test("SignalR groups isolate customer orders and reject broadcasts to unknown staff", async () => {
  const { HubConnectionBuilder, HttpTransportType, LogLevel } =
    await import("@microsoft/signalr");
  const first = (await createOrder()).body;
  const second = (await createOrder()).body;
  const received = [[], [], [], []];
  const connections = [
    { headers: { "X-Tracking-Token": first.token } },
    { headers: { "X-Tracking-Token": second.token } },
    { accessTokenFactory: () => users.outsider.token },
    { accessTokenFactory: () => users.operator.token },
  ].map((options, i) => {
    const connection = new HubConnectionBuilder()
      .withUrl(`${appOrigin}/hubs/orders`, {
        transport: HttpTransportType.LongPolling,
        ...options,
      })
      .configureLogging(LogLevel.None)
      .build();
    connection.on("orderChanged", (update) => received[i].push(update));
    return connection;
  });
  try {
    await Promise.all(connections.map((c) => c.start()));
    await setStatus(first.orderId, "EN_PREPARACION");
    await expect.poll(() => received[0].length).toBe(1);
    await expect.poll(() => received[3].length).toBe(1);
    expect(received[0]).toEqual([
      { orderId: first.orderId, status: "EN_PREPARACION" },
    ]);
    expect(received[1]).toEqual([]);
    expect(received[2]).toEqual([]);
  } finally {
    await Promise.allSettled(connections.map((c) => c.stop()));
  }
});

async function holdResponse(page, pattern) {
  let captured = false;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route(pattern, async (route) => {
    const response = await route.fetch();
    captured = true;
    await gate;
    await route.fulfill({ response }).catch(() => undefined);
  });
  return {
    get captured() {
      return captured;
    },
    release: () => release(),
  };
}

test("leaving the operator queue cancels pending connection startup", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const gate = await holdResponse(
    page,
    "**/api/v1/staff/orders?activeOnly=true*",
  );
  try {
    await login(page);
    await expect.poll(() => gate.captured).toBe(true);
    await page.getByRole("button", { name: /Inventario y menú/ }).click();
    await expect(
      page.getByRole("heading", { name: "Inventario y menú" }),
    ).toBeVisible();
    const staleConnection = page
      .waitForRequest((request) => request.url().includes("/hubs/orders"), {
        timeout: 2000,
      })
      .then(
        () => true,
        () => false,
      );
    gate.release();
    expect(await staleConnection).toBe(false);
    await expect(
      page.getByRole("heading", { name: "Inventario y menú" }),
    ).toBeVisible();
  } finally {
    gate.release();
    await context.close();
  }
});

test("leaving tracking cancels pending connection startup", async ({
  browser,
}) => {
  const order = (await createOrder()).body;
  const context = await browser.newContext();
  const page = await context.newPage();
  const gate = await holdResponse(page, "**/api/v1/orders/track");
  try {
    await page.goto(`/seguimiento#${order.token}`);
    await expect.poll(() => gate.captured).toBe(true);
    await page.locator(".topbar .brand").click();
    await expect(
      page.getByRole("heading", { name: /Tu pausa favorita/ }),
    ).toBeVisible();
    const staleConnection = page
      .waitForRequest((request) => request.url().includes("/hubs/orders"), {
        timeout: 2000,
      })
      .then(
        () => true,
        () => false,
      );
    gate.release();
    expect(await staleConnection).toBe(false);
    await expect(page.locator(".track-view")).not.toBeVisible();
  } finally {
    gate.release();
    await context.close();
  }
});

test("public rate limit rejects excess traffic and cannot be bypassed through forwarded headers", async () => {
  let limited = false;
  for (let i = 0; i < 42 && !limited; i++) {
    const responses = await Promise.all(
      Array.from({ length: 50 }, () => trackOrder("")),
    );
    expect(responses.every((r) => r.status === 404 || r.status === 429)).toBe(
      true,
    );
    limited = responses.some((r) => r.status === 429);
  }
  expect(limited).toBe(true);
  expect((await createOrder()).status).toBe(429);
  const spoofed = await fetch(`${appOrigin}/api/v1/orders/track`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "198.51.100.99",
    },
    body: JSON.stringify({ token: "" }),
  });
  expect(spoofed.status).toBe(429);
});
