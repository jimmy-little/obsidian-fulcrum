<script lang="ts">
	import type {FulcrumHost} from "../fulcrum/pluginBridge";
	import type {IndexedMeeting} from "../fulcrum/types";
	import {indexRevision} from "../fulcrum/stores";
	import {parseList} from "../fulcrum/settingsDefaults";
	import {
		todayLocalISODate,
		isDueToday,
		isOverdue,
		isDateInUpcomingDays,
		dayStartMs,
	} from "../fulcrum/utils/dates";
	import {addDays, toISODate, formatDayShort} from "../fulcrum/utils/calendarGrid";
	import TaskCard from "./TaskCard.svelte";

	export let plugin: FulcrumHost;

	let snapshot = plugin.vaultIndex.getSnapshot();
	$: rev = $indexRevision;
	$: {
		void rev;
		snapshot = plugin.vaultIndex.getSnapshot();
	}

	$: doneTask = new Set(parseList(plugin.settings.taskDoneStatuses));

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

	/** 7 days starting today for the meetings calendar grid */
	$: meetingGridDays = (() => {
		const out: {iso: string; dayLabel: string; dayNum: string}[] = [];
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		for (let i = 0; i < 7; i++) {
			const d = addDays(today, i);
			out.push({
				iso: toISODate(d),
				dayLabel: formatDayShort(d),
				dayNum: String(d.getDate()),
			});
		}
		return out;
	})();

	$: meetingsByDate = ((): Map<string, IndexedMeeting[]> => {
		const m = new Map<string, IndexedMeeting[]>();
		for (const mt of snapshot.meetings) {
			const key = mt.date?.slice(0, 10) ?? "";
			if (!key) continue;
			if (!isDateInUpcomingDays(mt.date, 7)) continue;
			const cur = m.get(key) ?? [];
			cur.push(mt);
			m.set(key, cur);
		}
		for (const [, arr] of m) {
			arr.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
		}
		return m;
	})();

	$: todayTasks = snapshot.tasks
		.filter((t) => !doneTask.has(t.status) && isDueToday(t.dueDate, false))
		.slice(0, 20);

	function openFile(path: string): void {
		const f = plugin.app.vault.getAbstractFileByPath(path);
		if (f && "extension" in f) {
			void plugin.app.workspace.getLeaf("tab").openFile(f);
		}
	}
</script>

<section class="fulcrum-section">
	<h2>Today</h2>
	<div class="fulcrum-project-meta-strip">
		<div class="fulcrum-project-meta-strip__row">
			<span>Tasks due <span class="fulcrum-meta-days">{tasksDueToday.length}</span></span>
			<span class="fulcrum-meta-sep">·</span>
			<span>Overdue <span class="fulcrum-meta-days fulcrum-meta-days--since">{overdueTasks.length}</span></span>
			<span class="fulcrum-meta-sep">·</span>
			<span>Meetings today <span class="fulcrum-meta-days">{meetingsToday.length}</span></span>
			<span class="fulcrum-meta-sep">·</span>
			<span>Completed (7d) <span class="fulcrum-meta-days">{completedThisWeek.length}</span></span>
		</div>
	</div>
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
	<div class="fulcrum-dashboard-meetings-grid" role="grid" aria-label="Meetings by day" style="--fulcrum-meetings-cols: 7">
		{#each meetingGridDays as {iso, dayLabel, dayNum}}
			{@const dayMeetings = meetingsByDate.get(iso) ?? []}
			{@const isToday = iso === todayLocalISODate()}
			<div
				class="fulcrum-dashboard-meetings__day-col"
				class:fulcrum-dashboard-meetings__day-col--today={isToday}
				role="columnheader"
			>
				<div class="fulcrum-dashboard-meetings__day-head">
					<span class="fulcrum-dashboard-meetings__day-name">{dayLabel}</span>
					<span class="fulcrum-dashboard-meetings__day-num">{dayNum}</span>
				</div>
				<div class="fulcrum-dashboard-meetings__day-events">
					{#if dayMeetings.length === 0}
						<span class="fulcrum-muted fulcrum-dashboard-meetings__empty">—</span>
					{:else}
						{#each dayMeetings as m (m.file.path)}
							<button
								type="button"
								class="fulcrum-linklike fulcrum-dashboard-meetings__event"
								on:click={() => openFile(m.file.path)}
							>
								{m.title ?? "Meeting"}
							</button>
						{/each}
					{/if}
				</div>
			</div>
		{/each}
	</div>
</section>
