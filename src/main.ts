import {Notice, Plugin, TFile} from "obsidian";
import {
	appendFulcrumProjectLog,
	markProjectReviewDates,
	readFulcrumLogTail,
} from "./fulcrum/projectNote";
import {VIEW_DASHBOARD, VIEW_PROJECT} from "./fulcrum/constants";
import {LinkMeetingModal, NewProjectModal, ProjectPickerModal} from "./fulcrum/modals";
import type {FulcrumHost} from "./fulcrum/pluginBridge";
import {openProjectSummaryLeaf, revealOrCreateDashboard} from "./fulcrum/openViews";
import {DEFAULT_SETTINGS, type FulcrumSettings} from "./fulcrum/settingsDefaults";
import {VaultIndex} from "./fulcrum/VaultIndex";
import {FulcrumSettingTab} from "./settings";
import {DashboardView} from "./views/DashboardView";
import {ProjectView} from "./views/ProjectView";

export default class FulcrumPlugin extends Plugin implements FulcrumHost {
	settings: FulcrumSettings = DEFAULT_SETTINGS;
	vaultIndex!: VaultIndex;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.vaultIndex = new VaultIndex(this.app, () => this.settings);

		this.registerView(VIEW_DASHBOARD, (leaf) => new DashboardView(leaf, this));
		this.registerView(VIEW_PROJECT, (leaf) => new ProjectView(leaf, this));

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
			this.addRibbonIcon("layout-dashboard", "Fulcrum dashboard", () => {
				void this.openDashboard();
			});
		}

		this.addCommand({
			id: "open-dashboard",
			name: "Open dashboard",
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

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()) as FulcrumSettings;
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
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

	notifyNewNoteFromProject(_projectPath: string): void {
		new Notice("New note from project will be available in a future update.");
	}

	notifyNewTaskFromProject(_projectPath: string): void {
		new Notice("New task from project will be available in a future update.");
	}

}
