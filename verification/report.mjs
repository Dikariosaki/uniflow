import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { pool, appOrigin } from "./fixtures.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const results = JSON.parse(
  readFileSync(new URL("./artifacts/results.json", import.meta.url), "utf8"),
);
const tests = [];
function visit(suite) {
  for (const spec of suite.specs ?? [])
    tests.push({
      title: spec.title,
      ok: spec.ok,
      durationMs: spec.tests
        .flatMap((t) => t.results)
        .reduce((sum, r) => sum + r.duration, 0),
    });
  for (const child of suite.suites ?? []) visit(child);
}
results.suites.forEach(visit);
const declared = (
  readFileSync(
    new URL("./tests/acceptance.spec.mjs", import.meta.url),
    "utf8",
  ).match(/^\s*test\(/gm) ?? []
).length;
if (
  tests.length !== declared ||
  !tests.every((t) => t.ok) ||
  results.stats.unexpected ||
  results.stats.skipped
)
  throw new Error(
    "Run the complete passing acceptance suite before generating evidence.",
  );

function sourceFiles(directory) {
  return readdirSync(
    new URL(directory + "/", new URL("../", import.meta.url)),
    { withFileTypes: true },
  ).flatMap((entry) => {
    if (["bin", "obj", "node_modules", "dist", ".angular"].includes(entry.name))
      return [];
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}
const paths = [
  ...sourceFiles("api"),
  ...sourceFiles("web/src"),
  ...sourceFiles("web/public"),
  ...sourceFiles("verification/tests"),
  ...sourceFiles("verification/backend-checks"),
  "docker-compose.yml",
  ".env.example",
  "web/Dockerfile",
  "web/nginx.conf",
  "web/docker-entrypoint.sh",
  "web/config.template.js",
  "web/package.json",
  "web/package-lock.json",
  "verification/compose.yml",
  "verification/supabase/config.toml",
  "verification/fixtures.mjs",
  "verification/playwright.config.mjs",
  "verification/package.json",
  "verification/package-lock.json",
  "verification/check-architecture.mjs",
  "verification/prepare.mjs",
  "verification/prepare-api.mjs",
  "verification/report.mjs",
  "ARCHITECTURE.md",
  "README.md",
  "web/README.md",
  "verification/README.md",
  "openspec/changes/uniflow-mvp/proposal.md",
  "openspec/changes/uniflow-mvp/design.md",
  "openspec/changes/uniflow-mvp/tasks.md",
];
const hashes = Object.fromEntries(
  paths.sort().map((path) => [
    path,
    createHash("sha256")
      .update(readFileSync(new URL(path, new URL("../", import.meta.url))))
      .digest("hex"),
  ]),
);
const project =
  process.env.VERIFICATION_COMPOSE_PROJECT ?? "uniflow-verification";
const containers = [`${project}-api-1`, `${project}-web-1`].map((name) => {
  const inspected = JSON.parse(
    execFileSync("docker", ["inspect", name], { cwd: root, encoding: "utf8" }),
  )[0];
  return {
    name,
    image: inspected.Image,
    state: inspected.State.Status,
    health: inspected.State.Health?.Status,
  };
});
if (containers.some((c) => c.state !== "running" || c.health !== "healthy"))
  throw new Error("Compose services must be running and healthy.");
const health = await fetch(`${appOrigin}/api/v1/health`).then((r) => r.json());
if (health.database !== "connected")
  throw new Error("The API must prove database connectivity.");
const migrations = (
  await pool.query(
    'select "MigrationId" from "__EFMigrationsHistory" order by "MigrationId"',
  )
).rows.map((r) => r.MigrationId);
const rls = (
  await pool.query(
    "select tablename,rowsecurity from pg_tables where schemaname='public' and tablename!='__EFMigrationsHistory' order by tablename",
  )
).rows;
await pool.end();
const evidence = {
  verifiedAt: new Date().toISOString(),
  environment: "Local Supabase CLI outside the web/API Compose stack",
  architecture: JSON.parse(
    readFileSync(
      new URL("./artifacts/architecture-check.json", import.meta.url),
      "utf8",
    ),
  ),
  node: process.version,
  tests,
  containers,
  health,
  migrations,
  rowLevelSecurity: rls,
  sourceSha256: hashes,
};
writeFileSync(
  new URL("./evidence.json", import.meta.url),
  JSON.stringify(evidence, null, 2) + "\n",
);
const report = `# UniFlow: aceptación del MVP\n\nVerificado: ${evidence.verifiedAt}.\n\n${tests.length} escenarios aprobados contra PostgreSQL, Supabase Auth y Supabase Storage reales en un proyecto CLI local aislado. Web y API están construidos con Docker y saludables; la API confirma conexión con la base de datos.\n\n## Arquitectura comprobada\n\nCuatro proyectos de backend con dependencias hacia las capas internas; Domain y Application sin paquetes de web o persistencia. Siete ramas de frontend, diez páginas con carga diferida y entradas públicas entre funcionalidades. La comprobación ejecutable se encuentra en [check-architecture.mjs](check-architecture.mjs), y las responsabilidades en [ARCHITECTURE.md](../ARCHITECTURE.md).\n\n## Escenarios\n\n| Escenario | Resultado |\n| --- | --- |\n${tests.map((t) => `| ${t.title} | Aprobado |`).join("\n")}\n\n## Evidencia\n\n- [Suite ejecutable](tests/acceptance.spec.mjs), [configuración](playwright.config.mjs) y [comandos para repetirla](README.md).\n- [Estado de contenedores, migraciones aplicadas, RLS y hashes de fuentes](evidence.json).\n- [Resultado completo de Playwright](artifacts/results.json), capturas en \`artifacts/\` e informe en \`playwright-report/index.html\` (generados localmente y excluidos de Git).\n- Menú, carrito y selección de recogida: 360, 390, 768 y 1440 px. Paneles: 360, 768 y 1440 px.\n- Comprobaciones automáticas de contraste, etiquetas y teclado, además de revisión de capturas con el diseño de referencia. Las pruebas no certifican cumplimiento integral de WCAG ni representan dispositivos físicos.\n- Las claves y contraseñas del entorno se mantienen fuera de este informe.\n\n## Despliegue alojado\n\nLa verificación usa Supabase local como dependencia externa de Compose. No se configuró ni modificó un proyecto alojado. Sus credenciales, correo, dominio HTTPS, horarios y capacidades reales corresponden a la configuración de cada despliegue descrita en el [README principal](../README.md).\n`;
writeFileSync(new URL("./acceptance-report.md", import.meta.url), report);
console.log(
  `${tests.length} passing scenarios recorded; both containers are healthy and the database is connected.`,
);
