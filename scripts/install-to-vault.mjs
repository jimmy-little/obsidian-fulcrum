#!/usr/bin/env node
/**
 * Copies main.js, manifest.json, and styles.css into the vault plugin folder.
 *
 * Vault path (first match wins):
 *   1. CLI: node scripts/install-to-vault.mjs "/path/to/Vault"
 *   2. Env: OBSIDIAN_VAULT_PATH
 *   3. File: fulcrum-vault.path in the repo root (first line only; use fulcrum-vault.path.example)
 *
 * npm: pass the vault path after -- so it reaches this script:
 *   npm run build:install -- "/path/to/Vault"
 */
import {copyFileSync, existsSync, mkdirSync, readFileSync, statSync} from "node:fs";
import {homedir} from "node:os";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const pluginId = manifest.id;

function expandPath(p) {
	const t = p.trim();
	if (!t) return "";
	if (t.startsWith("~/")) return join(homedir(), t.slice(2));
	return t;
}

function readVaultPathFile() {
	const f = join(root, "fulcrum-vault.path");
	if (!existsSync(f)) return "";
	try {
		const lines = readFileSync(f, "utf8").split(/\r?\n/u);
		for (const raw of lines) {
			const line = raw.trim();
			if (!line || line.startsWith("#")) continue;
			return expandPath(line);
		}
		return "";
	} catch {
		return "";
	}
}

const vaultRaw =
	process.argv[2]?.trim() ||
	process.env.OBSIDIAN_VAULT_PATH?.trim() ||
	readVaultPathFile();

const vault = expandPath(vaultRaw);

if (!vault) {
	console.error(`
Fulcrum install: no vault path configured.

Choose one:
  A) Create "${join(root, "fulcrum-vault.path")}" with a single line: absolute path to your vault
     (copy from fulcrum-vault.path.example), then run:  npm run build:install

  B) Environment variable:  OBSIDIAN_VAULT_PATH="/path/to/Vault" npm run build:install

  C) Pass path after double-dash (required — npm will not forward a bare path):
       npm run build:install -- "/path/to/Vault"
`);
	process.exit(1);
}

if (!existsSync(vault)) {
	console.error(`Fulcrum install: vault folder does not exist:\n  ${vault}`);
	process.exit(1);
}

const destDir = join(vault, ".obsidian", "plugins", pluginId);
console.log(`Fulcrum install: vault → ${vault}`);
console.log(`Fulcrum install: plugin dir → ${destDir}`);

mkdirSync(destDir, {recursive: true});

const files = ["main.js", "manifest.json", "styles.css"];
let copied = 0;
for (const name of files) {
	const src = join(root, name);
	if (!existsSync(src)) {
		console.warn(`Skip (missing in repo): ${src}`);
		continue;
	}
	const dest = join(destDir, name);
	copyFileSync(src, dest);
	const st = statSync(dest);
	console.log(`→ ${dest} (${st.size} bytes, ${st.mtime.toISOString()})`);
	copied++;
}

if (copied === 0) {
	console.error("No files copied. Run `npm run build` first (main.js must exist in the repo root).");
	process.exit(1);
}

console.log(`Installed "${pluginId}" (${copied} files). Reload Obsidian or toggle the plugin.`);
