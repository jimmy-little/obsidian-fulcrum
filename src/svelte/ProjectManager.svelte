<script lang="ts">
	import type {WorkspaceLeaf} from "obsidian";
	import {setIcon} from "obsidian";
	import type {FulcrumHost} from "../fulcrum/pluginBridge";
	import DashboardMain from "./DashboardMain.svelte";
	import KanbanMain from "./KanbanMain.svelte";
	import CalendarMain from "./CalendarMain.svelte";
	import ProjectListPanel from "./ProjectListPanel.svelte";
	import ProjectSummary from "./ProjectSummary.svelte";

	export let plugin: FulcrumHost;
	export let hoverParentLeaf: WorkspaceLeaf;
	export let mainMode: "dashboard" | "project" | "kanban" | "calendar";
	export let projectPath: string | null;
	export let onSelectDashboard: () => void;
	export let onSelectProject: (path: string) => void;
	export let onSelectKanban: () => void;
	export let onSelectCalendar: () => void;

	const PM_LEFT_WIDTH_LS = "fulcrum-pm-left-col-px";
	const PM_LEFT_MIN = 200;
	const PM_MAIN_MIN = 280;
	const PM_SPLIT_PX = 5;

	function readStoredLeftWidth(): number | null {
		if (typeof localStorage === "undefined") return null;
		try {
			const s = localStorage.getItem(PM_LEFT_WIDTH_LS);
			if (!s) return null;
			const n = Number.parseInt(s, 10);
			if (!Number.isFinite(n) || n < PM_LEFT_MIN) return null;
			return n;
		} catch {
			return null;
		}
	}

	let leftCollapsed = false;
	let pmEl: HTMLDivElement | null = null;
	let leftWidthPx: number | null = readStoredLeftWidth();
	let dashboardBtnEl: HTMLButtonElement | null = null;
	let kanbanBtnEl: HTMLButtonElement | null = null;

	$: if (dashboardBtnEl && plugin) {
		setIcon(dashboardBtnEl, "layout-dashboard");
	}
	$: if (kanbanBtnEl && plugin) {
		setIcon(kanbanBtnEl, "columns-3");
	}

	$: selectedProjectPath = mainMode === "project" ? projectPath : null;

	function maxLeftColWidth(): number {
		if (!pmEl) return 720;
		const pmW = pmEl.getBoundingClientRect().width;
		return Math.max(PM_LEFT_MIN, pmW - PM_SPLIT_PX - PM_MAIN_MIN);
	}

	function clampLeftWidth(w: number): number {
		return Math.min(Math.max(Math.round(w), PM_LEFT_MIN), maxLeftColWidth());
	}

	function persistLeftWidth(w: number): void {
		try {
			localStorage.setItem(PM_LEFT_WIDTH_LS, String(w));
		} catch {
			/* private mode / quota */
		}
	}

	function onSplitPointerDown(ev: PointerEvent): void {
		if (leftCollapsed) return;
		const handle = ev.currentTarget as HTMLElement;
		ev.preventDefault();
		handle.setPointerCapture(ev.pointerId);
		const aside = pmEl?.querySelector(".fulcrum-pm__sidebar--left");
		const startW =
			aside instanceof HTMLElement ? aside.getBoundingClientRect().width : PM_LEFT_MIN;
		const startX = ev.clientX;

		function move(e: PointerEvent): void {
			leftWidthPx = clampLeftWidth(startW + (e.clientX - startX));
		}

		function up(e: PointerEvent): void {
			handle.releasePointerCapture(e.pointerId);
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
			window.removeEventListener("pointercancel", up);
			if (leftWidthPx != null) persistLeftWidth(leftWidthPx);
		}

		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
		window.addEventListener("pointercancel", up);
	}

	function onSplitKeydown(ev: KeyboardEvent): void {
		if (leftCollapsed) return;
		if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
		ev.preventDefault();
		const aside = pmEl?.querySelector(".fulcrum-pm__sidebar--left");
		const cur =
			leftWidthPx ??
			(aside instanceof HTMLElement ? aside.getBoundingClientRect().width : 352);
		const step = ev.shiftKey ? 24 : 8;
		const delta = ev.key === "ArrowRight" ? step : -step;
		const next = clampLeftWidth(cur + delta);
		leftWidthPx = next;
		persistLeftWidth(next);
	}
