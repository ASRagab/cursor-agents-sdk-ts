import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const binWrapper = `#!/usr/bin/env node

import "../dist/cli/index.js";
`;

rmSync(new URL("../bin", import.meta.url), { force: true, recursive: true });
rmSync(new URL("../dist", import.meta.url), { force: true, recursive: true });
mkdirSync(new URL("../bin", import.meta.url), { recursive: true });
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

writeFileSync(new URL("../bin/cursor-agents.js", import.meta.url), binWrapper);
chmodSync(new URL("../bin/cursor-agents.js", import.meta.url), 0o755);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
