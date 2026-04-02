import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";

const root = new URL("../", import.meta.url);

rmSync(new URL("../dist", import.meta.url), { force: true, recursive: true });
mkdirSync(new URL("../dist/cli", import.meta.url), { recursive: true });

run("bun", [
  "build",
  "src/index.ts",
  "--outfile",
  "dist/index.js",
  "--target",
  "node",
  "--format",
  "esm",
]);

run("bun", [
  "build",
  "src/cli/index.ts",
  "--outfile",
  "dist/cli/index.js",
  "--target",
  "node",
  "--format",
  "esm",
]);

run("tsc", [
  "--project",
  "tsconfig.json",
  "--emitDeclarationOnly",
  "--declaration",
  "--declarationDir",
  "dist",
  "--outDir",
  "dist",
]);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
