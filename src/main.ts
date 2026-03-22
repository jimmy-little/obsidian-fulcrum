import {Notice, Platform, Plugin, TFile, type WorkspaceLeaf} from "obsidian";
import {
	appendFulcrumProjectLog,
	formatFulcrumProjectLogLine,
	markProjectReviewDates,
	parseProjectLogLines,
	readFulcrumLogTail,
	type ProjectLogActivityEntry,
} from "./fulcrum/projectNote";
import {FULCRUM_HOVER_SOURCE, VIEW_DASHBOARD, VIEW_PROJECT, VIEW_PROJECT_MANAGER} from "./fulcrum/constants";
import {LinkMeetingModal, NewProjectModal, ProjectPickerModal} from "./fulcrum/modals";
import type {FulcrumHost} from "./fulcrum/pluginBridge";
import {openProjectSummaryLeaf, revealOrCreateDashboard} from "./fulcrum/openViews";
import {DEFAULT_SETTINGS, type FulcrumSettings} from "./fulcrum/settingsDefaults";
import {postTaskNotesToggleStatus} from "./fulcrum/taskNotesApi";
import {toggleInlineTaskLine, toggleTaskNoteFrontmatter} from "./fulcrum/taskVaultToggle";
import type {IndexedTask} from "./fulcrum/types";
import {VaultIndex} from "./fulcrum/VaultIndex";
import {FulcrumSettingTab} from "./settings";
import {DashboardView} from "./views/DashboardView";
import {ProjectManagerView} from "./views/ProjectManagerView";
import {ProjectView} from "./views/ProjectView";

export default class FulcrumPlugin extends Plugin implements FulcrumHost {
	settings: FulcrumSettings = DEFAULT_SETTINGS;
	vaultIndex!: VaultIndex;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.vaultIndex = new VaultIndex(this.app, () => this.settings);

		this.registerView(VIEW_PROJECT_MANAGER, (leaf) => new ProjectManagerView(leaf, this));
		this.registerView(VIEW_DASHBOARD, (leaf) => new DashboardView(leaf, this));
		this.registerView(VIEW_PROJECT, (leaf) => new ProjectView(leaf, this));

		this.registerHoverLinkSource(FULCRUM_HOVER_SOURCE, {
			display: this.manifest.name,
			defaultMod: false,
		});

		this.registerEvent(
			this.app.metadataCache.on("resolve", () => {
				this.vaultIndex.scheduleRebuild();
			}),
		);
		this.registerEvent(
			this.app.metadataCache.on("resolved", () => {
				this.vaultIndex.scheduleRebuild();
			}),
		);
		this.registerEvent(
			this.app.metadataCache.on("changed", () => {
				this.vaultIndex.scheduleRebuild();
			}),
		);
		this.registerEvent(
			this.app.vault.on("create", () => {
				this.vaultIndex.scheduleRebuild();
			}),
		);
		this.registerEvent(
			this.app.vault.on("delete", () => {
				this.vaultIndex.scheduleRebuild();
			}),
		);
		this.registerEvent(
			this.app.vault.on("rename", () => {
				this.vaultIndex.scheduleRebuild();
			}),
		);
		this.registerEvent(
			this.app.vault.on("modify", (f) => {
				if (f instanceof TFile && f.extension === "md") {
					this.vaultIndex.scheduleRebuild();
				}
			}),
		);

		this.app.workspace.onLayoutReady(() => {
			void this.vaultIndex.rebuild();
		});

		void this.vaultIndex.rebuild();
		const deferredRebuild = window.setTimeout(() => {
			void this.vaultIndex.rebuild();
		}, 750);
		this.register(() => window.clearTimeout(deferredRebuild));

		this.addSettingTab(new FulcrumSettingTab(this.app, this));

		if (this.settings.showRibbonIcon) {
			this.addRibbonIcon("layout-dashboard", "Fulcrum Project Manager", () => {
				void this.openDashboard();
			});
		}

