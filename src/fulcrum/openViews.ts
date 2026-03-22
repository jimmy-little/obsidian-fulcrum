import type {App, WorkspaceLeaf} from "obsidian";
import {VIEW_DASHBOARD, VIEW_PROJECT} from "./constants";
import type {FulcrumSettings} from "./settingsDefaults";

function claimLeaf(app: App, settings: FulcrumSettings): WorkspaceLeaf {
	if (settings.openViewsIn === "sidebar") {
		const right = app.workspace.getRightLeaf(false);
		if (right) return right;
	}
	return app.workspace.getLeaf("tab");
}

export async function revealOrCreateDashboard(
	app: App,
	settings: FulcrumSettings,
): Promise<void> {
	const existing = app.workspace.getLeavesOfType(VIEW_DASHBOARD)[0];
	if (existing) {
		await app.workspace.revealLeaf(existing);
		return;
	}
	const leaf = claimLeaf(app, settings);
	await leaf.setViewState({type: VIEW_DASHBOARD, active: true});
	await app.workspace.revealLeaf(leaf);
}

export async function openProjectSummaryLeaf(
	app: App,
	settings: FulcrumSettings,
	projectPath: string,
): Promise<void> {
	const leaf = claimLeaf(app, settings);
	await leaf.setViewState({
		type: VIEW_PROJECT,
		active: true,
		state: {path: projectPath},
	});
	await app.workspace.revealLeaf(leaf);
}
