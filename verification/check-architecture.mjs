import {
  readFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (file) => readFileSync(path.join(root, file), "utf8");
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
function files(directory) {
  return readdirSync(path.join(root, directory), {
    withFileTypes: true,
  }).flatMap((entry) => {
    if (["bin", "obj", "node_modules", "dist", ".angular"].includes(entry.name))
      return [];
    const file = `${directory}/${entry.name}`;
    return entry.isDirectory() ? files(file) : [file];
  });
}
const references = {};
const expected = {
  Domain: [],
  Application: ["Domain"],
  Infrastructure: ["Application", "Domain"],
  Api: ["Application", "Infrastructure"],
};
for (const [layer, dependencies] of Object.entries(expected)) {
  const project = read(`api/UniFlow.${layer}/UniFlow.${layer}.csproj`);
  references[layer] = [
    ...project.matchAll(
      /ProjectReference Include="[^\"]*UniFlow\.(\w+)\.csproj"/g,
    ),
  ]
    .map((match) => match[1])
    .sort();
  check(
    JSON.stringify(references[layer]) ===
      JSON.stringify(dependencies.slice().sort()),
    `${layer}: unexpected project dependencies.`,
  );
  if (["Domain", "Application"].includes(layer))
    check(
      !project.includes("PackageReference"),
      `${layer} must compile without infrastructure or web packages.`,
    );
  for (const file of files(`api/UniFlow.${layer}`).filter((file) =>
    file.endsWith(".cs"),
  )) {
    const code = read(file);
    if (["Domain", "Application"].includes(layer)) {
      check(
        !/Microsoft\.(AspNetCore|EntityFrameworkCore)|\bNpgsql\b|UniFlow\.(Infrastructure|Api)\b/.test(
          code,
        ),
        `${file}: outer dependency in an inner layer.`,
      );
      check(
        !/\b(SELECT|INSERT INTO|DELETE FROM|FOR UPDATE)\b/.test(code),
        `${file}: SQL belongs to Infrastructure.`,
      );
    }
    if (layer === "Domain")
      check(
        !code.includes("UniFlow.Application"),
        `${file}: Domain must not depend on Application.`,
      );
    if (layer === "Infrastructure")
      check(
        !code.includes("UniFlow.Api"),
        `${file}: Infrastructure must not depend on API.`,
      );
    if (file.includes("/Endpoints/"))
      check(
        !/DbContext|SaveChangesAsync|ExecuteSql|UniFlow\.Infrastructure/.test(
          code,
        ),
        `${file}: endpoint contains persistence logic.`,
      );
  }
}

const featureDirectories = readdirSync(
  path.join(root, "web/src/app/features"),
  { withFileTypes: true },
)
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
check(
  featureDirectories.length === 7,
  "The seven feature branches must remain explicit.",
);
for (const feature of featureDirectories) {
  check(
    existsSync(path.join(root, `web/src/app/features/${feature}/index.ts`)),
    `${feature}: missing public entry point.`,
  );
  check(
    files(`web/src/app/features/${feature}/pages`).some((file) =>
      file.endsWith(".ts"),
    ),
    `${feature}: missing page components.`,
  );
  check(
    files(`web/src/app/features/${feature}/data-access`).some((file) =>
      file.endsWith(".store.ts"),
    ),
    `${feature}: missing feature state/data access.`,
  );
}
for (const file of files("web/src/app").filter((file) =>
  file.endsWith(".ts"),
)) {
  const code = read(file);
  for (const match of code.matchAll(
    /(?:from\s+|import\s*\()(['"])([^'"]+)\1/g,
  )) {
    const imported = match[2];
    if (!imported.startsWith(".")) continue;
    const resolved = path.resolve(root, path.dirname(file), imported);
    const featureRoot = path.join(root, "web/src/app/features") + path.sep;
    const targetFeature = resolved.startsWith(featureRoot)
      ? path.relative(featureRoot, resolved).split(path.sep)[0]
      : null;
    if (
      file.startsWith("web/src/app/core/") ||
      file.startsWith("web/src/app/shared/")
    )
      check(!targetFeature, `${file}: core/shared imports a feature.`);
    if (file.startsWith("web/src/app/features/")) {
      const sourceFeature = file.split("/")[4];
      check(
        !resolved.includes(path.join("app", "layout")),
        `${file}: feature imports application layout.`,
      );
      if (targetFeature && targetFeature !== sourceFeature)
        check(
          resolved === path.join(root, "web/src/app/features", targetFeature) ||
            resolved.endsWith(path.join(targetFeature, "index")),
          `${file}: cross-feature access must use its public entry point.`,
        );
    }
  }
}
const routes = read("web/src/app/app.routes.ts");
check(
  (routes.match(/loadComponent:/g) ?? []).length === 10,
  "Each of the ten pages must remain lazily routed.",
);
check(
  !existsSync(path.join(root, "web/src/app/app.html")),
  "The old monolithic application template must not remain.",
);
if (failures.length) throw new Error(failures.join("\n"));
const result = {
  checkedAt: new Date().toISOString(),
  projectReferences: references,
  featureBranches: featureDirectories,
  lazyPages: 10,
  failures,
};
mkdirSync(path.join(root, "verification/artifacts"), { recursive: true });
writeFileSync(
  path.join(root, "verification/artifacts/architecture-check.json"),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  "Architecture verified: 4 inward-dependent backend projects, 7 feature branches and 10 lazy pages.",
);
