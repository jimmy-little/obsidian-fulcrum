<script lang="ts">
	import type {WorkspaceLeaf} from "obsidian";
	import {setIcon} from "obsidian";
	import type {FulcrumHost} from "../fulcrum/pluginBridge";
	import {indexRevision} from "../fulcrum/stores";
	import {parseList} from "../fulcrum/settingsDefaults";
	import type {AtomicNoteRow, ProjectRollup} from "../fulcrum/types";
	import {
		daysSinceCalendar,
		daysUntilCalendar,
		formatShortMonthDay,
		formatTrackedMinutesShort,
		urgencyColorForDays,
	} from "../fulcrum/utils/dates";
	import {
		buildActivityRowModels,
		buildNextUpItems,
		incompleteProjectTasks,
	} from "../fulcrum/utils/projectActivity";
	import {preferLightForegroundOnAccentCss} from "../fulcrum/utils/projectVisual";
	import type {ProjectLogActivityEntry} from "../fulcrum/projectNote";
	import ActivityRow from "./ActivityRow.svelte";
	import TaskCard from "./TaskCard.svelte";

	export let plugin: FulcrumHost;
	export let projectPath: string;
	export let hoverParentLeaf: WorkspaceLeaf | undefined = undefined;

	let rollup: ProjectRollup | null = null;
	let rollupLoadId = 0;
	let rollupMissing = false;

	$: rev = $indexRevision;
	$: {
		void rev;
		void projectPath;
		if (!plugin.vaultIndex.resolveProjectByPath(projectPath)) {
			rollupMissing = true;
			rollup = null;
		} else {
			rollupMissing = false;
			const id = ++rollupLoadId;
			void plugin.vaultIndex.getProjectRollup(projectPath, plugin.settings).then((r) => {
				if (id === rollupLoadId) rollup = r;
			});
		}
	}

	let logEntries: ProjectLogActivityEntry[] = [];
	let logDraft = "";
	let logBusy = false;
	let snapshotBtnEl: HTMLButtonElement | null = null;

	async function loadLogActivity(): Promise<void> {
		logEntries = await plugin.loadProjectLogActivity(projectPath);
	}

	$: {
		void rev;
		void projectPath;
		void loadLogActivity();
	}

	$: doneTask = new Set(parseList(plugin.settings.taskDoneStatuses));

	$: daysSinceReview = rollup
		? daysSinceCalendar(rollup.pageMeta.lastReviewed)
		: null;
	$: daysReview = rollup ? daysUntilCalendar(rollup.pageMeta.nextReview) : null;
	$: colorReview = urgencyColorForDays(daysReview);

	function openPath(path: string): void {
		const f = plugin.app.vault.getAbstractFileByPath(path);
		if (f && "extension" in f) {
			void plugin.app.workspace.getLeaf("tab").openFile(f);
		}
	}

	function noteChipsNext(n: AtomicNoteRow): import("../fulcrum/utils/projectActivity").ActivityChip[] {
		const c: import("../fulcrum/utils/projectActivity").ActivityChip[] = [];
		if (n.dateDisplay) c.push({kind: "date", label: n.dateDisplay});
		if (n.noteType) c.push({kind: "type", label: n.noteType.replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, "$1")});
		for (const t of n.tags) c.push({kind: "tag", label: `#${t}`});
		if (n.trackedMinutes > 0) c.push({kind: "tracked", label: formatTrackedMinutesShort(n.trackedMinutes)});
		if (n.priority) c.push({kind: "misc", label: n.priority});
		return c;
	}

	function jiraHref(raw: string | undefined): string | null {
		if (!raw?.trim()) return null;
		const t = raw.trim();
		if (/^https?:\/\//i.test(t)) return t;
		return null;
	}

	async function appendLog(): Promise<void> {
		if (logBusy) return;
		logBusy = true;
		try {
			await plugin.appendProjectLogEntry(projectPath, logDraft);
			logDraft = "";
			await loadLogActivity();
		} finally {
			logBusy = false;
		}
	}

	async function captureSnapshot(): Promise<void> {
		await plugin.archiveProjectSnapshot(projectPath);
	}

	$: if (snapshotBtnEl) setIcon(snapshotBtnEl, "camera");

	function markReviewed(): void {
		plugin.openMarkReviewedModal(projectPath, () => void loadLogActivity());
	}

	$: nextUpItems = rollup ? buildNextUpItems(rollup, doneTask, 8) : [];

	$: openTasks = rollup ? incompleteProjectTasks(rollup.tasks, doneTask) : [];

	$: activityRows = rollup
		? buildActivityRowModels(rollup, logEntries, {
				projectPath,
				doneTask,
				openPath,
				openTask: (t) => plugin.openIndexedTask(t),
				formatTracked: formatTrackedMinutesShort,
			})
		: [];

	$: noteFolderHint =
		plugin.settings.atomicNoteFolderPrefixes.trim().length === 0;

	$: ticketUrl = rollup ? jiraHref(rollup.pageMeta.jira) : null;

	$: bannerMode = !rollup
		? "plain"
		: rollup.hasBannerImage
			? "image"
			: rollup.hasProjectColor
				? "solid"
				: "plain";

	/** White/light text on banner (image, or solid color that reads as “dark” via WCAG luminance). */
	$: bannerLightFg =
		bannerMode === "image" ||
		(bannerMode === "solid" && !!rollup && preferLightForegroundOnAccentCss(rollup.accentColorCss));

	/** Text/icon color on solid buttons that use project color as background. */
	$: ctaFgOnAccent = !rollup
		? "var(--text-on-accent)"
		: preferLightForegroundOnAccentCss(rollup.accentColorCss)
			? "rgba(255, 255, 255, 0.97)"
			: "rgba(24, 24, 28, 0.95)";

	$: statusPillText = rollup ? rollup.project.status.toUpperCase() : "";

	function statusPillKind(status: string): string {
		const x = status.toLowerCase();
		if (
			x === "active" ||
			x.includes("progress") ||
			x.includes("ongoing")
		) {
			return "active";
		}
		if (x.includes("done") || x.includes("complete") || x.includes("closed")) {
			return "done";
		}
		if (x.includes("block") || x.includes("hold") || x.includes("pause")) {
			return "blocked";
		}
		return "neutral";
	}

	$: statusKind = rollup ? statusPillKind(rollup.project.status) : "neutral";

	function markProjectComplete(): void {
		plugin.openMarkProjectCompleteModal(projectPath);
	}

	$: taskSourceMode = plugin.settings.taskSourceMode;
	$: showNewInlineTaskBtn = taskSourceMode === "obsidianTasks" || taskSourceMode === "both";
	$: showNewTaskNoteBtn = taskSourceMode === "taskNotes" || taskSourceMode === "both";
</script>

{#if rollupMissing}
	<p class="fulcrum-muted">Project not found in index. Check folder settings and frontmatter.</p>
{:else if !rollup}
	<p class="fulcrum-muted">Loading project…</p>
{:else}
	<div
		class="fulcrum-project"
		style="--fulcrum-accent: {rollup.accentColorCss}; --fulcrum-cta-fg: {ctaFgOnAccent};"
	>
		<div
			class="fulcrum-project-banner"
			class:fulcrum-project-banner--image={bannerMode === "image"}
			class:fulcrum-project-banner--solid={bannerMode === "solid"}
			class:fulcrum-project-banner--plain={bannerMode === "plain"}
			style={bannerMode === "solid" ? `background-color: ${rollup.accentColorCss};` : undefined}
		>
			{#if rollup.hasBannerImage && rollup.bannerImageSrc}
				<img class="fulcrum-project-banner__img" src={rollup.bannerImageSrc} alt="" />
				<div class="fulcrum-project-banner__scrim" />
			{/if}
			<div
				class="fulcrum-project-banner__inner"
				class:fulcrum-project-banner__inner--has-foot={true}
				class:fulcrum-project-banner__inner--on-dark={bannerLightFg}
				class:fulcrum-project-banner__inner--on-light={!bannerLightFg}
			>
				<div class="fulcrum-project-banner__top">
					<div class="fulcrum-project-banner__left">
						<h1 class="fulcrum-project-banner__title">{rollup.project.name}</h1>
						{#if rollup.pageMeta.description}
							<p class="fulcrum-project-banner__desc">{rollup.pageMeta.description}</p>
						{/if}
					</div>
					<div class="fulcrum-project-banner__right">
						{#if rollup.project.areaName}
							<div class="fulcrum-project-banner__area">{rollup.project.areaName}</div>
						{/if}
						<div class="fulcrum-project-banner__actions">
							<button
								type="button"
								class="fulcrum-banner-btn"
								on:click={() => openPath(rollup.project.file.path)}
							>
								Open note
							</button>
							<button
								type="button"
								class="fulcrum-banner-btn"
								on:click={markReviewed}
							>
								Mark reviewed
							</button>
							<button type="button" class="fulcrum-banner-btn" on:click={markProjectComplete}>
								Mark complete
							</button>
						</div>
					</div>
				</div>
				<div class="fulcrum-project-banner__foot">
					<div class="fulcrum-project-banner__foot-left">
						{#if statusPillText}
							<button
								type="button"
								class="fulcrum-status-pill fulcrum-status-pill--banner fulcrum-status-pill--jira fulcrum-status-pill--clickable"
								data-fulcrum-status={statusKind}
								title="Change status"
								on:click={() => {
									plugin.openChangeProjectStatusModal(
										projectPath,
										rollup.project.status,
										(newPath) => {
											if (newPath) void plugin.openProjectSummary(newPath);
										},
									);
								}}
							>
								{statusPillText}
							</button>
						{/if}
						{#if ticketUrl}
							<a
								href={ticketUrl}
								class="external-link fulcrum-project-banner__extlink"
								target="_blank"
								rel="noopener noreferrer"
							>
								External link
							</a>
						{/if}
					</div>
					<button
						type="button"
						class="fulcrum-banner-btn fulcrum-snapshot-btn"
						title="Capture snapshot"
						bind:this={snapshotBtnEl}
						on:click={() => void captureSnapshot()}
					></button>
				</div>
			</div>
		</div>

		<div class="fulcrum-project-meta-strip">
			<div class="fulcrum-project-meta-strip__row">
				{#if rollup.pageMeta.lastReviewed}
					<span>
						Last reviewed {formatShortMonthDay(rollup.pageMeta.lastReviewed)}
						{#if daysSinceReview !== null}
							<span class="fulcrum-meta-days fulcrum-meta-days--since">
								(+{daysSinceReview}d)
							</span>
						{/if}
					</span>
				{/if}
				{#if rollup.pageMeta.lastReviewed && rollup.pageMeta.nextReview}
					<span class="fulcrum-meta-sep">·</span>
				{/if}
				{#if rollup.pageMeta.nextReview}
					<span>
						Next review {formatShortMonthDay(rollup.pageMeta.nextReview)}
						{#if daysReview !== null}
							<span class="fulcrum-meta-days" style="color: {colorReview};">
								({daysReview}d)
							</span>
						{/if}
					</span>
				{/if}
			</div>
		</div>

		<div class="fulcrum-hero-row fulcrum-hero-row--quad">
			<div class="fulcrum-mega-stat fulcrum-mega-stat--neutral">
				<div class="fulcrum-mega-stat__value">
					{formatTrackedMinutesShort(rollup.aggregatedTrackedMinutes) || "0m"}
				</div>
				<div class="fulcrum-mega-stat__label">Time tracked</div>
			</div>
			<div class="fulcrum-mega-stat fulcrum-mega-stat--neutral">
				<div class="fulcrum-mega-stat__value">
					{rollup.doneTasks}<span class="fulcrum-mega-stat__sub"> / {rollup.totalTasks}</span>
				</div>
				<div class="fulcrum-mega-stat__label">Completed</div>
			</div>
			<div class="fulcrum-mega-stat fulcrum-mega-stat--neutral">
				<div class="fulcrum-mega-stat__value">{rollup.openTasks}</div>
				<div class="fulcrum-mega-stat__label">Open tasks</div>
			</div>
			<div class="fulcrum-mega-stat fulcrum-mega-stat--neutral">
				<div class="fulcrum-mega-stat__value">{rollup.atomicNotes.length}</div>
				<div class="fulcrum-mega-stat__label">Notes</div>
			</div>
		</div>

		<section class="fulcrum-section">
			<h2>Next up</h2>
			{#if nextUpItems.length === 0}
				<p class="fulcrum-muted">Nothing with a date of today or later (tasks need due or scheduled; notes use their primary date).</p>
			{:else}
				<ul class="fulcrum-activity-list fulcrum-next-up-list">
					{#each nextUpItems as item}
						<li>
							{#if item.kind === "task" && item.task}
								<TaskCard
									plugin={plugin}
									task={item.task}
									done={false}
									showProjectLink={false}
								/>
							{:else if item.kind === "note" && item.note}
								<ActivityRow
									title={item.note.entryTitle}
									chips={noteChipsNext(item.note)}
									kind="note"
									whenClick={() => item.note && openPath(item.note.file.path)}
									{plugin}
									hoverParentLeaf={hoverParentLeaf}
									hoverPath={item.note.file.path}
								/>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="fulcrum-section">
			<div class="fulcrum-section-head">
				<h2 class="fulcrum-section-head__title">Tasks</h2>
				{#if showNewInlineTaskBtn || showNewTaskNoteBtn}
					<div class="fulcrum-section-head__actions">
						{#if showNewInlineTaskBtn}
							<button
								type="button"
								class="fulcrum-text-action"
								on:click={() => plugin.openNewInlineTaskForProject(projectPath)}
							>
								New Task
							</button>
						{/if}
						{#if showNewTaskNoteBtn}
							<button
								type="button"
								class="fulcrum-text-action"
								on:click={() => plugin.openTaskNoteCreateForProject(projectPath)}
							>
								New TaskNote
							</button>
						{/if}
					</div>
				{/if}
			</div>
			{#if rollup.tasks.length === 0}
				<p class="fulcrum-muted">No tasks in your indexed sources link to this project.</p>
			{:else if openTasks.length === 0}
				<p class="fulcrum-muted">No incomplete tasks.</p>
			{:else}
				<ul class="fulcrum-task-list fulcrum-task-agenda-list">
					{#each openTasks as t}
						<li>
							<TaskCard plugin={plugin} task={t} done={false} showProjectLink={false} />
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="fulcrum-section">
			<h2>Activity</h2>
			{#if noteFolderHint && rollup.atomicNotes.length === 0 && activityRows.length === 0}
				<p class="fulcrum-muted">
					Add atomic note folder prefixes in Fulcrum settings to include linked notes here.
				</p>
			{:else if activityRows.length === 0}
				<p class="fulcrum-muted">No activity to show yet.</p>
			{:else}
				<ul class="fulcrum-activity-list fulcrum-activity-list--timeline">
					{#each activityRows as row}
						<li>
							<ActivityRow
								variant="timeline"
								title={row.title}
								chips={row.chips}
								kind={row.kind}
								whenClick={row.open}
								{plugin}
								hoverParentLeaf={hoverParentLeaf}
								hoverPath={row.hoverPath}
							/>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		{#if rollup.relatedPeople?.length > 0}
			<section class="fulcrum-section fulcrum-section--people">
				<h2 class="fulcrum-section--people__title">Related people</h2>
				<div class="fulcrum-people-grid">
					{#each rollup.relatedPeople as person (person.file.path)}
						<button
							type="button"
							class="fulcrum-person-card"
							aria-label={person.name}
							on:click={() => openPath(person.file.path)}
						>
							<div class="fulcrum-person-card__avatar">
								{#if person.avatarSrc}
									<img src={person.avatarSrc} alt="" />
								{:else}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
										<circle cx="12" cy="8" r="3"/>
										<path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
									</svg>
								{/if}
							</div>
							<span class="fulcrum-person-card__name">{person.name}</span>
						</button>
					{/each}
				</div>
			</section>
		{/if}

		<section class="fulcrum-section fulcrum-section--log">
			<h2>Project log</h2>
			<div class="fulcrum-log-row">
				<textarea
					class="fulcrum-log-input"
					rows="3"
					placeholder="Quick note for the project page…"
					bind:value={logDraft}
					disabled={logBusy}
				/>
				<button
					type="button"
					class="mod-cta fulcrum-cta-accent"
					disabled={logBusy}
					on:click={() => void appendLog()}
				>
					Append to project note
				</button>
			</div>
		</section>
	</div>
{/if}
