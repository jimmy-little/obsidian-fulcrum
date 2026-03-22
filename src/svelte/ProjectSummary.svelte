<script lang="ts">
	import type {WorkspaceLeaf} from "obsidian";
	import type {FulcrumHost} from "../fulcrum/pluginBridge";
	import {indexRevision} from "../fulcrum/stores";
	import {parseList} from "../fulcrum/settingsDefaults";
	import type {AtomicNoteRow, ProjectRollup} from "../fulcrum/types";
	import {
		daysUntilCalendar,
		formatShortMonthDay,
		formatTrackedMinutesShort,
		urgencyColorForDays,
	} from "../fulcrum/utils/dates";
	import {preferLightForegroundOnSolidHex} from "../fulcrum/utils/projectVisual";
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

	let logLines: string[] = [];
	let logDraft = "";
	let logBusy = false;

	async function loadLog(): Promise<void> {
		logLines = await plugin.loadProjectLogPreview(projectPath);
	}

	$: {
		void rev;
		void projectPath;
		void loadLog();
	}

	$: doneTask = new Set(parseList(plugin.settings.taskDoneStatuses));

	$: daysLaunch = rollup
		? daysUntilCalendar(rollup.pageMeta.launchDate)
		: null;
	$: daysReview = rollup ? daysUntilCalendar(rollup.pageMeta.nextReview) : null;
	$: colorLaunch = urgencyColorForDays(daysLaunch);
	$: colorReview = urgencyColorForDays(daysReview);

	function openPath(path: string): void {
		const f = plugin.app.vault.getAbstractFileByPath(path);
		if (f && "extension" in f) {
			void plugin.app.workspace.getLeaf("tab").openFile(f);
		}
	}

	function openNoteRow(n: AtomicNoteRow): void {
		openPath(n.file.path);
	}

	function onNoteHover(ev: MouseEvent, n: AtomicNoteRow): void {
		if (!hoverParentLeaf) return;
		plugin.triggerFulcrumHoverLink(
			ev,
			hoverParentLeaf,
			ev.currentTarget as HTMLElement,
			n.file.path,
		);
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
			await loadLog();
		} finally {
			logBusy = false;
		}
	}

	async function markReviewed(): Promise<void> {
		if (logBusy) return;
		logBusy = true;
		try {
			await plugin.markProjectReviewed(projectPath);
			await loadLog();
		} finally {
			logBusy = false;
		}
	}

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
		(bannerMode === "solid" &&
			!!rollup &&
			(!rollup.accentColorCss.startsWith("#") ||
				preferLightForegroundOnSolidHex(rollup.accentColorCss)));

	/** Text/icon color on solid buttons that use project color as background. */
	$: ctaFgOnAccent = !rollup
		? "var(--text-on-accent)"
		: rollup.accentColorCss.startsWith("#")
			? preferLightForegroundOnSolidHex(rollup.accentColorCss)
				? "rgba(255, 255, 255, 0.97)"
				: "rgba(24, 24, 28, 0.95)"
			: "rgba(255, 255, 255, 0.97)";

	$: statusPillText = rollup ? rollup.project.status.toUpperCase() : "";

	function stubNewNote(): void {
		plugin.notifyNewNoteFromProject(projectPath);
	}

	function stubNewTask(): void {
		plugin.notifyNewTaskFromProject(projectPath);
	}
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
				class:fulcrum-project-banner__inner--on-dark={bannerLightFg}
				class:fulcrum-project-banner__inner--on-light={!bannerLightFg}
			>
				<div class="fulcrum-project-banner__top">
					<div class="fulcrum-project-banner__left">
						<h1 class="fulcrum-project-banner__title">{rollup.project.name}</h1>
						{#if rollup.pageMeta.description}
							<p class="fulcrum-project-banner__desc">{rollup.pageMeta.description}</p>
						{/if}
						{#if rollup.pageMeta.launchDate}
							<ul class="fulcrum-project-banner__dates">
								<li>
									<span class="fulcrum-project-banner__date-label">Launch</span>
									{formatShortMonthDay(rollup.pageMeta.launchDate)}
									{#if daysLaunch !== null}
										<span class="fulcrum-project-banner__kpi" style="color: {colorLaunch};">
											({daysLaunch}d)
										</span>
									{/if}
								</li>
							</ul>
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
								on:click={() => void markReviewed()}
								disabled={logBusy}
							>
								Mark reviewed
							</button>
							<button type="button" class="fulcrum-banner-btn" on:click={stubNewNote}>New note</button>
							<button type="button" class="fulcrum-banner-btn" on:click={stubNewTask}>New task</button>
						</div>
					</div>
				</div>
				{#if statusPillText || ticketUrl}
					<div class="fulcrum-project-banner__foot">
						{#if statusPillText}
							<span class="fulcrum-status-pill fulcrum-status-pill--banner">{statusPillText}</span>
						{/if}
						{#if ticketUrl}
							<a
								href={ticketUrl}
								class="external-link fulcrum-project-banner__extlink"
								target="_blank"
								rel="noopener noreferrer"
							>
								External Link
							</a>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<div class="fulcrum-project-meta-strip">
			<div class="fulcrum-project-meta-strip__row">
				{#if rollup.pageMeta.lastReviewed}
					<span>Last reviewed {formatShortMonthDay(rollup.pageMeta.lastReviewed)}</span>
				{/if}
				{#if rollup.pageMeta.lastReviewed && rollup.pageMeta.nextReview}
					<span class="fulcrum-meta-sep">·</span>
				{/if}
				{#if rollup.pageMeta.nextReview}
					<span>
						Next review {formatShortMonthDay(rollup.pageMeta.nextReview)}
						{#if daysReview !== null}
							<span class="fulcrum-project-banner__kpi" style="color: {colorReview};">
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
			{#if rollup.nextTasks.length === 0}
				<p class="fulcrum-muted">No open tasks linked to this project.</p>
			{:else}
				<ul class="fulcrum-task-list fulcrum-task-agenda-list">
					{#each rollup.nextTasks.slice(0, 8) as t}
						<li>
							<TaskCard plugin={plugin} task={t} done={false} showProjectLink={false} />
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="fulcrum-section fulcrum-section--split">
			<h2>Tasks and notes</h2>

			<div class="fulcrum-block">
				<h3 class="fulcrum-block__title">Tasks</h3>
				{#if rollup.tasks.length === 0}
					<p class="fulcrum-muted">No tasks in your indexed sources link to this project.</p>
				{:else}
					<h4 class="fulcrum-block__subtitle">Open</h4>
					{#if rollup.tasks.filter((t) => !doneTask.has(t.status)).length === 0}
						<p class="fulcrum-muted">No open tasks.</p>
					{:else}
						<ul class="fulcrum-task-list fulcrum-task-agenda-list">
							{#each rollup.tasks.filter((t) => !doneTask.has(t.status)) as t}
								<li>
									<TaskCard plugin={plugin} task={t} done={false} showProjectLink={false} />
								</li>
							{/each}
						</ul>
					{/if}
					<h4 class="fulcrum-block__subtitle">Completed</h4>
					{#if rollup.tasks.filter((t) => doneTask.has(t.status)).length === 0}
						<p class="fulcrum-muted">No completed tasks indexed.</p>
					{:else}
						<ul class="fulcrum-task-list fulcrum-task-agenda-list">
							{#each rollup.tasks.filter((t) => doneTask.has(t.status)) as t}
								<li>
									<TaskCard plugin={plugin} task={t} done={true} showProjectLink={false} />
								</li>
							{/each}
						</ul>
					{/if}
				{/if}
			</div>

			<div class="fulcrum-block">
				<h3 class="fulcrum-block__title">Notes</h3>
				{#if noteFolderHint}
					<p class="fulcrum-muted">Add atomic note folder prefixes in Fulcrum settings to list linked notes here.</p>
				{:else if rollup.atomicNotes.length === 0}
					<p class="fulcrum-muted">No linked notes under your configured folders for this year.</p>
				{:else}
					<ul class="fulcrum-task-list fulcrum-task-agenda-list fulcrum-note-agenda-list">
						{#each rollup.atomicNotes as n}
							<li>
								<div
									class="fulcrum-task-card fulcrum-note-row"
									data-priority={n.priority === "high" ? "high" : n.priority === "low" ? "low" : ""}
									role="group"
									aria-label={n.entryTitle}
									on:mouseenter={(ev) => onNoteHover(ev, n)}
								>
									<div class="fulcrum-task-card__main-row fulcrum-note-row__main">
										<span class="fulcrum-note-row__spacer" aria-hidden="true" />
										<div class="fulcrum-task-card__content fulcrum-note-row__content">
											<button
												type="button"
												class="fulcrum-task-card__title"
												on:click={() => openNoteRow(n)}
											>
												<span class="fulcrum-task-card__title-text">{n.entryTitle}</span>
											</button>
											{#if n.bodyPreview}
												<p class="fulcrum-note-row__preview">{n.bodyPreview}</p>
											{/if}
											{#if n.dateDisplay || n.noteType || n.tags.length > 0 || n.trackedMinutes > 0}
												<div class="fulcrum-task-card__metadata">
													<div class="fulcrum-task-card__metadata-chips">
														{#if n.dateDisplay}
															<span class="fulcrum-task-card__note-date">{n.dateDisplay}</span>
														{/if}
														{#if n.noteType}
															<span class="fulcrum-task-card__note-type">{n.noteType}</span>
														{/if}
														{#each n.tags as tag}
															<span class="fulcrum-task-card__tag">#{tag}</span>
														{/each}
													</div>
													{#if n.trackedMinutes > 0}
														<span class="fulcrum-task-card__tracked"
															>{formatTrackedMinutesShort(n.trackedMinutes)}</span
														>
													{/if}
												</div>
											{/if}
										</div>
									</div>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>

		<section class="fulcrum-section fulcrum-section--log">
			<h2>Project log</h2>
			<p class="fulcrum-muted">
				Entries are appended to <code>{plugin.settings.projectLogSectionHeading}</code> on the project note (plain markdown, syncs everywhere).
			</p>
			<textarea
				class="fulcrum-log-input"
				rows="3"
				placeholder="Quick note for the project page…"
				bind:value={logDraft}
				disabled={logBusy}
			/>
			<div class="fulcrum-log-actions">
				<button
					type="button"
					class="mod-cta fulcrum-cta-accent"
					disabled={logBusy}
					on:click={() => void appendLog()}
				>
					Append to project note
				</button>
			</div>
			{#if logLines.length > 0}
				<ul class="fulcrum-log-preview">
					{#each logLines as line}
						<li>{line}</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
{/if}
