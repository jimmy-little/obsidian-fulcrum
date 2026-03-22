import {App, PluginSettingTab, Setting} from "obsidian";
import type {FulcrumSettings} from "./fulcrum/settingsDefaults";
import type FulcrumPlugin from "./main";

export type {FulcrumSettings} from "./fulcrum/settingsDefaults";
export {DEFAULT_SETTINGS} from "./fulcrum/settingsDefaults";

function heading(containerEl: HTMLElement, text: string): void {
	containerEl.createEl("h3", {text, cls: "fulcrum-settings-heading"});
}

export class FulcrumSettingTab extends PluginSettingTab {
	plugin: FulcrumPlugin;

	constructor(app: App, plugin: FulcrumPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		containerEl.createEl("p", {
			text: "Fulcrum indexes areas, projects, task notes, and meetings from your vault using configurable folders and frontmatter keys.",
			cls: "fulcrum-settings-lead",
		});

		heading(containerEl, "Folders");
		this.textSetting("areasProjectsFolder", "Areas & projects folder");
		this.textSetting("taskNotesFolder", "Task notes folder");
		this.textSetting("meetingsFolder", "Meetings folder root");
		this.textSetting("completedProjectsFolder", "Completed projects folder");
		this.toggleSetting(
			"inferProjectsInAreasFolder",
			"Infer projects without type field",
			"When on, every note under the areas & projects folder is treated as a project unless its type is the area value. Turn off to require an explicit project type in frontmatter.",
		);

		heading(containerEl, "Frontmatter keys");
		this.textSetting("typeField", "Note type field");
		this.textSetting("areaTypeValue", "Area type value");
		this.textSetting("projectTypeValue", "Project type value");
		this.textSetting("projectLinkField", "Project link field");
		this.textSetting("areaLinkField", "Area link field");
		this.textSetting("taskStatusField", "Task status field");
		this.textSetting("taskPriorityField", "Task / project priority field");
		this.textSetting("taskDueDateField", "Task due date field");
		this.textSetting("taskCompletedDateField", "Task completed date field");
		this.textSetting("taskTitleField", "Task title field");
		this.textSetting("meetingDateField", "Meeting date field");
		this.textSetting("meetingDurationField", "Meeting duration field");
		this.textSetting("meetingTotalMinutesField", "Meeting total minutes field");
		this.textSetting("meetingTitleField", "Meeting title field");

		heading(containerEl, "Task sources");
		this.toggleSetting("taskNotesEnabled", "Enable task notes");
		this.toggleSetting("inlineTasksEnabled", "Enable inline tasks (scanning not wired yet)");
		this.textSetting("inlineTaskRegex", "Inline task regex (optional)");
		new Setting(containerEl)
			.setName("Tasks plugin integration")
			.setDesc("Reserved for tasks plugin API detection.")
			.addDropdown((d) =>
				d
					.addOptions({
						"auto-detect": "Auto-detect",
						off: "Off",
						force: "Force",
					})
					.setValue(this.plugin.settings.tasksPluginMode)
					.onChange(async (v) => {
						this.plugin.settings.tasksPluginMode = v as FulcrumSettings["tasksPluginMode"];
						await this.plugin.saveSettings();
					}),
			);

		heading(containerEl, "Status & priority vocab");
		this.textSetting("taskTag", "Task tag (YAML tags array)");
		this.textSetting("taskStatuses", "Task statuses (comma-separated)");
		this.textSetting("projectStatuses", "Project statuses (comma-separated)");
		this.textSetting("priorities", "Priorities (comma-separated)");
		this.textSetting("taskDoneStatuses", "Task done statuses (comma-separated)");
		this.textSetting("projectActiveStatuses", "Project active statuses (comma-separated)");
		this.textSetting("projectDoneStatuses", "Project done / inactive statuses (comma-separated)");

		heading(containerEl, "Project page");
		this.textSetting("projectLaunchDateField", "Launch / target date field");
		this.textSetting("projectLastReviewedField", "Last reviewed field");
		this.textSetting("projectReviewFrequencyField", "Review frequency field (days)");
		this.textSetting("projectNextReviewField", "Next review field");
		this.textSetting("projectJiraField", "External link field (e.g. Jira)");
		this.textSetting("projectBannerField", "Banner image field");
		this.textSetting("projectColorField", "Project color field");
		new Setting(containerEl)
			.setName("Default review frequency (days)")
			.setDesc("Used when the project note has no frequency in frontmatter.")
			.addSlider((sl) =>
				sl
					.setLimits(1, 90, 1)
					.setValue(this.plugin.settings.defaultReviewFrequencyDays)
					.setDynamicTooltip()
					.onChange(async (v) => {
						this.plugin.settings.defaultReviewFrequencyDays = v;
						await this.plugin.saveSettings();
					}),
			);
		this.textAreaSetting(
			"atomicNoteFolderPrefixes",
			"Atomic note folder prefixes",
			"One folder per line or comma-separated. Matches that path plus the current year (e.g. 60 Logs → 60 Logs/2026/…).",
		);
		this.textSetting("projectLogSectionHeading", "Project log section heading");
		new Setting(containerEl)
			.setName("Project log preview lines")
			.addSlider((sl) =>
				sl
					.setLimits(3, 30, 1)
					.setValue(this.plugin.settings.projectLogPreviewMaxLines)
					.setDynamicTooltip()
					.onChange(async (v) => {
						this.plugin.settings.projectLogPreviewMaxLines = v;
						await this.plugin.saveSettings();
					}),
			);

		heading(containerEl, "Display");
		new Setting(containerEl)
			.setName("Default project view")
			.addDropdown((d) =>
				d
					.addOptions({summary: "Summary", board: "Board (coming soon)"})
					.setValue(this.plugin.settings.defaultProjectView)
					.onChange(async (v) => {
						this.plugin.settings.defaultProjectView = v as FulcrumSettings["defaultProjectView"];
						await this.plugin.saveSettings();
					}),
			);
		new Setting(containerEl)
			.setName("Open views in")
			.addDropdown((d) =>
				d
					.addOptions({main: "Main area (new tab)", sidebar: "Right sidebar"})
					.setValue(this.plugin.settings.openViewsIn)
					.onChange(async (v) => {
						this.plugin.settings.openViewsIn = v as FulcrumSettings["openViewsIn"];
						await this.plugin.saveSettings();
					}),
			);
		this.toggleSetting("showRibbonIcon", "Show dashboard ribbon icon");
		this.textSetting("dateDisplayFormat", "Date display format (reserved)");
		new Setting(containerEl)
			.setName("Completion threshold %")
			.setDesc("Used later for project health.")
			.addSlider((sl) =>
				sl
					.setLimits(0, 100, 5)
					.setValue(this.plugin.settings.completionThresholdPercent)
					.setDynamicTooltip()
					.onChange(async (v) => {
						this.plugin.settings.completionThresholdPercent = v;
						await this.plugin.saveSettings();
					}),
			);
	}

