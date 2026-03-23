<script lang="ts">
	import type {FulcrumHost} from "../fulcrum/pluginBridge";
	import type {FulcrumSettings} from "../fulcrum/settingsDefaults";
	import {indexRevision, settingsRevision} from "../fulcrum/stores";
	import {parseList} from "../fulcrum/settingsDefaults";
	import type {IndexedArea, IndexedProject} from "../fulcrum/types";
	import {sortIndexedProjects} from "../fulcrum/utils/projectListSort";
	import ProjectListRow from "./ProjectListRow.svelte";

	const NONE_KEY = "__none__";

	export let plugin: FulcrumHost;
	export let selectedPath: string | null = null;
	export let onSelectProject: (path: string) => void;

	let filterOpen = false;
	let filterAnchorEl: HTMLDivElement | null = null;
	/** Pending filter state (not applied until Apply button pressed). Synced from settings when panel opens. */
	let pendingUncheckedStatus: string[] = [];
	let pendingUncheckedArea: string[] = [];
	let searchQuery = "";

	let snapshot = plugin.vaultIndex.getSnapshot();
	$: rev = $indexRevision;
	$: {
		void rev;
		snapshot = plugin.vaultIndex.getSnapshot();
	}

	$: sRev = $settingsRevision;
	$: doneProject = (void sRev, new Set(parseList(plugin.settings.projectDoneStatuses)));
	$: activeProjectRaw = snapshot.projects.filter((p) => !doneProject.has(p.status));
	/** Applied filter (from settings) - used for displayed list. */
	$: uncheckedStatus = new Set(plugin.settings.projectSidebarFilterUncheckedStatus);
	$: uncheckedArea = new Set(plugin.settings.projectSidebarFilterUncheckedArea);

	// Indexed status options: all unique status values from active projects + None
	$: statusOptions = ((): { key: string; label: string }[] => {
		const seen = new Set<string>();
		const out: { key: string; label: string }[] = [];
		for (const p of activeProjectRaw) {
			const k = p.status?.trim() ? p.status : NONE_KEY;
			if (seen.has(k)) continue;
			seen.add(k);
			out.push({
				key: k,
				label: k === NONE_KEY ? "None" : p.status.replace(/\b\w/g, (c) => c.toUpperCase()),
			});
		}
		// Always include None option
		if (!seen.has(NONE_KEY)) {
			out.push({ key: NONE_KEY, label: "None" });
		}
		// Sort: None last, then alphabetically
		out.sort((a, b) =>
			a.key === NONE_KEY ? 1 : b.key === NONE_KEY ? -1 : a.label.localeCompare(b.label),
		);
		return out;
	})();

	// Indexed area options: all areas from snapshot + None for unassigned
	$: areaOptions = ((): { key: string; label: string }[] => {
		const out: { key: string; label: string }[] = [];
		for (const a of snapshot.areas) {
			out.push({ key: a.file.path, label: a.name });
		}
		// Add None if any active project has no area
		const hasNone = activeProjectRaw.some((p) => !p.areaFile);
		if (hasNone || out.length === 0) {
			out.push({ key: NONE_KEY, label: "None" });
		}
		out.sort((a, b) => (a.key === NONE_KEY ? 1 : b.key === NONE_KEY ? -1 : a.label.localeCompare(b.label)));
		return out;
	})();

	// Filter: project passes if (status checked OR all status checked) AND (area checked OR all area checked)
	$: activeProject = ((): IndexedProject[] => {
		if (uncheckedStatus.size === 0 && uncheckedArea.size === 0) return activeProjectRaw;
		const statusUnchecked = uncheckedStatus.size > 0;
		const areaUnchecked = uncheckedArea.size > 0;
		return activeProjectRaw.filter((p) => {
			const statusKey = p.status?.trim() ? p.status : NONE_KEY;
			const areaKey = p.areaFile?.path ?? NONE_KEY;
			const statusPass =
				!statusUnchecked || !uncheckedStatus.has(statusKey);
			const areaPass = !areaUnchecked || !uncheckedArea.has(areaKey);
			return statusPass && areaPass;
		});
	})();

	// Live text filter: substring match on project title (case-insensitive)
	$: activeProjectFiltered = ((): IndexedProject[] => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return activeProject;
		return activeProject.filter((p) => p.name.toLowerCase().includes(q));
	})();

	$: groupBy = (void sRev, plugin.settings.dashboardActiveProjectsGroupBy);
	$: sortBy = (void sRev, plugin.settings.projectSidebarSortBy);
	$: sortDir = (void sRev, plugin.settings.projectSidebarSortDir);
	$: statusOrder = (void sRev, parseList(plugin.settings.projectStatuses));

	type AreaGroup = {
		kind: "area" | "unassigned" | "orphan";
		label: string;
		area?: IndexedArea;
		projects: IndexedProject[];
	};

	$: areaGroups = ((): AreaGroup[] => {
		const list = activeProjectFiltered;
		const byAreaPath = new Map<string, IndexedProject[]>();
		for (const p of list) {
			const key = p.areaFile?.path ?? "__none__";
			const cur = byAreaPath.get(key) ?? [];
			cur.push(p);
			byAreaPath.set(key, cur);
		}
		const out: AreaGroup[] = [];
		for (const a of snapshot.areas) {
			const ps = byAreaPath.get(a.file.path);
			if (ps?.length) {
				out.push({kind: "area", label: a.name, area: a, projects: sortIndexedProjects(ps, sortBy, sortDir)});
				byAreaPath.delete(a.file.path);
			}
		}
		const un = byAreaPath.get("__none__");
		if (un?.length) {
			out.push({kind: "unassigned", label: "Unassigned", projects: sortIndexedProjects(un, sortBy, sortDir)});
			byAreaPath.delete("__none__");
		}
		for (const [, ps] of byAreaPath) {
			if (!ps.length) continue;
			const sample = ps[0];
			const label =
				sample?.areaName?.trim() ||
				sample?.areaFile?.path.split("/").pop()?.replace(/\.md$/i, "") ||
				"Other";
			out.push({kind: "orphan", label, projects: sortIndexedProjects(ps, sortBy, sortDir)});
		}
		return out;
	})();

	$: statusGroups = (() => {
		const map = new Map<string, IndexedProject[]>();
		for (const p of activeProjectFiltered) {
			const k = p.status || "";
			const cur = map.get(k) ?? [];
			cur.push(p);
			map.set(k, cur);
		}
		const keys = [...map.keys()];
		keys.sort((a, b) => {
			const ia = statusOrder.indexOf(a.toLowerCase());
			const ib = statusOrder.indexOf(b.toLowerCase());
			const ua = ia === -1;
			const ub = ib === -1;
			if (ua && ub) return a.localeCompare(b);
			if (ua) return 1;
			if (ub) return -1;
			return ia - ib;
		});
		return keys.map((k) => ({
			statusKey: k,
			label: k ? k.replace(/\b\w/g, (c) => c.toUpperCase()) : "Folder root",
			projects: sortIndexedProjects(map.get(k) ?? [], sortBy, sortDir),
		}));
	})();

	async function onGroupByChange(ev: Event): Promise<void> {
		const v = (ev.currentTarget as HTMLSelectElement).value as "area" | "status";
		await plugin.patchSettings({dashboardActiveProjectsGroupBy: v});
	}

	async function onSortByChange(ev: Event): Promise<void> {
		const v = (ev.currentTarget as HTMLSelectElement).value as FulcrumSettings["projectSidebarSortBy"];
		await plugin.patchSettings({projectSidebarSortBy: v});
	}

	async function toggleSortDir(): Promise<void> {
		const next = plugin.settings.projectSidebarSortDir === "asc" ? "desc" : "asc";
		await plugin.patchSettings({projectSidebarSortDir: next});
	}

	function togglePendingStatus(key: string): void {
		const set = new Set(pendingUncheckedStatus);
		if (set.has(key)) set.delete(key);
		else set.add(key);
		pendingUncheckedStatus = [...set];
	}

	function togglePendingArea(key: string): void {
		const set = new Set(pendingUncheckedArea);
		if (set.has(key)) set.delete(key);
		else set.add(key);
		pendingUncheckedArea = [...set];
	}

	function isPendingStatusChecked(key: string): boolean {
		return !pendingUncheckedStatus.includes(key);
	}

	function isPendingAreaChecked(key: string): boolean {
		return !pendingUncheckedArea.includes(key);
	}

	/** Sync pending from settings when panel opens; apply pending to settings and close. */
	function openFilterPanel(): void {
		if (!filterOpen) {
			pendingUncheckedStatus = [...plugin.settings.projectSidebarFilterUncheckedStatus];
			pendingUncheckedArea = [...plugin.settings.projectSidebarFilterUncheckedArea];
		}
		filterOpen = !filterOpen;
	}

	async function applyFilters(): Promise<void> {
		if (!filterOpen) {
			// Panel closed: "Apply" = refresh with current filters; sync pending so we don't overwrite
			pendingUncheckedStatus = [...plugin.settings.projectSidebarFilterUncheckedStatus];
			pendingUncheckedArea = [...plugin.settings.projectSidebarFilterUncheckedArea];
		}
		await plugin.patchSettings({
			projectSidebarFilterUncheckedStatus: pendingUncheckedStatus,
			projectSidebarFilterUncheckedArea: pendingUncheckedArea,
		});
		filterOpen = false;
		await plugin.refreshIndex();
	}

	function handleFilterClickOutside(ev: MouseEvent): void {
		if (!filterOpen || !filterAnchorEl) return;
		const t = ev.target as Node;
		if (filterAnchorEl.contains(t)) return;
		const panel = document.querySelector(".fulcrum-project-list-panel__filter-panel");
		if (panel?.contains(t)) return;
		filterOpen = false;
	}

	function openAreaFile(path: string): void {
		const f = plugin.app.vault.getAbstractFileByPath(path);
		if (f && "extension" in f) {
			void plugin.app.workspace.getLeaf("tab").openFile(f);
		}
	}
