<script lang="ts">
	import type {FulcrumHost} from "../fulcrum/pluginBridge";
	import {indexRevision} from "../fulcrum/stores";
	import {parseList} from "../fulcrum/settingsDefaults";
	import type {IndexedArea, IndexedProject} from "../fulcrum/types";
	import {
		todayLocalISODate,
		isDueToday,
		isOverdue,
		isDateInUpcomingDays,
		dayStartMs,
	} from "../fulcrum/utils/dates";
	import {resolveProjectAccentCss} from "../fulcrum/utils/projectVisual";
	import TaskCard from "./TaskCard.svelte";

	export let plugin: FulcrumHost;

	let snapshot = plugin.vaultIndex.getSnapshot();
	$: rev = $indexRevision;
	$: {
		void rev;
		snapshot = plugin.vaultIndex.getSnapshot();
	}

	$: doneTask = new Set(parseList(plugin.settings.taskDoneStatuses));
	$: doneProject = new Set(parseList(plugin.settings.projectDoneStatuses));
	$: activeProject = snapshot.projects.filter((p) => !doneProject.has(p.status));
	$: groupBy = plugin.settings.dashboardActiveProjectsGroupBy;
	$: statusOrder = parseList(plugin.settings.projectStatuses);

	$: tasksDueToday = snapshot.tasks.filter(
		(t) => !doneTask.has(t.status) && isDueToday(t.dueDate, false),
	);
	$: overdueTasks = snapshot.tasks.filter(
		(t) => !doneTask.has(t.status) && isOverdue(t.dueDate, false),
	);
	$: meetingsToday = snapshot.meetings.filter(
		(m) => m.date?.slice(0, 10) === todayLocalISODate(),
	);
	$: completedThisWeek = snapshot.tasks.filter((t) => {
		if (!doneTask.has(t.status) || !t.completedDate) return false;
		const c = Date.parse(t.completedDate.slice(0, 10));
		if (Number.isNaN(c)) return false;
		const weekAgo = dayStartMs(new Date(Date.now() - 7 * 86400000));
		return c >= weekAgo;
	});

	$: areaRows = snapshot.areas.map((a) => {
		const count = snapshot.projects.filter(
			(p) => p.areaFile?.path === a.file.path && !doneProject.has(p.status),
		).length;
		return {area: a, activeCount: count};
	});

	$: todayTasks = snapshot.tasks
		.filter((t) => !doneTask.has(t.status) && isDueToday(t.dueDate, false))
		.slice(0, 20);

	$: upcomingMeetings = snapshot.meetings
		.filter((m) => isDateInUpcomingDays(m.date, 7))
		.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
		.slice(0, 15);

	type AreaGroup = {
		kind: "area" | "unassigned" | "orphan";
		label: string;
		area?: IndexedArea;
		projects: IndexedProject[];
	};

	function sortProjectsByName(ps: IndexedProject[]): IndexedProject[] {
		return [...ps].sort((a, b) =>
			a.name.localeCompare(b.name, undefined, {sensitivity: "base"}),
		);
	}

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
				out.push({kind: "area", label: a.name, area: a, projects: sortProjectsByName(ps)});
				byAreaPath.delete(a.file.path);
			}
		}
		const un = byAreaPath.get("__none__");
		if (un?.length) {
			out.push({kind: "unassigned", label: "Unassigned", projects: sortProjectsByName(un)});
			byAreaPath.delete("__none__");
		}
		for (const [, ps] of byAreaPath) {
			if (!ps.length) continue;
			const sample = ps[0];
			const label =
				sample?.areaName?.trim() ||
				sample?.areaFile?.path.split("/").pop()?.replace(/\.md$/i, "") ||
				"Other";
			out.push({kind: "orphan", label, projects: sortProjectsByName(ps)});
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
			projects: sortProjectsByName(map.get(k) ?? []),
		}));
	})();

	function openFile(path: string): void {
		const f = plugin.app.vault.getAbstractFileByPath(path);
		if (f && "extension" in f) {
			void plugin.app.workspace.getLeaf("tab").openFile(f);
		}
	}

	function openProject(p: IndexedProject): void {
		void plugin.openProjectSummary(p.file.path);
	}

	async function onGroupByChange(ev: Event): Promise<void> {
		const v = (ev.currentTarget as HTMLSelectElement).value as "area" | "status";
		await plugin.patchSettings({dashboardActiveProjectsGroupBy: v});
	}
</script>

