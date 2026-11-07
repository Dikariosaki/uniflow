// Requires the existing isolated local Supabase stack. Never reads the root .env.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';

const root = new URL('../', import.meta.url);
const config = Object.fromEntries(readFileSync(new URL('.env', import.meta.url), 'utf8')
  .split(/\r?\n/).filter(line => /^[A-Z_]+=/.test(line)).map(line => {
    const split = line.indexOf('=');
    return [line.slice(0, split), line.slice(split + 1)];
  }));
assert.equal(config.SUPABASE_URL, 'http://127.0.0.1:54321', 'Only the isolated local Supabase is allowed.');
assert.ok(config.SUPABASE_SERVICE_ROLE_KEY);

const scripts = ['01_setup.sql', '02_first_admin.sql', '03_verify.sql'];
const [setup, bootstrap, verify] = scripts.map(name => readFileSync(new URL(`supabase/${name}`, root), 'utf8'));
const schema = setup.slice(0, setup.indexOf('-- STORAGE:')) + '\nCOMMIT;';
const body = sql => sql.replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, '');
const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
const database = `uniflow_sql_check_${suffix}`;
const bucket = `uniflow-sql-check-${suffix}`;
const storage = setup.slice(setup.indexOf('DO $storage$'), setup.indexOf('END $storage$;') + 'END $storage$;'.length)
  .replaceAll('uniflow-images', bucket);
