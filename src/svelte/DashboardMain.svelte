<script lang="ts">
	import type {FulcrumHost} from "../fulcrum/pluginBridge";
	import {indexRevision} from "../fulcrum/stores";
	import {parseList} from "../fulcrum/settingsDefaults";
	import {
		todayLocalISODate,
		isDueToday,
		isOverdue,
		isDateInUpcomingDays,
		dayStartMs,
	} from "../fulcrum/utils/dates";
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
</script>

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
