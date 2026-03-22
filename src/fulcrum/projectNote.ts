import type {App, TFile} from "obsidian";
import {addDaysIso, todayLocalISODate} from "./utils/dates";
import type {FulcrumSettings} from "./settingsDefaults";

function fmString(fm: Record<string, unknown> | undefined, key: string): string | undefined {
	if (!fm) return undefined;
	const v = fm[key];
	if (typeof v === "string") return v;
	if (typeof v === "number" || typeof v === "boolean") return String(v);
	return undefined;
}

function insertLogEntry(body: string, headingLine: string, entryLine: string): string {
	const heading = headingLine.trim();
	const entry = entryLine.endsWith("\n") ? entryLine : entryLine + "\n";
	const idx = body.indexOf(heading);
	if (idx === -1) {
		const sep = body.trimEnd().length > 0 ? "\n\n" : "";
		return body.trimEnd() + `${sep}${heading}\n\n${entry}`;
	}
	const afterHeading = idx + heading.length;
	let cut = body.length;
	for (const needle of ["\n## ", "\n##\t"]) {
		const n = body.indexOf(needle, afterHeading);
		if (n !== -1) cut = Math.min(cut, n);
	}
	const headPart = body.slice(0, cut).trimEnd();
	const tailPart = body.slice(cut);
	return headPart + "\n" + entry + (tailPart.startsWith("\n") ? tailPart : "\n" + tailPart);
}

export async function appendFulcrumProjectLog(
	app: App,
	projectFile: TFile,
	headingLine: string,
	bodyLine: string,
): Promise<void> {
	const heading = headingLine.trim();
	if (!heading) throw new Error("Missing log heading");
	const body = await app.vault.read(projectFile);
	await app.vault.modify(projectFile, insertLogEntry(body, heading, bodyLine));
}

/** Non-empty bullet / numbered lines under the log heading (most recent last). */
export async function readFulcrumLogTail(
	app: App,
	projectFile: TFile,
	headingLine: string,
	maxEntries: number,
): Promise<string[]> {
	const heading = headingLine.trim();
	const body = await app.vault.read(projectFile);
	const idx = body.indexOf(heading);
	if (idx === -1) return [];
	const afterHeading = body.slice(idx + heading.length);
	const nextSection = afterHeading.search(/\n##[ \t]/);
	const section = nextSection === -1 ? afterHeading : afterHeading.slice(0, nextSection);
	const lines = section.split("\n");
	const entries: string[] = [];
	for (const line of lines) {
		const t = line.trim();
		if (/^[-*]\s+/.test(t) || /^\d+\.\s+/.test(t)) {
			entries.push(t);
		}
	}
	return entries.slice(-maxEntries);
}

export async function markProjectReviewDates(
	app: App,
	projectFile: TFile,
	s: FulcrumSettings,
): Promise<void> {
	const lr = s.projectLastReviewedField;
	const nr = s.projectNextReviewField;
	const rf = s.projectReviewFrequencyField;
	const today = todayLocalISODate();
	await app.fileManager.processFrontMatter(projectFile, (fm) => {
		const o = fm as Record<string, unknown>;
		const freqRaw = o[rf];
		let freq =
			typeof freqRaw === "number" && Number.isFinite(freqRaw)
				? Math.round(freqRaw)
				: typeof freqRaw === "string" && /^\d+$/.test(freqRaw.trim())
					? Number.parseInt(freqRaw, 10)
					: s.defaultReviewFrequencyDays;
		if (!Number.isFinite(freq) || freq < 1) freq = s.defaultReviewFrequencyDays;
		o[lr] = today;
		o[nr] = addDaysIso(today, freq);
	});
}

export function readProjectPageMeta(
	app: App,
	projectFile: TFile,
	s: FulcrumSettings,
): {
	launchDate?: string;
	lastReviewed?: string;
	nextReview?: string;
	reviewFrequencyDays: number;
	jira?: string;
	description?: string;
} {
	const fm = app.metadataCache.getFileCache(projectFile)?.frontmatter as
		| Record<string, unknown>
		| undefined;
	const launch = fmString(fm, s.projectLaunchDateField);
	const lastReviewed = fmString(fm, s.projectLastReviewedField);
	const nextReview = fmString(fm, s.projectNextReviewField);
	const freqRaw = fm?.[s.projectReviewFrequencyField];
	let reviewFrequencyDays = s.defaultReviewFrequencyDays;
	if (typeof freqRaw === "number" && Number.isFinite(freqRaw)) {
		reviewFrequencyDays = Math.round(freqRaw);
	} else if (typeof freqRaw === "string" && /^\d+$/.test(freqRaw.trim())) {
		reviewFrequencyDays = Number.parseInt(freqRaw, 10);
	}
	return {
		launchDate: launch,
		lastReviewed,
		nextReview,
		reviewFrequencyDays,
		jira: fmString(fm, s.projectJiraField),
		description: fmString(fm, "description"),
	};
}
