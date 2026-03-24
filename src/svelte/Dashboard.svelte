<script lang="ts">
	import type {WorkspaceLeaf} from "obsidian";
	import type {FulcrumHost} from "../fulcrum/pluginBridge";
	import DashboardMain from "./DashboardMain.svelte";
	import ProjectListPanel from "./ProjectListPanel.svelte";

	export let plugin: FulcrumHost;
	export let hoverParentLeaf: WorkspaceLeaf | undefined = undefined;

	function openProjectSummary(path: string): void {
		void plugin.openProjectSummary(path);
	}
</script>

<div class="fulcrum-dashboard">
	<header class="fulcrum-dashboard__header">
		<h1>Fulcrum</h1>
		<div class="fulcrum-dashboard__actions">
			<button type="button" class="mod-cta" on:click={() => void plugin.refreshIndex()}>Refresh</button>
		</div>
	</header>

	<DashboardMain {plugin} {hoverParentLeaf} />

	<section class="fulcrum-section">
		<ProjectListPanel {plugin} selectedPath={null} onSelectProject={openProjectSummary} />
	</section>
</div>
