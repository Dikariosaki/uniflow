import { loadEnvFile } from "node:process";
import { randomUUID, createPrivateKey, sign } from "node:crypto";
import { execFileSync } from "node:child_process";
import pg from "pg";
import { mkdirSync, writeFileSync } from "node:fs";

loadEnvFile(new URL("./.env", import.meta.url));
if (process.env.SUPABASE_URL !== "http://127.0.0.1:54321")
  throw new Error("Acceptance tests only run against local Supabase.");
export const pool = new pg.Pool({
  host: "127.0.0.1",
  port: 54322,
  user: "postgres",
  password: "postgres",
  database: "postgres",
});
export const appOrigin = process.env.APP_PUBLIC_URL ?? "http://localhost:8088";
if (appOrigin !== "http://localhost:8088")
  throw new Error(
    "Acceptance requests must use the isolated application port. Run prepare:local.",
  );
export const base = `${appOrigin}/api/v1`;
export const password = `Acceptance-${randomUUID()}!`;
export const users = {};
export let product;
export let category;
export let mainSlot;
const displayIds = [];

export async function auth(
  path,
  data,
  token = process.env.SUPABASE_SERVICE_ROLE_KEY,
) {
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1${path}`, {
    method: data ? "POST" : "GET",
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      `Supabase Auth ${path}: ${response.status} ${JSON.stringify(body)}`,
    );
  return body;
}

export async function api(path, { method = "GET", data, token, key } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const text = await response.text();
  return {
    status: response.status,
    body:
      text && response.headers.get("content-type")?.includes("json")
        ? JSON.parse(text)
        : text,
    headers: response.headers,
  };
}

export async function initialize() {
  // This database belongs to the verification-only CLI project, never a hosted project.
  await pool.query(
    "truncate order_events, order_items, orders, pickup_slots, opening_hours, products, categories, staff_roles, admin_audit_events cascade",
  );
  for (const role of ["administrator", "operator", "outsider"]) {
    const email = `uniflow-${role}-${randomUUID()}@example.test`;
    const user = await auth("/admin/users", {
      email,
      password,
      email_confirm: true,
    });
    const session = await auth("/token?grant_type=password", {
      email,
      password,
    });
    users[role] = { id: user.id, email, token: session.access_token };
    if (role !== "outsider")
      await pool.query(
        'insert into staff_roles ("UserId", "Role", "Active", "CreatedAt") values ($1,$2,true,now())',
        [user.id, role],
      );
  }
  const admin = users.administrator.token;
  const cat = await api("/admin/categories", {
    method: "POST",
    token: admin,
    data: { name: "Comidas de verificación", displayOrder: 1 },
  });
  if (cat.status !== 201)
    throw new Error(`Admin bootstrap failed: ${JSON.stringify(cat)}`);
  category = cat.body;
  const item = await api("/admin/products", {
    method: "POST",
    token: admin,
    data: {
      categoryId: category.id,
      name: "Arepa de verificación",
      description: "Producto ficticio para aceptación",
      priceCop: 9500,
      available: true,
    },
  });
  if (item.status !== 201)
    throw new Error(`Product setup failed: ${JSON.stringify(item)}`);
  product = item.body;
  displayIds.push(product.id);
  for (const [name, priceCop, available] of [
    ["Sándwich de pollo", 12000, true],
    ["Café campesino", 4500, true],
    ["Jugo natural", 6500, false],
    ["Ensalada del campus", 14000, true],
    ["Brownie de chocolate", 6000, true],
  ]) {
    const created = await api("/admin/products", {
      method: "POST",
      token: admin,
      data: {
        categoryId: category.id,
        name,
        description: "Preparado al momento · Ejemplo de verificación",
        priceCop,
        available,
      },
    });
    if (created.status !== 201)
      throw new Error("Display fixture could not be created.");
    displayIds.push(created.body.id);
  }
  mkdirSync(new URL("./artifacts/", import.meta.url), { recursive: true });
  writeFileSync(
    new URL("./artifacts/local-access.json", import.meta.url),
    JSON.stringify(
      {
        url: `${appOrigin}/personal`,
        email: users.administrator.email,
        password,
      },
      null,
      2,
    ),
  );
}

export async function reset() {
  await pool.query(
    "truncate order_events, order_items, orders, pickup_slots, opening_hours cascade",
  );
  await pool.query("delete from business_settings");
  await pool.query(
    'insert into business_settings ("Id", "Name", "TimeZone", "OrdersPaused", "MinimumNoticeMinutes") values (1, $1, $2, false, 0)',
    ["Cafetería de verificación", "America/Bogota"],
  );
  for (let weekday = 0; weekday < 7; weekday++) {
    await pool.query(
      'insert into opening_hours ("Id", "Weekday", "OpensAt", "ClosesAt", "Closed") values ($1,$2,$3,$4,false)',
      [randomUUID(), weekday, "00:00", "23:59:59"],
    );
  }
  await pool.query('update categories set "Active" = true where "Id" = $1', [
    category.id,
  ]);
  await pool.query('update categories set "Active" = false where "Id" != $1', [
    category.id,
  ]);
  await pool.query('update products set "Active"=("Id"=any($1::uuid[]))', [
    displayIds,
  ]);
  await pool.query(
    'update products set "Available"=true, "Active"=true, "PriceCop"=9500, "Name"=$2 where "Id"=$1',
    [product.id, "Arepa de verificación"],
  );
  mainSlot = await slot(15, 30, 100);
}

export async function slot(startMinutes, endMinutes, capacity) {
  const id = randomUUID();
  const startsAt = new Date(Date.now() + startMinutes * 60000).toISOString();
  const endsAt = new Date(Date.now() + endMinutes * 60000).toISOString();
  await pool.query(
    'insert into pickup_slots ("Id","StartsAt","EndsAt","Capacity","Active") values ($1,$2,$3,$4,true)',
    [id, startsAt, endsAt, capacity],
  );
  return { id, startsAt, endsAt, capacity };
}

export const orderBody = (overrides = {}) => ({
  alias: "Estudiante de prueba",
  phone: "3001234567",
  pickupMode: "scheduled",
  slotId: mainSlot.id,
  items: [{ productId: product.id, quantity: 2, expectedPriceCop: 9500 }],
  ...overrides,
});
export const createOrder = (overrides = {}, key = randomUUID()) =>
  api("/orders", { method: "POST", key, data: orderBody(overrides) });
export const trackOrder = (token) =>
  api("/orders/track", { method: "POST", data: { token } });
export const setStatus = (id, status, reason, token = users.operator.token) =>
  api(`/staff/orders/${id}/status`, {
    method: "PATCH",
    token,
    data: { status, reason },
  });

// Read only the disposable Auth container's key, so negative claim tests retain a valid signature.
export function signLocalClaims(claims) {
  const container = JSON.parse(
    execFileSync("docker", ["inspect", "supabase_auth_verification"], {
      encoding: "utf8",
    }),
  )[0];
  const jwk = JSON.parse(
    container.Config.Env.find((v) => v.startsWith("GOTRUE_JWT_KEYS=")).slice(
      "GOTRUE_JWT_KEYS=".length,
    ),
  )[0];
  const head = Buffer.from(
    JSON.stringify({ alg: jwk.alg, typ: "JWT", kid: jwk.kid }),
  ).toString("base64url");
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = sign("sha256", Buffer.from(`${head}.${body}`), {
    key: createPrivateKey({ key: jwk, format: "jwk" }),
    dsaEncoding: "ieee-p1363",
  });
  return `${head}.${body}.${signature.toString("base64url")}`;
}
