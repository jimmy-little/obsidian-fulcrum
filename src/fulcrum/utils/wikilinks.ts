/** Extract link path from `[[Note]]` or `[[Note|alias]]`, or return trimmed plain string. */
export function parseWikiLink(raw: unknown): string | null {
	if (raw == null) return null;
	if (typeof raw !== "string") return null;
	const s = raw.trim();
	const m = s.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]\s*$/);
	if (m?.[1]) return m[1].trim();
	if (s.includes("[[")) return null;
	return s.length ? s : null;
}
