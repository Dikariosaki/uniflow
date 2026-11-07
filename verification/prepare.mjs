import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const cli = fileURLToPath(
  new URL("./node_modules/supabase/dist/supabase.js", import.meta.url),
);
const state = JSON.parse(
  execFileSync(
    process.execPath,
    [cli, "status", "--workdir", "verification", "-o", "json"],
    { cwd: root, encoding: "utf8" },
  ),
);
if (
  state.API_URL !== "http://127.0.0.1:54321" ||
  !state.DB_URL?.includes("127.0.0.1:54322")
)
  throw new Error(
    "Acceptance setup is restricted to the isolated local Supabase stack.",
  );
writeFileSync(
  new URL("./.env", import.meta.url),
  [
    `SUPABASE_URL=${state.API_URL}`,
    "SUPABASE_INTERNAL_URL=http://host.docker.internal:54321",
    `SUPABASE_ANON_KEY=${state.ANON_KEY}`,
    `SUPABASE_SERVICE_ROLE_KEY=${state.SERVICE_ROLE_KEY}`,
    'SUPABASE_DB_CONNECTION="Host=host.docker.internal;Port=54322;Database=postgres;Username=postgres;Password=postgres;SSL Mode=Disable"',
    "APP_PUBLIC_URL=http://localhost:8088",
    "ALLOWED_ORIGINS=http://localhost:8088",
    "WEB_PORT=8088",
    "API_PORT=8089",
    "VERIFICATION_COMPOSE_PROJECT=uniflow-verification",
    "MIGRATE_ON_STARTUP=true",
    "ENSURE_STORAGE_BUCKET_ON_STARTUP=true",
  ].join("\n") + "\n",
);
console.log(
  "Local acceptance configuration written to verification/.env (ignored by Git).",
);
