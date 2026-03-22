export interface FulcrumSettings {
	areasProjectsFolder: string;
	taskNotesFolder: string;
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
	taskCompletedDateField: string;
	taskTitleField: string;
	meetingDateField: string;
	meetingDurationField: string;
	meetingTotalMinutesField: string;
	meetingTitleField: string;

	taskNotesEnabled: boolean;
	inlineTasksEnabled: boolean;
	inlineTaskRegex: string;
	tasksPluginMode: "auto-detect" | "off" | "force";

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

	/** Frontmatter keys on the project note (review / launch). */
	projectLaunchDateField: string;
	projectLastReviewedField: string;
	projectReviewFrequencyField: string;
	projectNextReviewField: string;
	projectJiraField: string;
	/** When project note has no review frequency in frontmatter. */
	defaultReviewFrequencyDays: number;
	/** One vault folder per line or comma-separated; matches `folder/YYYY/...` and `folder/...`. */
	atomicNoteFolderPrefixes: string;
	/** Markdown heading Fulcrum creates/uses when appending log lines to the project file. */
	projectLogSectionHeading: string;
	projectLogPreviewMaxLines: number;

	projectBannerField: string;
	projectColorField: string;
}

export const DEFAULT_SETTINGS: FulcrumSettings = {
	areasProjectsFolder: "40 Projects",
	taskNotesFolder: "35 Tasks/TaskNotes",
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
	taskCompletedDateField: "completedDate",
	taskTitleField: "title",
	meetingDateField: "date",
	meetingDurationField: "duration",
	meetingTotalMinutesField: "totalMinutesTracked",
	meetingTitleField: "entry",

	taskNotesEnabled: true,
	inlineTasksEnabled: true,
	inlineTaskRegex: "",
	tasksPluginMode: "auto-detect",

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

	projectLaunchDateField: "launchDate",
	projectLastReviewedField: "lastReviewed",
	projectReviewFrequencyField: "reviewFrequency",
	projectNextReviewField: "nextReview",
	projectJiraField: "jira",
	defaultReviewFrequencyDays: 7,
	atomicNoteFolderPrefixes:
		"60 Logs\n70 Journal/Atomic\n30 Work/Meetings\n30 Work/Notes",
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
