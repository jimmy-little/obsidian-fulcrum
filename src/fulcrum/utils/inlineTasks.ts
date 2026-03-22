/** Title text from a markdown checkbox line, or null if not a task line. */
export function parseCheckboxLineTitle(line: string): string | null {
	const m = line.match(/^\s*[-*+]\s*\[[^\]]*\]\s*(.*)$/);
	if (!m) return null;
	return m[1]?.trim() ?? "";
}

/** Flip `[ ]` ↔ `[x]` on a checkbox line; null if not a checkbox line. */
export function flipMarkdownCheckboxLine(line: string): string | null {
	const m = line.match(/^(\s*[-*+]\s*)\[([^\]]*)\](.*)$/);
	if (!m) return null;
	const inner = m[2];
	const next = inner === " " || inner === "" ? "x" : " ";
	return `${m[1]}[${next}]${m[3]}`;
}

/** Obsidian Tasks-style emoji metadata: due / scheduled from line tail. */
export function parseObsidianTasksEmojiDates(line: string): {
	title: string;
	dueDate?: string;
	scheduledDate?: string;
} {
	let t = line;
	const dues: string[] = [];
	const sched: string[] = [];
	const dueRe = /(?:📅|⏰|📆)\s*(\d{4}-\d{2}-\d{2})/g;
	let m: RegExpExecArray | null;
	while ((m = dueRe.exec(line)) !== null) {
		if (m[1]) dues.push(m[1]);
	}
	const schedRe = /⏫\s*(\d{4}-\d{2}-\d{2})/g;
	while ((m = schedRe.exec(line)) !== null) {
		if (m[1]) sched.push(m[1]);
	}
	t = t
		.replace(/(?:📅|⏰|📆)\s*\d{4}-\d{2}-\d{2}/g, " ")
		.replace(/⏫\s*\d{4}-\d{2}-\d{2}/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return {
		title: t,
		dueDate: dues[0],
		scheduledDate: sched[0],
	};
}
