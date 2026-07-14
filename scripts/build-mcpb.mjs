// Builds a Claude Desktop extension bundle (uf-schedule-mcp.mcpb).
// Stages a self-contained folder (compiled server + production node_modules +
// manifest) and packs it with the mcpb CLI.
//
//   npm run bundle   ->   ./uf-schedule-mcp.mcpb
//
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stage = join(root, "build", "bundle");
const out = join(root, "uf-schedule-mcp.mcpb");

function run(cmd, cwd = root) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

// 1. clean + compile
rmSync(join(root, "build"), { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
run("npm run build");

// 2. stage server files + manifest + metadata
cpSync(join(root, "dist"), join(stage, "dist"), { recursive: true });
cpSync(join(root, "manifest.json"), join(stage, "manifest.json"));
cpSync(join(root, "package.json"), join(stage, "package.json"));
for (const f of ["README.md", "LICENSE", "icon.png"]) {
  if (existsSync(join(root, f))) cpSync(join(root, f), join(stage, f));
}

// 3. install production dependencies into the bundle (Claude Desktop won't run npm)
run("npm install --omit=dev --ignore-scripts --no-package-lock", stage);

// 4. pack with the mcpb CLI
run(`npx --yes @anthropic-ai/mcpb pack "${stage}" "${out}"`);
console.log(`\nBuilt ${out}`);