</script>

<svelte:window on:click={handleFilterClickOutside} />

<div class="fulcrum-project-list-panel">
	<div class="fulcrum-project-list-panel__facets">
		<div class="fulcrum-project-list-panel__facet-row">
			<span class="fulcrum-project-list-panel__facet-label">Group</span>
			<select
				class="dropdown fulcrum-project-list-panel__facet-select"
				aria-label="Group projects by"
				value={groupBy}
				on:change={(e) => void onGroupByChange(e)}
			>
				<option value="area">Area</option>
				<option value="status">Status</option>
			</select>
		</div>
		<div class="fulcrum-project-list-panel__facet-row">
			<span class="fulcrum-project-list-panel__facet-label">Sort</span>
			<select
				class="dropdown fulcrum-project-list-panel__facet-select fulcrum-project-list-panel__facet-select--grow"
				aria-label="Sort projects by"
				value={sortBy}
				on:change={(e) => void onSortByChange(e)}
			>
				<option value="launch">Launch date</option>
				<option value="nextReview">Next review</option>
				<option value="rank">Rank</option>
			</select>
			<button
				type="button"
				class="fulcrum-project-list-panel__sort-dir"
				title={sortDir === "asc" ? "Ascending (click for descending)" : "Descending (click for ascending)"}
				aria-label={sortDir === "asc" ? "Sort ascending, switch to descending" : "Sort descending, switch to ascending"}
				on:click={() => void toggleSortDir()}
			>
				{sortDir === "asc" ? "↑" : "↓"}
			</button>
		</div>
		<div
			class="fulcrum-project-list-panel__facet-row fulcrum-project-list-panel__facet-row--filter"
			bind:this={filterAnchorEl}
		>
			<span class="fulcrum-project-list-panel__facet-label">Filter</span>
			<div class="fulcrum-project-list-panel__filter-wrap">
				<button
					type="button"
					class="dropdown fulcrum-project-list-panel__facet-select fulcrum-project-list-panel__facet-select--grow fulcrum-project-list-panel__filter-trigger"
					aria-label="Filter projects by status and area"
					aria-expanded={filterOpen}
					aria-haspopup="true"
					on:click|stopPropagation={() => openFilterPanel()}
				>
					{uncheckedStatus.size > 0 || uncheckedArea.size > 0 ? "Filtered" : "All"}
				</button>
				<button
					type="button"
					class="fulcrum-project-list-panel__sort-dir fulcrum-project-list-panel__filter-apply"
					title="Apply filters and refresh list"
					aria-label="Apply filters and refresh list"
					on:click={() => void applyFilters()}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
				</button>
				{#if filterOpen}
					<div
						class="fulcrum-project-list-panel__filter-panel"
						role="menu"
						aria-label="Filter options"
					>
						<div class="fulcrum-project-list-panel__filter-section">
							<div class="fulcrum-project-list-panel__filter-section-title">Status</div>
							{#each statusOptions as opt}
								<label class="fulcrum-project-list-panel__filter-check">
									<input
										type="checkbox"
										checked={isPendingStatusChecked(opt.key)}
										on:change={() => togglePendingStatus(opt.key)}
									/>
									<span>{opt.label}</span>
								</label>
							{/each}
						</div>
						<div class="fulcrum-project-list-panel__filter-section">
							<div class="fulcrum-project-list-panel__filter-section-title">Area</div>
							{#each areaOptions as opt}
								<label class="fulcrum-project-list-panel__filter-check">
									<input
										type="checkbox"
										checked={isPendingAreaChecked(opt.key)}
										on:change={() => togglePendingArea(opt.key)}
									/>
									<span>{opt.label}</span>
								</label>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
		<div class="fulcrum-project-list-panel__facet-row">
			<span class="fulcrum-project-list-panel__facet-label">Search</span>
			<input
				type="text"
				class="fulcrum-project-list-panel__facet-input"
				placeholder="Filter by project title…"
				aria-label="Filter projects by title"
				bind:value={searchQuery}
			/>
		</div>
	</div>
	{#if activeProjectFiltered.length === 0}
		<p class="fulcrum-muted fulcrum-project-list-panel__empty">
			{searchQuery.trim()
				? "No projects match your search."
				: "No active projects."}
		</p>
	{:else if groupBy === "area"}
		{#each areaGroups as g}
			<div class="fulcrum-dashboard__area-group fulcrum-project-list-panel__group">
				{#if g.kind === "area" && g.area}
					<h3 class="fulcrum-dashboard__area-group-title">
						<button
							type="button"
							class="fulcrum-linklike"
							on:click={() => openAreaFile(g.area?.file.path ?? "")}
						>
							<span class="fulcrum-area-icon">{g.area?.icon ?? "▸"}</span>
							<span>{g.label}</span>
						</button>
					</h3>
				{:else}
					<h3 class="fulcrum-dashboard__area-group-title">{g.label}</h3>
				{/if}
				<ul class="fulcrum-sidebar-project-list">
					{#each g.projects as p}
						<li>
							<ProjectListRow {p} {selectedPath} {onSelectProject} />
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	{:else}
		{#each statusGroups as sg}
			<div class="fulcrum-dashboard__area-group fulcrum-project-list-panel__group">
				<h3 class="fulcrum-dashboard__area-group-title">{sg.label}</h3>
				<ul class="fulcrum-sidebar-project-list">
					{#each sg.projects as p}
						<li>
							<ProjectListRow {p} {selectedPath} {onSelectProject} />
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	{/if}
</div>
