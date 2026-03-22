import type {TFile} from "obsidian";

export interface IndexedArea {
	file: TFile;
	name: string;
	status?: string;
	color?: string;
	icon?: string;
	description?: string;
}

export interface IndexedProject {
	file: TFile;
	name: string;
	status: string;
	priority?: string;
	startDate?: string;
	dueDate?: string;
	completedDate?: string;
	areaFile: TFile | null;
	areaName?: string;
	/** Raw frontmatter (wikilink, URL, or path) for banner image. */
	banner?: string;
	/** Raw frontmatter color token or CSS color. */
	color?: string;
	/** From project note frontmatter `description`. */
	description?: string;
	/** Next review date (ISO), from configured frontmatter field. */
	nextReview?: string;
	/** YYYY-MM-DD (or raw prefix) from launch / target date field; sidebar sort. */
	launchDate?: string;
	/** From configurable frontmatter key; higher = more important. */
	rank?: number;
}

export interface IndexedTask {
	file: TFile;
	title: string;
	status: string;
	priority?: string;
	dueDate?: string;
	scheduledDate?: string;
	completedDate?: string;
	projectFile: TFile | null;
	areaFile: TFile | null;
	tags: string[];
	createdAtMs: number;
	source: "taskNote" | "inline";
	/** 0-based line for inline checkbox tasks. */
	line?: number;
	trackedMinutes: number;
}

export interface IndexedMeeting {
	file: TFile;
	date?: string;
	title?: string;
	duration?: number;
	totalMinutesTracked?: number;
	projectFile: TFile | null;
}

export interface AtomicNoteRow {
	file: TFile;
	status?: string;
	dateSort: string;
	dateDisplay: string;
	trackedMinutes: number;
	/** Primary label for the row (entry / heading / basename). */
	entryTitle: string;
	noteType?: string;
	bodyPreview?: string;
	tags: string[];
	priority?: string;
	/** Vault file mtime for activity ordering (newest-first feeds). */
	modifiedMs: number;
}

export interface ProjectPageMeta {
	launchDate?: string;
	lastReviewed?: string;
	nextReview?: string;
	reviewFrequencyDays: number;
	jira?: string;
	description?: string;
}

export interface ProjectRollup {
	project: IndexedProject;
	tasks: IndexedTask[];
	meetings: IndexedMeeting[];
	/** TaskNotes (and similar) linked to this project. */
	atomicNotes: AtomicNoteRow[];
	totalTasks: number;
	doneTasks: number;
	openTasks: number;
	overdueTasks: number;
	completionRatio: number;
	nextTasks: IndexedTask[];
	/** Task + atomic + project self + meetings (tracked minutes if set, else duration estimate). */
	aggregatedTrackedMinutes: number;
	pageMeta: ProjectPageMeta;

	bannerImageSrc: string | null;
	/** Resolved CSS color for accents, charts, and solid banner fallback. */
	accentColorCss: string;
	hasBannerImage: boolean;
	hasProjectColor: boolean;
}

export interface IndexSnapshot {
	areas: IndexedArea[];
	projects: IndexedProject[];
	tasks: IndexedTask[];
	meetings: IndexedMeeting[];
	rebuiltAt: number;
}