</script>

<div
	bind:this={pmEl}
	class="fulcrum-pm"
	class:fulcrum-pm-left-collapsed={leftCollapsed}
	style={!leftCollapsed && leftWidthPx != null
		? `--fulcrum-pm-left-w: ${leftWidthPx}px`
		: undefined}
>
	<aside class="fulcrum-pm__sidebar fulcrum-pm__sidebar--left">
		<div class="fulcrum-pm__left-stack">
			<div
				class="fulcrum-pm__glyph-bar"
				class:fulcrum-pm__glyph-bar--collapsed={leftCollapsed}
				role="toolbar"
				aria-label="Project sidebar"
			>
				<button
					type="button"
					class="fulcrum-pm__glyph-btn clickable-icon"
					aria-label={leftCollapsed ? "Expand project list" : "Collapse project list"}
					title={leftCollapsed ? "Expand" : "Collapse"}
					on:click={() => (leftCollapsed = !leftCollapsed)}
				>
					{leftCollapsed ? "›" : "‹"}
				</button>
				<button
					type="button"
					class="fulcrum-pm__glyph-btn clickable-icon"
					class:fulcrum-pm__glyph-btn--active={mainMode === "dashboard"}
					aria-label="Dashboard"
					title="Dashboard"
					bind:this={dashboardBtnEl}
					on:click={onSelectDashboard}
				></button>
				<span class="fulcrum-pm__glyph-spacer" aria-hidden="true"></span>
				<button
					type="button"
					class="fulcrum-pm__glyph-btn clickable-icon"
					class:fulcrum-pm__glyph-btn--active={mainMode === "kanban"}
					aria-label="Kanban"
					title="Kanban"
					bind:this={kanbanBtnEl}
					on:click={onSelectKanban}
				></button>
				<button
					type="button"
					class="fulcrum-pm__glyph-btn clickable-icon"
					class:fulcrum-pm__glyph-btn--active={mainMode === "calendar"}
					aria-label="Calendar"
					title="Calendar"
					on:click={onSelectCalendar}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
				</button>
			</div>
			{#if !leftCollapsed}
				<div class="fulcrum-pm__left-scroll">
					<ProjectListPanel
						{plugin}
						selectedPath={selectedProjectPath}
						onSelectProject={onSelectProject}
					/>
				</div>
			{/if}
		</div>
	</aside>

	<button
		type="button"
		class="fulcrum-pm__split"
		disabled={leftCollapsed}
		aria-label="Resize project list. Drag or use arrow keys."
		on:pointerdown={onSplitPointerDown}
		on:keydown={onSplitKeydown}
	></button>

	<main class="fulcrum-pm__main fulcrum-view-root">
		{#if mainMode === "dashboard"}
			<header class="fulcrum-pm__main-head">
				<h1 class="fulcrum-pm__main-title">Dashboard</h1>
				<button type="button" class="mod-cta" on:click={() => void plugin.refreshIndex()}>
					Refresh
				</button>
			</header>
			<DashboardMain {plugin} />
		{:else if mainMode === "kanban"}
			<header class="fulcrum-pm__main-head">
				<h1 class="fulcrum-pm__main-title">Kanban</h1>
				<button type="button" class="mod-cta" on:click={() => void plugin.refreshIndex()}>
					Refresh
				</button>
			</header>
			<KanbanMain {plugin} />
		{:else if mainMode === "calendar"}
			<header class="fulcrum-pm__main-head">
				<h1 class="fulcrum-pm__main-title">Calendar</h1>
				<button type="button" class="mod-cta" on:click={() => void plugin.refreshIndex()}>
					Refresh
				</button>
			</header>
			<CalendarMain {plugin} />
		{:else if projectPath}
			{#key projectPath}
				<ProjectSummary {plugin} {projectPath} {hoverParentLeaf} />
			{/key}
		{:else}
			<p class="fulcrum-muted">Pick a project from the list.</p>
		{/if}
	</main>
</div>
