import type {App, WorkspaceLeaf} from "obsidian";
import type {FulcrumSettings} from "./settingsDefaults";
import type {VaultIndex} from "./VaultIndex";
import type {IndexedTask} from "./types";
import type {ProjectLogActivityEntry} from "./projectNote";

/** Narrow surface passed into Svelte views (avoids circular imports). */
export interface FulcrumHost {
	readonly app: App;
	readonly settings: FulcrumSettings;
	readonly vaultIndex: VaultIndex;
	openProjectSummary(path: string): Promise<void>;
	openDashboard(): Promise<void>;
	refreshIndex(): Promise<void>;
	appendProjectLogEntry(projectPath: string, text: string): Promise<void>;
	markProjectReviewed(projectPath: string): Promise<void>;
	loadProjectLogPreview(projectPath: string): Promise<string[]>;
	loadProjectLogActivity(projectPath: string): Promise<ProjectLogActivityEntry[]>;
	notifyNewNoteFromProject(projectPath: string): void;
	notifyNewTaskFromProject(projectPath: string): void;
	openIndexedTask(task: IndexedTask): void;
	toggleIndexedTask(task: IndexedTask): Promise<void>;
	patchSettings(partial: Partial<FulcrumSettings>): Promise<void>;
	triggerFulcrumHoverLink(
		event: MouseEvent,
		hoverParent: WorkspaceLeaf,
		targetEl: HTMLElement,
		path: string,
	): void;
}
