import type {ProjectLogActivityEntry} from "../projectNote";
import type {AtomicNoteRow, IndexedMeeting, IndexedTask, ProjectRollup} from "../types";
import {isISODateTodayOrFuture} from "./dates";

export type ChipKind = "tag" | "date" | "type" | "tracked" | "status" | "misc";

export type ActivityChip = {
	kind: ChipKind;
	label: string;
};

export type ActivityRowModel = {
	id: string;
	kind: "note" | "task" | "log" | "meeting";
	sortMs: number;
	title: string;
	chips: ActivityChip[];
	open: () => void;
	hoverPath?: string;
};

export type NextUpItem = {
	kind: "task" | "note";
	task?: IndexedTask;
	note?: AtomicNoteRow;
};

/** Strip `[[…]]` wikilink syntax, returning the display text. */
function stripWikilinks(s: string): string {
	return s.replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, "$1");
}

function chipsForNote(n: AtomicNoteRow, formatTracked: (n: number) => string): ActivityChip[] {
	const c: ActivityChip[] = [];
	if (n.dateDisplay) c.push({kind: "date", label: n.dateDisplay});
	if (n.noteType) c.push({kind: "type", label: stripWikilinks(n.noteType)});
	for (const t of n.tags) c.push({kind: "tag", label: `#${t}`});
	if (n.trackedMinutes > 0) c.push({kind: "tracked", label: formatTracked(n.trackedMinutes)});
	if (n.priority) c.push({kind: "misc", label: n.priority});
	return c;
}

function chipsForTask(t: IndexedTask, formatTracked: (n: number) => string): ActivityChip[] {
	const c: ActivityChip[] = [];
	if (t.dueDate) c.push({kind: "date", label: `due ${t.dueDate.slice(0, 10)}`});
	if (t.scheduledDate) c.push({kind: "date", label: `sched ${t.scheduledDate.slice(0, 10)}`});
	if (t.completedDate) c.push({kind: "date", label: `done ${t.completedDate.slice(0, 10)}`});
	c.push({kind: "status", label: t.status});
	if (t.priority) c.push({kind: "misc", label: t.priority});
	for (const tag of t.tags) c.push({kind: "tag", label: `#${tag}`});
	if (t.trackedMinutes > 0) c.push({kind: "tracked", label: formatTracked(t.trackedMinutes)});
	return c;
}

function chipsForLog(e: ProjectLogActivityEntry): ActivityChip[] {
	const c: ActivityChip[] = [];
	if (e.stampLabel) c.push({kind: "date", label: e.stampLabel});
	return c;
}

function chipsForMeeting(m: IndexedMeeting, formatTracked: (n: number) => string): ActivityChip[] {
	const c: ActivityChip[] = [];
	if (m.date?.trim()) c.push({kind: "date", label: m.date.slice(0, 10)});
	if (m.duration != null && Number.isFinite(m.duration)) c.push({kind: "tracked", label: `${m.duration}m`});
	if (m.totalMinutesTracked != null && m.totalMinutesTracked > 0) {
		c.push({kind: "tracked", label: formatTracked(m.totalMinutesTracked)});
	}
	return c;
}

function sortMsForMeeting(m: IndexedMeeting): number {
	if (m.date?.trim()) {
		const t = Date.parse(m.date.slice(0, 10) + "T12:00:00");
		if (!Number.isNaN(t)) return t;
	}
	return m.file.stat.mtime;
}

function earliestTodayOrFutureDueOrSched(t: IndexedTask): string | null {
	const keys: string[] = [];
	if (isISODateTodayOrFuture(t.dueDate)) keys.push(t.dueDate!.slice(0, 10));
	if (isISODateTodayOrFuture(t.scheduledDate)) keys.push(t.scheduledDate!.slice(0, 10));
	if (keys.length === 0) return null;
	return keys.sort()[0]!;
}

/** Open tasks (task notes + inline) that are not done by status and have no completion date. */
export function incompleteProjectTasks(tasks: IndexedTask[], doneTask: Set<string>): IndexedTask[] {
	return tasks.filter(
		(t) => !doneTask.has(t.status) && !t.completedDate?.trim(),
	);
}

export function taskIsComplete(t: IndexedTask, doneTask: Set<string>): boolean {
	return doneTask.has(t.status) || Boolean(t.completedDate?.trim());
}

/**
 * Next up: incomplete tasks with due or scheduled **today or later**, and notes whose primary date is **today or later** — ascending by that date.
 */
export function buildNextUpItems(
	rollup: ProjectRollup,
	doneTask: Set<string>,
	limit = 8,
): NextUpItem[] {
	type Row = {key: string; item: NextUpItem};
	const rows: Row[] = [];
	for (const t of rollup.tasks) {
		if (doneTask.has(t.status) || t.completedDate?.trim()) continue;
		const key = earliestTodayOrFutureDueOrSched(t);
		if (key == null) continue;
		rows.push({key, item: {kind: "task", task: t}});
	}
	for (const n of rollup.atomicNotes) {
		if (!isISODateTodayOrFuture(n.dateSort)) continue;
		rows.push({key: n.dateSort.slice(0, 10), item: {kind: "note", note: n}});
	}
	rows.sort((a, b) => a.key.localeCompare(b.key));
	return rows.slice(0, limit).map((r) => r.item);
}

export function buildActivityRowModels(
	rollup: ProjectRollup,
	logEntries: ProjectLogActivityEntry[],
	deps: {
		projectPath: string;
		doneTask: Set<string>;
		openPath: (path: string) => void;
		openTask: (t: IndexedTask) => void;
		formatTracked: (n: number) => string;
	},
): ActivityRowModel[] {
	const items: ActivityRowModel[] = [];
	for (const n of rollup.atomicNotes) {
		items.push({
			id: `note:${n.file.path}`,
			kind: "note",
			sortMs: n.modifiedMs,
			title: n.entryTitle,
			chips: chipsForNote(n, deps.formatTracked),
			open: () => deps.openPath(n.file.path),
			hoverPath: n.file.path,
		});
	}
	for (const t of rollup.tasks) {
		if (!taskIsComplete(t, deps.doneTask)) continue;
		items.push({
			id: `task:${t.file.path}:${t.line ?? 0}:${t.title.slice(0, 80)}`,
			kind: "task",
			sortMs: t.file.stat.mtime,
			title: t.title,
			chips: chipsForTask(t, deps.formatTracked),
			open: () => deps.openTask(t),
			hoverPath: t.file.path,
		});
	}
	for (const m of rollup.meetings) {
		items.push({
			id: `meeting:${m.file.path}`,
			kind: "meeting",
			sortMs: sortMsForMeeting(m),
			title: m.title?.trim() || m.file.basename.replace(/\.md$/i, ""),
			chips: chipsForMeeting(m, deps.formatTracked),
			open: () => deps.openPath(m.file.path),
			hoverPath: m.file.path,
		});
	}
	for (let i = 0; i < logEntries.length; i++) {
		const e = logEntries[i]!;
		items.push({
			id: `log:${e.sortMs}:${i}`,
			kind: "log",
			sortMs: e.sortMs,
			title: e.title,
			chips: chipsForLog(e),
			open: () => deps.openPath(deps.projectPath),
		});
	}
	items.sort((a, b) => b.sortMs - a.sortMs);
	return items;
}
