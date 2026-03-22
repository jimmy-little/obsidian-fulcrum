/** Minutes from frontmatter (TaskNotes, meetings, atomic notes) without Dataview. */
export function readTrackedMinutesFromFm(
	fm: Record<string, unknown> | undefined,
	preferredKey?: string,
): number {
	if (!fm) return 0;
	const pk = preferredKey?.trim();
	if (pk) {
		const v = fm[pk];
		if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
		if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim())) {
			return Math.round(Number.parseFloat(v.trim()));
		}
	}
	const direct =
		fm.totalMinutesTracked ?? fm["Total Minutes Tracked"] ?? fm.timeLoggedMinutes;
	if (typeof direct === "number" && Number.isFinite(direct)) {
		return Math.round(direct);
	}
	if (typeof direct === "string" && /^-?\d+(\.\d+)?$/.test(direct.trim())) {
		return Math.round(Number.parseFloat(direct));
	}

	const st = fm.startTime;
	const en = fm.endTime;
	if (typeof st === "string" && typeof en === "string") {
		const a = Date.parse(st);
		const b = Date.parse(en);
		if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
			return Math.round((b - a) / 60000);
		}
	}
	return 0;
}
