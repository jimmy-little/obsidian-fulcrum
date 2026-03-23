/**
 * Calendar event parsing for Fulcrum calendar view.
 * Parses start/end times from date strings; all-day vs timed placement.
 */

import type {IndexedMeeting, IndexedProject, IndexedTask} from "../types";
import {resolveProjectAccentCss} from "./projectVisual";

export type CalendarEventKind = "task" | "meeting";

export type CalendarEvent = {
	kind: CalendarEventKind;
	/** YYYY-MM-DD */
	dateIso: string;
	/** 0–1439 = minutes from midnight (00:00); null = all-day */
	startMinutes: number | null;
	/** Duration in minutes; null for all-day or single point */
	durationMinutes: number | null;
	/** For tasks: primary date used (scheduled or due) */
	title: string;
	/** Project color CSS when linked to project */
	accentCss: string | null;
	/** Open handler */
	open: () => void;
	/** For tasks */
	task?: IndexedTask;
	/** For meetings */
	meeting?: IndexedMeeting;
};

const DEFAULT_DURATION_MINUTES = 30;

/** Parse ISO-like string to { dateIso, minutesFromMidnight }.
 * Supports: YYYY-MM-DD, YYYY-MM-DDTHH:mm, YYYY-MM-DDTHH:mm:ss, YYYY-MM-DD HH:mm
 */
function parseDateTime(raw: string | undefined): {
	dateIso: string;
	minutesFromMidnight: number | null;
} | null {
	if (!raw?.trim()) return null;
	const s = String(raw).trim();
	const datePart = s.slice(0, 10);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;

	let minutesFromMidnight: number | null = null;
	const tMatch = s.slice(10).match(/[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?/);
	if (tMatch) {
		const h = parseInt(tMatch[1]!, 10);
		const m = parseInt(tMatch[2]!, 10);
		if (h >= 0 && h < 24 && m >= 0 && m < 60) {
			minutesFromMidnight = h * 60 + m;
		}
	}

	return {dateIso: datePart, minutesFromMidnight};
}

/** Build calendar events from task. Uses scheduledDate and/or dueDate.
 * Same day + both have times: span from scheduled to due.
 * Same day + one has time: 30 min from that time.
 * No time: all-day.
 */
export function taskToCalendarEvent(
	t: IndexedTask,
	open: () => void,
	projectColorByPath: Map<string, string>,
): CalendarEvent[] {
	const events: CalendarEvent[] = [];
	const accentCss = t.projectFile?.path
		? resolveProjectAccentCss(projectColorByPath.get(t.projectFile.path) ?? undefined)
		: null;

	const sched = parseDateTime(t.scheduledDate);
	const due = parseDateTime(t.dueDate);

	if (sched && due && sched.dateIso === due.dateIso && sched.minutesFromMidnight != null && due.minutesFromMidnight != null) {
		// Same day, both have times: span from start to end
		const startM = sched.minutesFromMidnight;
		const endM = due.minutesFromMidnight;
		const duration = Math.max(15, endM - startM);
		events.push({
			kind: "task",
			dateIso: sched.dateIso,
			startMinutes: startM,
			durationMinutes: duration,
			title: t.title,
			accentCss,
			open,
			task: t,
		});
		return events;
	}

	function add(parsed: ReturnType<typeof parseDateTime>): void {
		if (!parsed) return;
		const isAllDay = parsed.minutesFromMidnight == null;
		events.push({
			kind: "task",
			dateIso: parsed.dateIso,
			startMinutes: parsed.minutesFromMidnight,
			durationMinutes: isAllDay ? null : DEFAULT_DURATION_MINUTES,
			title: t.title,
			accentCss,
			open,
			task: t,
		});
	}

	if (sched) add(sched);
	if (due && due.dateIso !== sched?.dateIso) add(due);
	return events;
}

/** Build calendar event from meeting.
 * date may include time. duration from meeting.duration. No time = all-day. Time but no duration = 30 min.
 */
export function meetingToCalendarEvent(
	m: IndexedMeeting,
	open: () => void,
	projectColorByPath: Map<string, string>,
): CalendarEvent | null {
	const parsed = parseDateTime(m.date);
	if (!parsed) return null;
	const isAllDay = parsed.minutesFromMidnight == null;
	const duration =
		m.duration != null && Number.isFinite(m.duration) && m.duration > 0
			? m.duration
			: isAllDay
				? null
				: DEFAULT_DURATION_MINUTES;

	return {
		kind: "meeting",
		dateIso: parsed.dateIso,
		startMinutes: parsed.minutesFromMidnight,
		durationMinutes: duration,
		title: m.title?.trim() || "Meeting",
		accentCss: m.projectFile?.path
			? resolveProjectAccentCss(projectColorByPath.get(m.projectFile.path) ?? undefined)
			: null,
		open,
		meeting: m,
	};
}

/** Build project path -> color map from snapshot. */
export function projectColorMap(projects: IndexedProject[]): Map<string, string> {
	const m = new Map<string, string>();
	for (const p of projects) {
		if (p.color?.trim()) m.set(p.file.path, p.color);
	}
	return m;
}
