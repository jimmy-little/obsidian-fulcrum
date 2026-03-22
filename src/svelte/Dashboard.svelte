<script lang="ts">
	import type {FulcrumHost} from "../fulcrum/pluginBridge";
	import {indexRevision} from "../fulcrum/stores";
	import {parseList} from "../fulcrum/settingsDefaults";
	import type {IndexedProject, IndexedTask} from "../fulcrum/types";
	import {
		todayLocalISODate,
		isDueToday,
		isOverdue,
		isDateInUpcomingDays,
		dayStartMs,
	} from "../fulcrum/utils/dates";
	import {resolveProjectAccentCss} from "../fulcrum/utils/projectVisual";

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

	function openFile(path: string): void {
		const f = plugin.app.vault.getAbstractFileByPath(path);
		if (f && "extension" in f) {
			void plugin.app.workspace.getLeaf("tab").openFile(f);
		}
	}

	function openProject(p: IndexedProject): void {
		void plugin.openProjectSummary(p.file.path);
	}

	function labelForTask(t: IndexedTask): string {
		if (t.projectFile) return t.projectFile.basename.replace(/\.md$/i, "");
		if (t.areaFile) return t.areaFile.basename.replace(/\.md$/i, "");
		return "—";
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
			<button type="button" class="fulcrum-stat-card" on:click={() => {}}>
				<span class="fulcrum-stat-card__label">Tasks due</span>
				<span class="fulcrum-stat-card__value">{tasksDueToday.length}</span>
			</button>
			<button type="button" class="fulcrum-stat-card" on:click={() => {}}>
				<span class="fulcrum-stat-card__label">Overdue</span>
				<span class="fulcrum-stat-card__value">{overdueTasks.length}</span>
			</button>
			<button type="button" class="fulcrum-stat-card" on:click={() => {}}>
				<span class="fulcrum-stat-card__label">Meetings today</span>
				<span class="fulcrum-stat-card__value">{meetingsToday.length}</span>
			</button>
			<button type="button" class="fulcrum-stat-card" on:click={() => {}}>
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
		<h2>Active projects</h2>
		{#if activeProject.length === 0}
			<p class="fulcrum-muted">No active projects. Use “Fulcrum: New project” or add <code>type: project</code> frontmatter.</p>
		{:else}
			<ul class="fulcrum-list">
				{#each activeProject as p}
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
		{/if}
	</section>

	<section class="fulcrum-section">
		<h2>Today’s tasks</h2>
		{#if todayTasks.length === 0}
			<p class="fulcrum-muted">Nothing due today in TaskNotes.</p>
		{:else}
			<ul class="fulcrum-task-list">
				{#each todayTasks as t}
					<li>
						<button type="button" class="fulcrum-linklike" on:click={() => openFile(t.file.path)}>
							<span class="fulcrum-task-check">☐</span>
							<span>{t.title}</span>
							<span class="fulcrum-muted">[{labelForTask(t)}]</span>
						</button>
					</li>
				{/each}
			</ul>
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
