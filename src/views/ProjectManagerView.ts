import {ItemView, WorkspaceLeaf, type ViewStateResult} from "obsidian";
import type {SvelteComponent} from "svelte";
import {VIEW_PROJECT_MANAGER} from "../fulcrum/constants";
import type {FulcrumHost} from "../fulcrum/pluginBridge";
import ProjectManager from "../svelte/ProjectManager.svelte";

export type ProjectManagerViewState = {
	mode?: "dashboard" | "project" | "kanban" | "calendar";
	projectPath?: string;
};

export class ProjectManagerView extends ItemView {
	private readonly host: FulcrumHost;
	private component: SvelteComponent | null = null;
	mainMode: "dashboard" | "project" | "kanban" | "calendar" = "dashboard";
	projectPath: string | null = null;

	constructor(leaf: WorkspaceLeaf, host: FulcrumHost) {
		super(leaf);
		this.host = host;
	}

	getViewType(): string {
		return VIEW_PROJECT_MANAGER;
	}

	getDisplayText(): string {
		if (this.mainMode === "project" && this.projectPath) {
			const p = this.host.vaultIndex.resolveProjectByPath(this.projectPath);
			return p?.name ?? "Project";
		}
		if (this.mainMode === "kanban") return "Kanban";
		if (this.mainMode === "calendar") return "Calendar";
		return "Fulcrum Project Manager";
	}

	getIcon(): string {
		return "layout-dashboard";
	}

	getState(): ProjectManagerViewState {
		if (this.mainMode === "project" && this.projectPath) {
			return {mode: "project", projectPath: this.projectPath};
		}
		if (this.mainMode === "kanban") return {mode: "kanban"};
		if (this.mainMode === "calendar") return {mode: "calendar"};
		return {mode: "dashboard"};
	}

	async setState(state: ProjectManagerViewState, _result: ViewStateResult): Promise<void> {
		if (state?.mode === "project" && typeof state.projectPath === "string" && state.projectPath) {
			this.mainMode = "project";
			this.projectPath = state.projectPath;
		} else if (state?.mode === "kanban") {
			this.mainMode = "kanban";
			this.projectPath = null;
		} else if (state?.mode === "calendar") {
			this.mainMode = "calendar";
			this.projectPath = null;
		} else {
			this.mainMode = "dashboard";
			this.projectPath = null;
		}
		await this.render();
	}

	async onOpen(): Promise<void> {
		await this.render();
	}

	async onClose(): Promise<void> {
		this.component?.$destroy();
		this.component = null;
	}

	private async render(): Promise<void> {
		this.component?.$destroy();
		this.component = null;
		this.contentEl.empty();

		this.component = new ProjectManager({
			target: this.contentEl,
			props: {
				plugin: this.host,
				hoverParentLeaf: this.leaf,
				mainMode: this.mainMode,
				projectPath: this.projectPath,
				onSelectDashboard: () => {
					void this.leaf.setViewState({
						type: VIEW_PROJECT_MANAGER,
						active: true,
						state: {mode: "dashboard"},
					});
				},
				onSelectProject: (path: string) => {
					void this.leaf.setViewState({
						type: VIEW_PROJECT_MANAGER,
						active: true,
						state: {mode: "project", projectPath: path},
					});
				},
				onSelectKanban: () => {
					void this.leaf.setViewState({
						type: VIEW_PROJECT_MANAGER,
						active: true,
						state: {mode: "kanban"},
					});
				},
				onSelectCalendar: () => {
					void this.leaf.setViewState({
						type: VIEW_PROJECT_MANAGER,
						active: true,
						state: {mode: "calendar"},
					});
				},
			},
		});
	}
}
