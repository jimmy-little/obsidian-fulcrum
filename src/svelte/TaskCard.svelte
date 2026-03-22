<script lang="ts">
	import type {FulcrumHost} from "../fulcrum/pluginBridge";
	import type {IndexedTask} from "../fulcrum/types";
	import {Platform} from "obsidian";
	import {isDueToday, isOverdue} from "../fulcrum/utils/dates";
	import {
		dueChip,
		scheduledChip,
		priorityAccentCss,
		formatTaskCreatedAge,
	} from "../fulcrum/utils/taskAgendaDisplay";
	import {formatTrackedMinutesShort} from "../fulcrum/utils/dates";

	export let plugin: FulcrumHost;
	export let task: IndexedTask;
	export let done: boolean;
	export let showProjectLink = false;

	let toggling = false;
	const canToggle = Platform.isDesktop;

	$: due = dueChip(task.dueDate, done);
	$: sched = scheduledChip(task.scheduledDate, done);
	$: borderPri = priorityAccentCss(task.priority);
	$: tracked =
		task.trackedMinutes > 0 ? formatTrackedMinutesShort(task.trackedMinutes) : "";

	function priorityBand(p: string | undefined): string {
		if (!p?.trim()) return "";
		const x = p.trim().toLowerCase();
		if (/^(high|urgent|critical|highest|p1|1|h)$/u.test(x)) return "high";
		if (/^(low|p3|p4|3|4|l)$/u.test(x)) return "low";
		return "";
	}

	$: band = priorityBand(task.priority);
	$: rowClass = [
		"fulcrum-task-card",
		done ? "fulcrum-task-card--completed" : "",
		!done && task.dueDate && isOverdue(task.dueDate, false)
			? "fulcrum-task-card--overdue"
			: "",
		!done && task.dueDate && isDueToday(task.dueDate, false)
			? "fulcrum-task-card--due-today"
			: "",
		band === "high" ? "fulcrum-task-card--priority-high" : "",
		band === "low" ? "fulcrum-task-card--priority-low" : "",
	]
		.filter(Boolean)
		.join(" ");

	function openTask(): void {
		plugin.openIndexedTask(task);
	}

	async function runToggle(): Promise<void> {
		if (!canToggle || toggling) return;
		toggling = true;
		try {
			await plugin.toggleIndexedTask(task);
		} finally {
			toggling = false;
		}
	}

	async function onToggleDot(ev: MouseEvent): Promise<void> {
		ev.preventDefault();
		ev.stopPropagation();
		await runToggle();
	}

	function onToggleKeydown(ev: KeyboardEvent): void {
		if (!canToggle || toggling) return;
		if (ev.key !== "Enter" && ev.key !== " ") return;
		ev.preventDefault();
		ev.stopPropagation();
		void runToggle();
	}

	function onTitleKeydown(ev: KeyboardEvent): void {
		if (ev.key !== "Enter" && ev.key !== " ") return;
		ev.preventDefault();
		openTask();
	}

	function projectLabel(t: IndexedTask): string {
		if (!t.projectFile) return "";
		return t.projectFile.basename.replace(/\.md$/i, "");
	}
</script>

<div class={rowClass} data-priority={band || undefined}>
	<div class="fulcrum-task-card__main-row">
		<div
			role="checkbox"
			tabindex={canToggle ? 0 : -1}
			aria-checked={done}
			aria-disabled={!canToggle}
			class="fulcrum-task-card__status-dot"
			class:fulcrum-task-card__status-dot--done={done}
			class:fulcrum-task-card__status-dot--readonly={!canToggle}
			style={done ? undefined : `border-color: ${borderPri}`}
			title={canToggle ? "Toggle done" : "Open the note to edit (mobile)"}
			on:click={onToggleDot}
			on:keydown={onToggleKeydown}
		>
			{#if done}
				<span class="fulcrum-task-card__check-icon" aria-hidden="true">✓</span>
			{/if}
		</div>
		<div class="fulcrum-task-card__content">
			<div
				role="button"
				tabindex="0"
				class="fulcrum-task-card__title"
				on:click={openTask}
				on:keydown={onTitleKeydown}
			>
				<span class="fulcrum-task-card__title-text">{task.title}</span>
			</div>
			{#if due.text || sched.text || (showProjectLink && task.projectFile) || task.tags.length > 0 || tracked}
				<div class="fulcrum-task-card__metadata">
					<div class="fulcrum-task-card__metadata-chips">
						{#if due.text}
							<span
								class="fulcrum-task-card__due"
								class:fulcrum-task-card__due--overdue={due.kind === "overdue"}
								class:fulcrum-task-card__due--today={due.kind === "today"}
							>
								{due.text}
							</span>
						{/if}
						{#if sched.text}
							<span
								class="fulcrum-task-card__scheduled"
								class:fulcrum-task-card__scheduled--past={sched.kind === "past"}
								class:fulcrum-task-card__scheduled--today={sched.kind === "today"}
							>
								{sched.text}
							</span>
						{/if}
						{#if showProjectLink && task.projectFile}
							<span class="fulcrum-task-card__project">+{projectLabel(task)}</span>
						{/if}
						{#each task.tags as tag}
							<span class="fulcrum-task-card__tag">#{tag}</span>
						{/each}
					</div>
					{#if tracked}
						<span class="fulcrum-task-card__tracked">{tracked}</span>
					{/if}
				</div>
			{/if}
			{#if task.source === "taskNote"}
				<span class="fulcrum-task-card__created-age">{formatTaskCreatedAge(task.createdAtMs)}</span>
			{/if}
		</div>
	</div>
</div>
