/** Trim, strip leading slashes, strip trailing slashes — matches Obsidian vault-relative paths. */
export function normalizeVaultRelPath(folder: string): string {
	let f = folder.trim().replace(/^\/+/, "");
	while (f.endsWith("/")) {
		f = f.slice(0, -1);
	}
	return f;
}

/** True if `filePath` is exactly `folder` or under it. */
export function isUnderFolder(filePath: string, folder: string): boolean {
	const f = normalizeVaultRelPath(folder);
	if (!f) return true;
	const p = filePath.replace(/^\/+/, "");
	if (p === f) return true;
	return p.startsWith(f + "/");
}