<div class="fulcrum-dashboard">
	<header class="fulcrum-dashboard__header">
		<h1>Fulcrum</h1>
		<div class="fulcrum-dashboard__actions">
			<button type="button" class="mod-cta" on:click={() => void plugin.refreshIndex()}>Refresh</button>
		</div>
	</header>

	<section class="fulcrum-section">
		<h2>Today</h2>
		<div class="fulcrum-stat-grid">
			<button type="button" class="fulcrum-stat-card">
				<span class="fulcrum-stat-card__label">Tasks due</span>
				<span class="fulcrum-stat-card__value">{tasksDueToday.length}</span>
			</button>
			<button type="button" class="fulcrum-stat-card">
				<span class="fulcrum-stat-card__label">Overdue</span>
				<span class="fulcrum-stat-card__value">{overdueTasks.length}</span>
			</button>
			<button type="button" class="fulcrum-stat-card">
				<span class="fulcrum-stat-card__label">Meetings today</span>
				<span class="fulcrum-stat-card__value">{meetingsToday.length}</span>
			</button>
			<button type="button" class="fulcrum-stat-card">
				<span class="fulcrum-stat-card__label">Completed (7d)</span>
				<span class="fulcrum-stat-card__value">{completedThisWeek.length}</span>
			</button>
		</div>
	</section>

	<section class="fulcrum-section">
		<h2>Areas</h2>
		{#if areaRows.length === 0}
			<p class="fulcrum-muted">No area notes found. Add <code>type: area</code> under your projects folder.</p>
		{:else}
			<ul class="fulcrum-list">
				{#each areaRows as {area, activeCount}}
					<li>
						<button type="button" class="fulcrum-linklike" on:click={() => openFile(area.file.path)}>
							<span class="fulcrum-area-icon">{area.icon ?? "▸"}</span>
							<span>{area.name}</span>
							<span class="fulcrum-muted">({activeCount} active projects)</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="fulcrum-section">
		<h2>Today’s tasks</h2>
		{#if todayTasks.length === 0}
			<p class="fulcrum-muted">Nothing due today in indexed tasks.</p>
		{:else}
			<ul class="fulcrum-task-list fulcrum-task-agenda-list">
				{#each todayTasks as t}
					<li>
						<TaskCard plugin={plugin} task={t} done={doneTask.has(t.status)} showProjectLink={true} />
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="fulcrum-section">
		<div class="fulcrum-dashboard__section-head">
			<h2>Active projects</h2>
			<select class="dropdown" value={groupBy} on:change={(e) => void onGroupByChange(e)}>
				<option value="area">Group by area</option>
				<option value="status">Group by status</option>
			</select>
		</div>
		{#if activeProject.length === 0}
			<p class="fulcrum-muted">No active projects. Use “Fulcrum: New project” or add <code>type: project</code> frontmatter.</p>
		{:else if groupBy === "area"}
			{#each areaGroups as g}
				<div class="fulcrum-dashboard__area-group">
					{#if g.kind === "area" && g.area}
						<h3 class="fulcrum-dashboard__area-group-title">
							<button
								type="button"
								class="fulcrum-linklike"
								on:click={() => openFile(g.area?.file.path ?? "")}
							>
								<span class="fulcrum-area-icon">{g.area?.icon ?? "▸"}</span>
								<span>{g.label}</span>
							</button>
						</h3>
					{:else}
						<h3 class="fulcrum-dashboard__area-group-title">{g.label}</h3>
					{/if}
					<ul class="fulcrum-list">
						{#each g.projects as p}
							<li>
								<button
									type="button"
									class="fulcrum-linklike fulcrum-project-row"
									style={`border-left: 3px solid ${resolveProjectAccentCss(p.color)}; padding-left: 0.45rem;`}
									on:click={() => openProject(p)}
								>
									<span>{p.name}</span>
									{#if p.priority}
										<span class="fulcrum-tag">{p.priority}</span>
									{/if}
									{#if p.dueDate}
										<span class="fulcrum-muted">due {p.dueDate.slice(0, 10)}</span>
									{/if}
								</button>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		{:else}
			{#each statusGroups as sg}
				<div class="fulcrum-dashboard__area-group">
					<h3 class="fulcrum-dashboard__area-group-title">{sg.label}</h3>
					<ul class="fulcrum-list">
						{#each sg.projects as p}
							<li>
								<button
									type="button"
									class="fulcrum-linklike fulcrum-project-row"
									style={`border-left: 3px solid ${resolveProjectAccentCss(p.color)}; padding-left: 0.45rem;`}
									on:click={() => openProject(p)}
								>
									<span>{p.name}</span>
									{#if p.priority}
										<span class="fulcrum-tag">{p.priority}</span>
									{/if}
									{#if p.dueDate}
										<span class="fulcrum-muted">due {p.dueDate.slice(0, 10)}</span>
									{/if}
								</button>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		{/if}
	</section>

	<section class="fulcrum-section">
		<h2>Upcoming meetings (7 days)</h2>
		{#if upcomingMeetings.length === 0}
			<p class="fulcrum-muted">No meetings in range.</p>
		{:else}
			<ul class="fulcrum-list">
				{#each upcomingMeetings as m}
					<li>
						<button type="button" class="fulcrum-linklike" on:click={() => openFile(m.file.path)}>
							<span>{m.date?.slice(0, 10) ?? "—"}</span>
							<span>{m.title}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
