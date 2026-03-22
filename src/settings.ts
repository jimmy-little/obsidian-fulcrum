import {App, Notice, PluginSettingTab, Setting} from "obsidian";
import {getTaskNotesHealth} from "./fulcrum/taskNotesApi";
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
		this.textSetting("meetingsFolder", "Meetings folder root");
		this.textSetting("completedProjectsFolder", "Completed projects folder");
		this.toggleSetting(
			"inferProjectsInAreasFolder",
			"Infer projects without type field",
			"When on, every note under the areas & projects folder is treated as a project unless its type is the area value. Turn off to require an explicit project type in frontmatter.",
		);
		new Setting(containerEl)
			.setName("Indicate project status by")
			.setDesc(
				"Whether Fulcrum reads each project’s status from frontmatter or from the folder layout under your areas & projects path.",
			)
			.addDropdown((d) =>
				d
					.addOptions({
						frontmatter: "Frontmatter field",
						subfolder: "Subfolder",
					})
					.setValue(this.plugin.settings.projectStatusIndication)
					.onChange(async (v) => {
						this.plugin.settings.projectStatusIndication = v as FulcrumSettings["projectStatusIndication"];
						await this.plugin.saveSettings();
						this.plugin.vaultIndex.scheduleRebuild();
						this.display();
					}),
			);
		if (this.plugin.settings.projectStatusIndication === "frontmatter") {
			this.textSetting(
				"projectStatusField",
				"Project status field",
			);
		} else {
			containerEl.createEl("p", {
				cls: "fulcrum-settings-lead",
				text: "Each immediate subfolder of your areas & projects folder is a status bucket. Notes directly in that folder use status “active” until you move them.",
			});
		}

		heading(containerEl, "Frontmatter keys");
		this.textSetting("typeField", "Note type field");
		this.textSetting("areaTypeValue", "Area type value");
		this.textSetting("projectTypeValue", "Project type value");
		this.textSetting("projectLinkField", "Project link field");
		this.textSetting("areaLinkField", "Area link field");
		this.textSetting("taskStatusField", "Task status field");
		this.textSetting("taskPriorityField", "Task / project priority field");
		this.textSetting("taskDueDateField", "Task due date field");
		this.textSetting("taskScheduledDateField", "Task scheduled date field");
		this.textSetting("taskCompletedDateField", "Task completed date field");
		this.textSetting("taskTrackedMinutesField", "Task tracked minutes field");
		this.textSetting("taskTitleField", "Task title field");
		this.textSetting("taskNoteYamlStatusOpen", "Task note status when open (vault fallback)");
		this.textSetting("taskNoteYamlStatusDone", "Task note status when done (vault fallback)");
		this.textSetting("meetingDateField", "Meeting date field");
		this.textSetting("meetingDurationField", "Meeting duration field");
		this.textSetting("meetingTotalMinutesField", "Meeting total minutes field");
		this.textSetting("meetingTitleField", "Meeting title field");

		heading(containerEl, "Tasks");
		new Setting(containerEl)
			.setName("Task sources")
			.setDesc(
				"Task notes: dedicated notes with your task tag or type: task. Obsidian tasks: markdown checkbox list items (- [ ]). Leave folder fields empty to scan the whole vault.",
			)
			.addDropdown((d) =>
				d
					.addOptions({
						taskNotes: "Task notes only",
						obsidianTasks: "Obsidian Tasks (inline) only",
						both: "Both",
					})
					.setValue(this.plugin.settings.taskSourceMode)
					.onChange(async (v) => {
						this.plugin.settings.taskSourceMode = v as FulcrumSettings["taskSourceMode"];
						await this.plugin.saveSettings();
						this.plugin.vaultIndex.scheduleRebuild();
					}),
			);
		this.textAreaSetting(
			"taskNotesFolderPaths",
			"Task notes folders",
			"Vault-relative paths, one per line or comma-separated. Empty = entire vault.",
		);
		this.textAreaSetting(
			"obsidianTasksFolderPaths",
			"Inline task folders",
			"Only markdown files under these paths are scanned for - [ ] tasks. Empty = entire vault.",
		);
		this.textSetting("inlineTaskRegex", "Inline task filter (regex, optional)");
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

		new Setting(containerEl)
			.setName("TaskNotes HTTP API")
			.setDesc(
				"Desktop only. When enabled, Fulcrum can call TaskNotes’ local server (e.g. toggle-status). Enable the API in TaskNotes → Integrations. Docs: https://tasknotes.dev/HTTP_API/",
			)
			.addToggle((t) =>
				t.setValue(this.plugin.settings.taskNotesHttpApiEnabled).onChange(async (v) => {
					this.plugin.settings.taskNotesHttpApiEnabled = v;
					await this.plugin.saveSettings();
				}),
			);
		this.textSetting("taskNotesHttpApiBaseUrl", "TaskNotes API base URL");
		const tokenRow = new Setting(containerEl).setName("TaskNotes API token (optional)");
		tokenRow.addText((tx) => {
			tx.inputEl.type = "password";
			tx.setPlaceholder("Bearer token if set in TaskNotes").setValue(
				this.plugin.settings.taskNotesHttpApiToken,
			);
			tx.onChange(async (v) => {
				this.plugin.settings.taskNotesHttpApiToken = v;
				await this.plugin.saveSettings();
			});
		});
		tokenRow.addButton((b) =>
			b.setButtonText("Test connection").onClick(async () => {
				b.setDisabled(true);
				const ac = new AbortController();
				const to = window.setTimeout(() => ac.abort(), 10_000);
				try {
					const r = await getTaskNotesHealth(
						this.plugin.settings.taskNotesHttpApiBaseUrl,
						this.plugin.settings.taskNotesHttpApiToken || undefined,
						ac.signal,
					);
					new Notice(r.ok ? "TaskNotes API reachable." : (r.error ?? "TaskNotes API check failed."));
				} finally {
					window.clearTimeout(to);
					b.setDisabled(false);
				}
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
		new Setting(containerEl)
			.setName("Linked note title field")
			.setDesc("Frontmatter key and inline key:: for the primary line on project linked notes (often entry).")
			.addText((t) =>
				t.setValue(this.plugin.settings.atomicNoteEntryField).onChange(async (v) => {
					this.plugin.settings.atomicNoteEntryField = v;
					await this.plugin.saveSettings();
					this.plugin.vaultIndex.scheduleRebuild();
				}),
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
			.setName("Dashboard active projects group by")
			.setDesc("Default grouping on the Fulcrum dashboard (you can also change it from the dashboard).")
			.addDropdown((d) =>
				d
					.addOptions({area: "Group by area", status: "Group by status"})
					.setValue(this.plugin.settings.dashboardActiveProjectsGroupBy)
					.onChange(async (v) => {
						this.plugin.settings.dashboardActiveProjectsGroupBy = v as FulcrumSettings["dashboardActiveProjectsGroupBy"];
						await this.plugin.saveSettings();
					}),
			);
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

		containerEl.createEl("p", {
			cls: "fulcrum-settings-lead",
			text: "Install into a vault: add a repo-root file fulcrum-vault.path with your vault path (see fulcrum-vault.path.example), then npm run build:install — or pass the path after -- : npm run build:install -- \"/path/to/Vault\"",
		});
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