		this.addCommand({
			id: "open-dashboard",
			name: "Open Project Manager",
			callback: () => {
				void this.openDashboard();
			},
		});
		this.addCommand({
			id: "open-project-summary",
			name: "Open project summary",
			callback: () => {
				const projects = this.vaultIndex.getSnapshot().projects;
				if (projects.length === 0) {
					new Notice("No projects in the index yet.");
					return;
				}
				new ProjectPickerModal(this.app, projects, (p) => {
					void this.openProjectSummary(p.file.path);
				}).open();
			},
		});
		this.addCommand({
			id: "new-project",
			name: "New project",
			callback: () => {
				new NewProjectModal(this.app, this).open();
			},
		});
		this.addCommand({
			id: "link-meeting-to-project",
			name: "Link meeting to project",
			callback: () => {
				const file = this.app.workspace.getActiveFile();
				if (!file) {
					new Notice("Open a meeting note first.");
					return;
				}
				const projects = this.vaultIndex.getSnapshot().projects;
				if (projects.length === 0) {
					new Notice("No projects in the index yet.");
					return;
				}
				new LinkMeetingModal(this.app, this, file).open();
			},
		});
		this.addCommand({
			id: "reindex",
			name: "Reindex vault",
			callback: () => {
				void this.refreshIndex();
			},
		});

	}

	onunload(): void {
		this.vaultIndex.cancelScheduledRebuild();
	}

	async loadSettings(): Promise<void> {
		const raw = (await this.loadData()) as Record<string, unknown> | null;
		const loaded = raw ?? {};
		const merged = {...DEFAULT_SETTINGS, ...loaded} as FulcrumSettings & Record<string, unknown>;

		const pathsRaw =
			typeof merged.taskNotesFolderPaths === "string" ? merged.taskNotesFolderPaths.trim() : "";
		const legacyFolder =
			typeof loaded.taskNotesFolder === "string" ? loaded.taskNotesFolder.trim() : "";
		if (!pathsRaw && legacyFolder) {
			merged.taskNotesFolderPaths = legacyFolder;
		}

		const mode = merged.taskSourceMode;
		if (mode !== "taskNotes" && mode !== "obsidianTasks" && mode !== "both") {
			const l = loaded.taskNotesEnabled !== false;
			const a = loaded.inlineTasksEnabled !== false;
			merged.taskSourceMode = l && a ? "both" : l ? "taskNotes" : a ? "obsidianTasks" : "both";
		}

		delete (merged as Record<string, unknown>).taskNotesFolder;
		delete (merged as Record<string, unknown>).taskNotesEnabled;
		delete (merged as Record<string, unknown>).inlineTasksEnabled;

		if (
			merged.projectStatusIndication !== "subfolder" &&
			merged.projectStatusIndication !== "frontmatter"
		) {
			merged.projectStatusIndication = DEFAULT_SETTINGS.projectStatusIndication;
		}
		if (
			merged.dashboardActiveProjectsGroupBy !== "area" &&
			merged.dashboardActiveProjectsGroupBy !== "status"
		) {
			merged.dashboardActiveProjectsGroupBy = DEFAULT_SETTINGS.dashboardActiveProjectsGroupBy;
		}
		if (
			merged.projectSidebarSortBy !== "launch" &&
			merged.projectSidebarSortBy !== "nextReview" &&
			merged.projectSidebarSortBy !== "rank"
		) {
			merged.projectSidebarSortBy = DEFAULT_SETTINGS.projectSidebarSortBy;
		}
		if (merged.projectSidebarSortDir !== "asc" && merged.projectSidebarSortDir !== "desc") {
			merged.projectSidebarSortDir = DEFAULT_SETTINGS.projectSidebarSortDir;
		}
		if (typeof merged.projectRankField !== "string") {
			merged.projectRankField = DEFAULT_SETTINGS.projectRankField;
		}

		this.settings = merged as FulcrumSettings;
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	async patchSettings(partial: Partial<FulcrumSettings>): Promise<void> {
		Object.assign(this.settings, partial);
		await this.saveData(this.settings);
	}

	openIndexedTask(task: IndexedTask): void {
		const f = this.app.vault.getAbstractFileByPath(task.file.path);
		if (!(f instanceof TFile)) return;
		const leaf = this.app.workspace.getLeaf("tab");
		if (task.source === "inline" && task.line != null) {
			void leaf.openFile(f, {
				active: true,
				state: {line: task.line},
				eState: {line: task.line},
			});
		} else {
			void leaf.openFile(f);
		}
	}

	async toggleIndexedTask(task: IndexedTask): Promise<void> {
		if (!Platform.isDesktop) return;
		try {
			let apiOk = false;
			if (task.source === "taskNote" && this.settings.taskNotesHttpApiEnabled) {
				const ac = new AbortController();
				const to = window.setTimeout(() => ac.abort(), 12_000);
				try {
					const r = await postTaskNotesToggleStatus(
						this.settings.taskNotesHttpApiBaseUrl,
						this.settings.taskNotesHttpApiToken || undefined,
						task.file.path,
						ac.signal,
					);
					apiOk = r.ok;
					if (!apiOk) console.warn("Fulcrum TaskNotes API:", r.error);
				} finally {
					window.clearTimeout(to);
				}
			}
			if (!apiOk) {
				if (task.source === "taskNote") {
					await toggleTaskNoteFrontmatter(this.app, task, this.settings);
				} else {
					await toggleInlineTaskLine(this.app, task);
				}
			}
			await this.vaultIndex.rebuild();
		} catch (e) {
			console.error(e);
			new Notice("Could not update task.");
		}
	}

	triggerFulcrumHoverLink(
		event: MouseEvent,
		hoverParent: WorkspaceLeaf,
		targetEl: HTMLElement,
		path: string,
	): void {
		this.app.workspace.trigger("hover-link", {
			event,
			source: FULCRUM_HOVER_SOURCE,
			hoverParent,
			targetEl,
			linktext: path,
			sourcePath: path,
		});
	}

	async openDashboard(): Promise<void> {
		await revealOrCreateDashboard(this.app, this.settings);
	}

	async openProjectSummary(path: string): Promise<void> {
		await openProjectSummaryLeaf(this.app, this.settings, path);
	}

	async refreshIndex(): Promise<void> {
		await this.vaultIndex.rebuild();
		new Notice("Fulcrum index rebuilt.");
	}

	async appendProjectLogEntry(projectPath: string, text: string): Promise<void> {
		const trimmed = text.trim();
		if (!trimmed) {
			new Notice("Write something to add to the project note.");
			return;
		}
		const f = this.app.vault.getAbstractFileByPath(projectPath);
		if (!(f instanceof TFile)) {
			new Notice("Project file not found.");
			return;
		}
		const stamp = new Date().toLocaleString(undefined, {
			dateStyle: "short",
			timeStyle: "short",
		});
		const line = `- ${stamp} — ${trimmed.replace(/\s+/g, " ")}`;
		try {
			await appendFulcrumProjectLog(
				this.app,
				f,
				this.settings.projectLogSectionHeading,
				line,
			);
			await this.vaultIndex.rebuild();
			new Notice("Appended to project note.");
		} catch (e) {
			console.error(e);
			new Notice("Could not write to the project note.");
		}
	}

	async markProjectReviewed(projectPath: string): Promise<void> {
		const f = this.app.vault.getAbstractFileByPath(projectPath);
		if (!(f instanceof TFile)) {
			new Notice("Project file not found.");
			return;
		}
		try {
			await markProjectReviewDates(this.app, f, this.settings);
			await this.vaultIndex.rebuild();
			new Notice("Review dates updated.");
		} catch (e) {
			console.error(e);
			new Notice("Could not update review fields.");
		}
	}

	async loadProjectLogPreview(projectPath: string): Promise<string[]> {
		const f = this.app.vault.getAbstractFileByPath(projectPath);
		if (!(f instanceof TFile)) return [];
		return readFulcrumLogTail(
			this.app,
			f,
			this.settings.projectLogSectionHeading,
			this.settings.projectLogPreviewMaxLines,
		);
	}

	async loadProjectLogActivity(projectPath: string): Promise<ProjectLogActivityEntry[]> {
		const f = this.app.vault.getAbstractFileByPath(projectPath);
		if (!(f instanceof TFile)) return [];
		const raw = await readFulcrumLogTail(
			this.app,
			f,
			this.settings.projectLogSectionHeading,
			this.settings.projectLogPreviewMaxLines,
		);
		return parseProjectLogLines(raw, f.stat.mtime);
	}

	notifyNewNoteFromProject(_projectPath: string): void {
		new Notice("New note from project will be available in a future update.");
	}

	notifyNewTaskFromProject(_projectPath: string): void {
		new Notice("New task from project will be available in a future update.");
	}

}
