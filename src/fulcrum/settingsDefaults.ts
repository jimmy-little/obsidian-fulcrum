export type TaskSourceMode = "taskNotes" | "obsidianTasks" | "both";
export type ProjectStatusIndication = "frontmatter" | "subfolder";
export type ProjectSidebarSortBy = "launch" | "nextReview" | "rank";
export type ProjectSidebarSortDir = "asc" | "desc";

export interface FulcrumSettings {
	areasProjectsFolder: string;
	meetingsFolder: string;
	completedProjectsFolder: string;
	/** When true, markdown under the areas/projects folder is a project unless `type` is the area value. */
	inferProjectsInAreasFolder: boolean;

	typeField: string;
	areaTypeValue: string;
	projectTypeValue: string;
	projectLinkField: string;
	areaLinkField: string;
	taskStatusField: string;
	taskPriorityField: string;
	taskDueDateField: string;
	taskScheduledDateField: string;
	taskCompletedDateField: string;
	taskTrackedMinutesField: string;
	taskTitleField: string;
	taskNoteYamlStatusOpen: string;
	taskNoteYamlStatusDone: string;
	meetingDateField: string;
	meetingDurationField: string;
	meetingTotalMinutesField: string;
	meetingTitleField: string;

	taskSourceMode: TaskSourceMode;
	/** Multi-line or comma-separated; empty = whole vault. */
	taskNotesFolderPaths: string;
	obsidianTasksFolderPaths: string;
	inlineTaskRegex: string;
	tasksPluginMode: "auto-detect" | "off" | "force";

	taskNotesHttpApiEnabled: boolean;
	taskNotesHttpApiBaseUrl: string;
	taskNotesHttpApiToken: string;

	taskTag: string;
	taskStatuses: string;
	projectStatuses: string;
	priorities: string;
	taskDoneStatuses: string;
	projectActiveStatuses: string;
	projectDoneStatuses: string;

	defaultProjectView: "summary" | "board";
	openViewsIn: "main" | "sidebar";
	showRibbonIcon: boolean;
	dateDisplayFormat: string;
	completionThresholdPercent: number;
	dashboardActiveProjectsGroupBy: "area" | "status";
	projectSidebarSortBy: ProjectSidebarSortBy;
	projectSidebarSortDir: ProjectSidebarSortDir;

	projectStatusIndication: ProjectStatusIndication;
	projectStatusField: string;

	/** Frontmatter keys on the project note (review / launch). */
	projectLaunchDateField: string;
	/** Frontmatter key for numeric rank (higher = more important). */
	projectRankField: string;
	projectLastReviewedField: string;
	projectReviewFrequencyField: string;
	projectNextReviewField: string;
	projectJiraField: string;
	/** When project note has no review frequency in frontmatter. */
	defaultReviewFrequencyDays: number;
	/** One vault folder per line or comma-separated; matches `folder/YYYY/...` and `folder/...`. */
	atomicNoteFolderPrefixes: string;
	/** Frontmatter key and inline `key::` for primary line on linked notes. */
	atomicNoteEntryField: string;
	/** Markdown heading Fulcrum creates/uses when appending log lines to the project file. */
	projectLogSectionHeading: string;
	projectLogPreviewMaxLines: number;

	projectBannerField: string;
	projectColorField: string;
}

export const DEFAULT_SETTINGS: FulcrumSettings = {
	areasProjectsFolder: "40 Projects",
	meetingsFolder: "30 Work/Meetings",
	completedProjectsFolder: "40 Projects/Completed",
	inferProjectsInAreasFolder: true,

	typeField: "type",
	areaTypeValue: "area",
	projectTypeValue: "project",
	projectLinkField: "project",
	areaLinkField: "area",
	taskStatusField: "status",
	taskPriorityField: "priority",
	taskDueDateField: "dueDate",
	taskScheduledDateField: "scheduled",
	taskCompletedDateField: "completedDate",
	taskTrackedMinutesField: "totalMinutesTracked",
	taskTitleField: "title",
	taskNoteYamlStatusOpen: "NONE",
	taskNoteYamlStatusDone: "DONE",
	meetingDateField: "date",
	meetingDurationField: "duration",
	meetingTotalMinutesField: "totalMinutesTracked",
	meetingTitleField: "entry",

	taskSourceMode: "both",
	taskNotesFolderPaths: "35 Tasks/TaskNotes",
	obsidianTasksFolderPaths: "",
	inlineTaskRegex: "",
	tasksPluginMode: "auto-detect",

	taskNotesHttpApiEnabled: false,
	taskNotesHttpApiBaseUrl: "http://localhost:8080",
	taskNotesHttpApiToken: "",

	taskTag: "task",
	taskStatuses: "todo, in-progress, done, cancelled",
	projectStatuses: "planning, active, on-hold, completed, archived",
	priorities: "high, medium, low",
	taskDoneStatuses: "done, completed",
	projectActiveStatuses: "planning, active, on-hold",
	projectDoneStatuses: "completed, archived",

	defaultProjectView: "summary",
	openViewsIn: "main",
	showRibbonIcon: true,
	dateDisplayFormat: "YYYY-MM-DD",
	completionThresholdPercent: 100,
	dashboardActiveProjectsGroupBy: "area",
	projectSidebarSortBy: "launch",
	projectSidebarSortDir: "asc",

	projectStatusIndication: "frontmatter",
	projectStatusField: "status",

	projectLaunchDateField: "launchDate",
	projectRankField: "rank",
	projectLastReviewedField: "lastReviewed",
	projectReviewFrequencyField: "reviewFrequency",
	projectNextReviewField: "nextReview",
	projectJiraField: "jira",
	defaultReviewFrequencyDays: 7,
	atomicNoteFolderPrefixes:
		"60 Logs\n70 Journal/Atomic\n30 Work/Meetings\n30 Work/Notes",
	atomicNoteEntryField: "entry",
	projectLogSectionHeading: "## Fulcrum log",
	projectLogPreviewMaxLines: 12,

	projectBannerField: "banner",
	projectColorField: "color",
};

export function parseList(s: string): string[] {
	return s
		.split(",")
		.map((x) => x.trim().toLowerCase())
		.filter(Boolean);
}
