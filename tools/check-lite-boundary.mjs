// Release guard: Lite and the packages it ships must not contain the Premium
// remapper or a Windows keyboard/mouse output path. Run before and after building Lite.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const roots = ["apps/spacemapper-lite", "crates", "packages/app-core/src", "packages/app-core/dist", "packages/ui/src", "packages/ui/dist"];
const ignored = new Set(["node_modules", "target", "gen", "icons", ".git"]);
const extensions = new Set([".rs", ".ts", ".tsx", ".js", ".toml", ".json"]);
const forbidden = /\b(?:SendInput|keybd_event|mouse_event|JoyMapperState|JoyMapperPanel|spacemapper-premium-scope)\b|\bjoy_(?:start|resume|stop|status|save_profile|list_profiles|delete_profile|import_profile|sample_axis|get_preferences|set_auto_start)\b|\bmod\s+joymapper\b/;

async function* sources(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* sources(filename);
    else if (extensions.has(path.extname(entry.name)) && !entry.name.endsWith(".map")) yield filename;
  }
}

const failures = [];
let checked = 0;
for (const directory of roots) {
  for await (const filename of sources(path.join(root, directory))) {
    const content = await readFile(filename, "utf8");
    checked += 1;
    const match = forbidden.exec(content);
    if (match) {
      const line = content.slice(0, match.index).split("\n").length;
      failures.push(`${path.relative(root, filename)}:${line}: ${match[0]}`);
    }
  }
}

const backend = await readFile(path.join(root, "apps/spacemapper-lite/src-tauri/src/editing.rs"), "utf8");
if (!/spacemapper_edit::apply_all_to_file\s*\(/.test(backend)) {
  failures.push("Lite must save bindings through spacemapper_edit::apply_all_to_file (LiteScope).");
}

if (failures.length) {
  console.error(`Lite/Premium boundary violated:\n${failures.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Lite/Premium boundary verified (${checked} source/build files; LiteScope write path).`);
}
