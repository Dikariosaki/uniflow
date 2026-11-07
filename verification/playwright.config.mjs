import { defineConfig } from "@playwright/test";
import { loadEnvFile } from "node:process";
loadEnvFile(new URL("./.env", import.meta.url));

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/results.json" }],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL: process.env.APP_PUBLIC_URL ?? "http://localhost:8088",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
