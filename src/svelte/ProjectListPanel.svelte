<script lang="ts">
	import type {FulcrumHost} from "../fulcrum/pluginBridge";
	import type {FulcrumSettings} from "../fulcrum/settingsDefaults";
	import {indexRevision, settingsRevision} from "../fulcrum/stores";
	import {parseList} from "../fulcrum/settingsDefaults";
	import type {IndexedArea, IndexedProject} from "../fulcrum/types";
	import {sortIndexedProjects} from "../fulcrum/utils/projectListSort";
	import ProjectListRow from "./ProjectListRow.svelte";

	export let plugin: FulcrumHost;
	export let selectedPath: string | null = null;
	export let onSelectProject: (path: string) => void;

	let snapshot = plugin.vaultIndex.getSnapshot();
	$: rev = $indexRevision;
	$: {
		void rev;
		snapshot = plugin.vaultIndex.getSnapshot();
	}

	$: sRev = $settingsRevision;
	$: doneProject = (void sRev, new Set(parseList(plugin.settings.projectDoneStatuses)));
	$: activeProject = snapshot.projects.filter((p) => !doneProject.has(p.status));
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
		const list = activeProject;
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
		for (const p of activeProject) {
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

	function openAreaFile(path: string): void {
		const f = plugin.app.vault.getAbstractFileByPath(path);
		if (f && "extension" in f) {
			void plugin.app.workspace.getLeaf("tab").openFile(f);
		}
	}
</script>

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
	</div>
	{#if activeProject.length === 0}
		<p class="fulcrum-muted fulcrum-project-list-panel__empty">No active projects.</p>
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
