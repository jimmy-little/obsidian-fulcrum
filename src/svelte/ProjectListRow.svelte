<script lang="ts">
	import type {IndexedProject} from "../fulcrum/types";
	import {daysUntilCalendar, formatShortMonthDay} from "../fulcrum/utils/dates";
	import {resolveProjectAccentCss} from "../fulcrum/utils/projectVisual";

	export let p: IndexedProject;
	export let selectedPath: string | null;
	export let onSelectProject: (path: string) => void;

	function areaLabel(project: IndexedProject): string {
		const t = project.areaName?.trim();
		return t && t.length > 0 ? t : "—";
	}

	function reviewIsOverdue(project: IndexedProject): boolean {
		if (!project.nextReview?.trim()) return false;
		const d = daysUntilCalendar(project.nextReview);
		return d !== null && d < 0;
	}

	$: overdue = reviewIsOverdue(p);
	$: accent = resolveProjectAccentCss(p.color);
	$: launchDisp = p.launchDate?.trim() ? formatShortMonthDay(p.launchDate) : "";
	$: reviewDisp = p.nextReview?.trim() ? formatShortMonthDay(p.nextReview) : "";
	$: hasMeta = Boolean(launchDisp || reviewDisp);
	$: desc = p.description?.trim() ?? "";

	function activateRow(): void {
		onSelectProject(p.file.path);
	}

	function onRowKeydown(ev: KeyboardEvent): void {
		if (ev.key !== "Enter" && ev.key !== " ") return;
		ev.preventDefault();
		activateRow();
	}
</script>

<!-- div, not button: Obsidian’s default button styles fix height and break multiline rows -->
<div
	role="button"
	tabindex="0"
	class="fulcrum-pl-row"
	class:fulcrum-pl-row--active={selectedPath === p.file.path}
	class:fulcrum-pl-row--overdue={overdue}
	style={`--fulcrum-pl-accent: ${accent}`}
	aria-label={overdue ? `${p.name}, review overdue` : p.name}
	on:click={activateRow}
	on:keydown={onRowKeydown}
>
	{#if overdue}
		<span class="fulcrum-pl-row__dot" title="Review overdue" aria-hidden="true" />
	{/if}
	<div class="fulcrum-pl-row__inner">
		<div class="fulcrum-pl-row__head">
			<span class="fulcrum-pl-row__name">{p.name}</span>
			<span class="fulcrum-pl-row__area">{areaLabel(p)}</span>
		</div>
		{#if desc}
			<p class="fulcrum-pl-row__desc">{desc}</p>
		{/if}
		{#if hasMeta}
			<div class="fulcrum-pl-row__meta">
				{#if launchDisp}
					<span class="fulcrum-pl-row__meta-part">Launch {launchDisp}</span>
				{/if}
				{#if launchDisp && reviewDisp}
					<span class="fulcrum-pl-row__meta-sep" aria-hidden="true"> · </span>
				{/if}
				{#if reviewDisp}
					<span class="fulcrum-pl-row__meta-part" class:fulcrum-pl-row__meta-part--overdue={overdue}>
						Next {reviewDisp}
					</span>
				{/if}
			</div>
		{/if}
	</div>
</div>