const connection = { host: '127.0.0.1', port: 54322, user: 'postgres', password: 'postgres' };
const control = new pg.Client({ ...connection, database: 'postgres' });
const fresh = new pg.Client({ ...connection, database });
const evidence = [];
let databaseCreated = false, freshConnected = false, userId, bucketCreated = false;
const headers = { apikey: config.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
async function api(path, options = {}) {
  return fetch(`${config.SUPABASE_URL}${path}`, { ...options, headers: { ...headers, ...options.headers } });
}
function check(message) { evidence.push(message); console.log(`PASS ${message}`); }
async function expectSqlError(client, sql, pattern) {
  await client.query('SAVEPOINT expected_failure');
  await assert.rejects(client.query(sql), pattern);
  await client.query('ROLLBACK TO SAVEPOINT expected_failure');
}

try {
  await control.connect();
  // Only the database created by this script can be removed during cleanup.
  assert.match(database, /^uniflow_sql_check_[a-f0-9]{12}$/);
  await control.query(`CREATE DATABASE "${database}"`);
  databaseCreated = true;
  await fresh.connect(); freshConnected = true;
  await fresh.query(schema);
  const categoryId = randomUUID();
  await fresh.query('INSERT INTO public.categories ("Id", "Name", "DisplayOrder", "Active") VALUES ($1, $2, 1, true)', [categoryId, 'SQL verification']);
  await fresh.query(schema);
  assert.equal((await fresh.query('SELECT count(*)::int AS n FROM public."__EFMigrationsHistory"')).rows[0].n, 5);
  assert.equal((await fresh.query('SELECT count(*)::int AS n FROM public.categories WHERE "Id" = $1', [categoryId])).rows[0].n, 1);
  assert.equal((await fresh.query("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity")).rows[0].n, 11);
  check('Esquema desde cero: cinco migraciones, once tablas con RLS; segunda ejecución conserva datos.');

  await fresh.query('BEGIN');
  await expectSqlError(fresh, `INSERT INTO public.products ("Id", "CategoryId", "Name", "Description", "PriceCop", "Available", "Active", "UpdatedAt") VALUES (gen_random_uuid(), '${categoryId}', 'Invalid', '', -1, true, true, now())`, /CK_products_price_cop_nonnegative/);
  await expectSqlError(fresh, 'INSERT INTO public.pickup_slots ("Id", "StartsAt", "EndsAt", "Capacity", "Active") VALUES (gen_random_uuid(), now(), now(), -1, true)', /CK_pickup_slots_capacity_nonnegative/);
  for (const role of ['anon', 'authenticated']) {
    await fresh.query(`SET LOCAL ROLE ${role}`);
    await expectSqlError(fresh, 'SELECT * FROM public.orders', /permission denied/);
    await expectSqlError(fresh, 'SELECT * FROM public.staff_roles', /permission denied/);
    await expectSqlError(fresh, 'SELECT * FROM public."__EFMigrationsHistory"', /permission denied/);
    await fresh.query('RESET ROLE');
  }
  // Even a later permissive policy and an accidental SELECT grant cannot expose rows.
  await fresh.query('GRANT SELECT ON public.categories TO anon');
  await fresh.query('CREATE POLICY sql_check_permissive ON public.categories FOR SELECT TO anon USING (true)');
  await fresh.query('SET LOCAL ROLE anon');
  assert.equal((await fresh.query('SELECT count(*)::int AS n FROM public.categories')).rows[0].n, 0);
  await fresh.query('ROLLBACK');
  check('Restricciones de precio/cupo y protección de pedidos, roles e historial frente a anon/authenticated.');

  const email = `sql-check-${suffix}@uniflow.test`;
  const password = `Local-check-${randomUUID()}!`;
  const created = await api('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email, password, email_confirm: true }) });
  assert.ok(created.ok, `Local Auth user creation failed (${created.status}).`);
  userId = (await created.json()).id;
  assert.ok(userId);

  // Validate the complete installer against real Supabase Auth/Storage schemas.
  // All application data, bucket metadata, and privileges in this block roll back.
  await control.query('BEGIN');
  await control.query(body(setup).replaceAll('uniflow-images', bucket));
  await control.query(body(setup).replaceAll('uniflow-images', bucket));
  await expectSqlError(control, body(bootstrap), /correo válido/);
  await expectSqlError(control, body(bootstrap).replace("admin_email text := 'CAMBIA_POR_TU_CORREO'", `admin_email text := 'missing-${suffix}@uniflow.test'`), /No existe el usuario/);
  // A global replacement used to rewrite the guard itself and make valid emails fail.
  const admin = body(bootstrap).replaceAll('CAMBIA_POR_TU_CORREO', email);
  await control.query(admin);
  const auditBefore = (await control.query('SELECT count(*)::int AS n FROM public.admin_audit_events WHERE "EntityId"=$1 AND "Action"=\'staff.bootstrap\'', [userId])).rows[0].n;
  assert.equal(auditBefore, 1);
  await control.query(admin);
  assert.equal((await control.query('SELECT count(*)::int AS n FROM public.admin_audit_events WHERE "EntityId"=$1 AND "Action"=\'staff.bootstrap\'', [userId])).rows[0].n, auditBefore);
  const report = await control.query(verify.replaceAll('uniflow-images', bucket));
  const controls = report[0].rows;
  assert.ok(controls.length >= 6);
  for (const row of controls) assert.equal(row.ok, true, row.control);
  await control.query('ROLLBACK');
  check('Instalador completo repetido sobre Supabase real; bootstrap validado, auditable e idempotente; seis controles correctos.');

  await control.query('BEGIN');
  await control.query('INSERT INTO storage.buckets (id,name,public) VALUES ($1,$1,false)', [bucket]);
  await expectSqlError(control, storage, /ya existe y es privado/);
  assert.equal((await control.query('SELECT public FROM storage.buckets WHERE id=$1', [bucket])).rows[0].public, false);
  await control.query('ROLLBACK');
  check('Un bucket privado preexistente provoca error y conserva su visibilidad.');

  // A temporary, uniquely named bucket allows real HTTP checks of signed uploads.
  await control.query(storage); bucketCreated = true;
  // Simulate a broad existing grant: the restrictive policy must still win.
  await control.query(`CREATE POLICY "sql_check_permissive_${suffix}" ON storage.objects FOR ALL TO anon, authenticated USING (bucket_id = '${bucket}') WITH CHECK (bucket_id = '${bucket}')`);
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXZkAAAAASUVORK5CYII=', 'base64');
  const anonHeaders = { apikey: config.SUPABASE_ANON_KEY, Authorization: `Bearer ${config.SUPABASE_ANON_KEY}`, 'Content-Type': 'image/png' };
  const denied = await api(`/storage/v1/object/${bucket}/forbidden.png`, { method: 'POST', headers: anonHeaders, body: image });
  assert.ok(!denied.ok, 'Anonymous direct upload must fail.');
  const login = await api('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
  assert.ok(login.ok, `Local Auth login failed (${login.status}).`);
  const token = (await login.json()).access_token;
  assert.ok(token);
  const staffDenied = await api(`/storage/v1/object/${bucket}/forbidden-staff.png`, {
    method: 'POST', headers: { ...anonHeaders, Authorization: `Bearer ${token}` }, body: image,
  });
  assert.ok(!staffDenied.ok, 'Authenticated direct upload must fail.');
  const signed = await api(`/storage/v1/object/upload/sign/${bucket}/verified.png`, { method: 'POST', body: JSON.stringify({ upsert: true }) });
  assert.ok(signed.ok, `Signed upload creation failed (${signed.status}).`);
  const { url } = await signed.json();
  assert.ok(url?.includes('token='));
  const uploaded = await api(`/storage/v1${url}`, { method: 'PUT', headers: { ...anonHeaders, 'x-upsert': 'true' }, body: image });
  assert.ok(uploaded.ok, `Signed upload failed (${uploaded.status}).`);
  const downloaded = await fetch(`${config.SUPABASE_URL}/storage/v1/object/public/${bucket}/verified.png`);
  assert.ok(downloaded.ok);
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), image);
  check('Storage real: cargas directas anon/authenticated bloqueadas incluso con política permisiva; carga firmada e imagen pública funcionan.');

  const markdown = `# Verificación SQL de Supabase\n\nEjecutada en UTC: ${new Date().toISOString()}.\n\nEntorno: Supabase local aislado (PostgreSQL en 127.0.0.1:54322; Auth/Storage en 127.0.0.1:54321). No se accedió al proyecto hospedado.\n\n${evidence.map(item => `- ${item}`).join('\n')}\n\nLa base temporal, el usuario Auth y el bucket de prueba se eliminan al terminar. Las comprobaciones transaccionales sobre tablas existentes se revierten.\n\n| Archivo | SHA-256 |\n| --- | --- |\n${scripts.map((name, index) => `| ${name} | ${createHash('sha256').update([setup, bootstrap, verify][index]).digest('hex')} |`).join('\n')}\n\nRepetir con \`npm --prefix verification run check:sql\` después de iniciar el Supabase local y preparar \`verification/.env\`.\n`;
  writeFileSync(new URL('supabase/verification.md', root), markdown);
} finally {
  await control.query('ROLLBACK').catch(() => {});
  if (bucketCreated) {
    const removed = await api(`/storage/v1/object/${bucket}`, { method: 'DELETE', body: JSON.stringify({ prefixes: ['verified.png'] }) });
    assert.ok(removed.ok, 'Temporary image cleanup failed.');
    const emptied = await api(`/storage/v1/bucket/${bucket}`, { method: 'DELETE' });
    assert.ok(emptied.ok, 'Temporary bucket cleanup failed.');
    await control.query(`DROP POLICY IF EXISTS "uniflow_api_only_${bucket}" ON storage.objects`);
    await control.query(`DROP POLICY IF EXISTS "sql_check_permissive_${suffix}" ON storage.objects`);
  }
  if (userId) {
    const removedUser = await api(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
    assert.ok(removedUser.ok, 'Temporary Auth user cleanup failed.');
  }
  if (freshConnected) await fresh.end();
  if (databaseCreated) await control.query(`DROP DATABASE "${database}"`);
  await control.end();
}