	private textAreaSetting<K extends keyof FulcrumSettings>(
		key: K,
		name: string,
		desc?: string,
	): void {
		const row = new Setting(this.containerEl).setName(name);
		if (desc) row.setDesc(desc);
		const v = this.plugin.settings[key];
		const str = typeof v === "string" ? v : String(v);
		row.addTextArea((ta) => {
			ta.inputEl.rows = 5;
			ta.setValue(str).onChange(async (value) => {
				(this.plugin.settings as unknown as Record<string, unknown>)[key as string] = value;
				await this.plugin.saveSettings();
				this.plugin.vaultIndex.scheduleRebuild();
			});
		});
	}

	private textSetting<K extends keyof FulcrumSettings>(key: K, name: string): void {
		const v = this.plugin.settings[key];
		const str = typeof v === "string" ? v : String(v);
		new Setting(this.containerEl).setName(name).addText((t) =>
			t.setValue(str).onChange(async (value) => {
				(this.plugin.settings as unknown as Record<string, unknown>)[key as string] = value;
				await this.plugin.saveSettings();
				this.plugin.vaultIndex.scheduleRebuild();
			}),
		);
	}

	private toggleSetting<K extends keyof FulcrumSettings>(
		key: K,
		name: string,
		desc?: string,
	): void {
		const row = new Setting(this.containerEl).setName(name);
		if (desc) row.setDesc(desc);
		row.addToggle((tg) =>
			tg.setValue(Boolean(this.plugin.settings[key])).onChange(async (value) => {
				(this.plugin.settings as unknown as Record<string, unknown>)[key as string] = value;
				await this.plugin.saveSettings();
				this.plugin.vaultIndex.scheduleRebuild();
			}),
		);
	}
}

