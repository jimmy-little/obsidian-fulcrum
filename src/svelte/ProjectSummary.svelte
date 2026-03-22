<script lang="ts">
	import type {FulcrumHost} from "../fulcrum/pluginBridge";
	import {indexRevision} from "../fulcrum/stores";
	import {parseList} from "../fulcrum/settingsDefaults";
	import type {IndexedTask} from "../fulcrum/types";
	import {
		daysUntilCalendar,
		formatShortMonthDay,
		urgencyColorForDays,
	} from "../fulcrum/utils/dates";
	import {preferLightForegroundOnSolidHex} from "../fulcrum/utils/projectVisual";

	export let plugin: FulcrumHost;
	export let projectPath: string;

	let rollup = plugin.vaultIndex.getProjectRollup(projectPath, plugin.settings);
	$: rev = $indexRevision;
	$: {
		void rev;
		rollup = plugin.vaultIndex.getProjectRollup(projectPath, plugin.settings);
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

	function statusIcon(t: IndexedTask): string {
		return doneTask.has(t.status) ? "☑" : "☐";
	}

	function formatTrackedMinutes(total: number): string {
		if (total < 1) return "0m";
		if (total < 60) return `${total}m`;
		const h = Math.floor(total / 60);
		const m = total % 60;
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
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

{#if !rollup}
	<p class="fulcrum-muted">Project not found in index. Check folder settings and frontmatter.</p>
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
					{formatTrackedMinutes(rollup.aggregatedTrackedMinutes)}
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
				<ul class="fulcrum-task-list">
					{#each rollup.nextTasks.slice(0, 8) as t}
						<li>
							<button type="button" class="fulcrum-linklike" on:click={() => openPath(t.file.path)}>
								<span>{statusIcon(t)}</span>
								<span>{t.title}</span>
								{#if t.dueDate}<span class="fulcrum-muted">due {t.dueDate.slice(0, 10)}</span>{/if}
								{#if t.priority}<span class="fulcrum-tag">{t.priority}</span>{/if}
							</button>
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
					<p class="fulcrum-muted">No TaskNotes in your task folder link to this project.</p>
				{:else}
					<div class="fulcrum-table-wrap">
						<table class="fulcrum-table">
							<thead>
								<tr>
									<th>Task</th>
									<th>Status</th>
									<th>Due</th>
								</tr>
							</thead>
							<tbody>
								{#each rollup.tasks as t}
									<tr>
										<td>
											<button type="button" class="fulcrum-linklike fulcrum-table__link" on:click={() => openPath(t.file.path)}>
												{statusIcon(t)}
												{t.title}
											</button>
										</td>
										<td>{t.status}</td>
										<td>{t.dueDate?.slice(0, 10) ?? "—"}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>

			<div class="fulcrum-block">
				<h3 class="fulcrum-block__title">Notes</h3>
				{#if noteFolderHint}
					<p class="fulcrum-muted">Add atomic note folder prefixes in Fulcrum settings to list linked notes here.</p>
				{:else if rollup.atomicNotes.length === 0}
					<p class="fulcrum-muted">No linked notes under your configured folders for this year.</p>
				{:else}
					<div class="fulcrum-table-wrap">
						<table class="fulcrum-table">
							<thead>
								<tr>
									<th>Note</th>
									<th>Status</th>
									<th>Date</th>
									<th>Time</th>
								</tr>
							</thead>
							<tbody>
								{#each rollup.atomicNotes as n}
									<tr>
										<td>
											<button type="button" class="fulcrum-linklike fulcrum-table__link" on:click={() => openPath(n.file.path)}>
												{n.file.basename.replace(/\.md$/i, "")}
											</button>
										</td>
										<td>{n.status ?? "—"}</td>
										<td>{n.dateDisplay}</td>
										<td>{n.trackedMinutes > 0 ? `${n.trackedMinutes}m` : "—"}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
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
