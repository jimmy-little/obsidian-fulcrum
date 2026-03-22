import {existsSync, readFileSync} from "node:fs";
import {homedir} from "node:os";
import {join} from "node:path";

export function expandPath(p) {
	const t = p.trim();
	if (!t) return "";
	if (t.startsWith("~/")) return join(homedir(), t.slice(2));
	return t;
}

/** @param {string} root - repo root (folder containing package.json) */
export function resolveObsidianVaultPath(root, argv2) {
	const fromArg = argv2?.trim();
	if (fromArg) return expandPath(fromArg);
	const fromEnv = process.env.OBSIDIAN_VAULT_PATH?.trim();
	if (fromEnv) return expandPath(fromEnv);
	const f = join(root, "fulcrum-vault.path");
	if (!existsSync(f)) return "";
	try {
		const lines = readFileSync(f, "utf8").split(/\r?\n/u);
		for (const raw of lines) {
			const line = raw.trim();
			if (!line || line.startsWith("#")) continue;
			return expandPath(line);
		}
	} catch {
		/* ignore */
	}
	return "";
}
