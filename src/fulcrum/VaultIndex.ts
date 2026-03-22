import type {App, TFile} from "obsidian";
import type {FulcrumSettings} from "./settingsDefaults";
import {parseList} from "./settingsDefaults";
import {readProjectPageMeta} from "./projectNote";
import type {
	AtomicNoteRow,
	IndexedArea,
	IndexedMeeting,
	IndexedProject,
	IndexedTask,
	IndexSnapshot,
	ProjectRollup,
} from "./types";
import {isUnderFolder} from "./utils/paths";
import {isOverdue} from "./utils/dates";
import {parseWikiLink} from "./utils/wikilinks";
import {parseFolderPrefixList, isUnderAtomicPrefixes} from "./utils/atomicFolders";
import {fileLinksToProject} from "./utils/projectLink";
import {readTrackedMinutesFromFm} from "./utils/trackedMinutes";
import {resolveBannerImageSrc, resolveProjectAccentCss} from "./utils/projectVisual";
import {bumpIndexRevision} from "./stores";

function fmString(fm: Record<string, unknown> | undefined, key: string): string | undefined {
	if (!fm) return undefined;
	const v = fm[key];
	if (typeof v === "string") return v;
	if (typeof v === "number" || typeof v === "boolean") return String(v);
	return undefined;
}

function tagsIncludeTask(fm: Record<string, unknown>, tag: string): boolean {
	const t = fm.tags;
	const want = tag.toLowerCase();
	if (Array.isArray(t)) {
		return t.some((x) => String(x).toLowerCase() === want);
	}
	if (typeof t === "string") {
		return t
			.split(/[\s,]+/)
			.map((s) => s.replace(/^#/, "").toLowerCase())
			.includes(want);
	}
	return false;
}

export class VaultIndex {
	private app: App;
	private getSettings: () => FulcrumSettings;
	private snapshot: IndexSnapshot = {
		areas: [],
		projects: [],
		tasks: [],
		meetings: [],
		rebuiltAt: 0,
	};
	private debounceHandle: number | null = null;

	constructor(app: App, getSettings: () => FulcrumSettings) {
		this.app = app;
		this.getSettings = getSettings;
	}

	getSnapshot(): IndexSnapshot {
		return this.snapshot;
	}

	scheduleRebuild(): void {
		if (this.debounceHandle != null) {
			window.clearTimeout(this.debounceHandle);
		}
		this.debounceHandle = window.setTimeout(() => {
			this.debounceHandle = null;
			void this.rebuild();
		}, 400);
	}

	async rebuild(): Promise<void> {
		const s = this.getSettings();
		const areas: IndexedArea[] = [];
		const projects: IndexedProject[] = [];
		const tasks: IndexedTask[] = [];
		const meetings: IndexedMeeting[] = [];

		const typeField = s.typeField;
		const apRoot = s.areasProjectsFolder;

		for (const file of this.app.vault.getMarkdownFiles()) {
			const cache = this.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter as Record<string, unknown> | undefined;
			const path = file.path;

			const inAP = isUnderFolder(path, apRoot);
			const inTasks = s.taskNotesEnabled && isUnderFolder(path, s.taskNotesFolder);
			const inMeetings = isUnderFolder(path, s.meetingsFolder);

			const tVal = fmString(fm, typeField)?.toLowerCase();
			const areaTypeLc = s.areaTypeValue.toLowerCase();
			const projectTypeLc = s.projectTypeValue.toLowerCase();

			if (inAP && fm && tVal === areaTypeLc) {
				areas.push({
					file,
					name: fmString(fm, "name") ?? file.basename,
					status: fmString(fm, "status"),
					color: fmString(fm, "color"),
					icon: fmString(fm, "icon"),
					description: fmString(fm, "description"),
				});
				continue;
			}

			const isExplicitProject = tVal === projectTypeLc;
			const isInferredProject =
				s.inferProjectsInAreasFolder && tVal !== areaTypeLc;
			if (inAP && fm && (isExplicitProject || isInferredProject)) {
				const areaLink = parseWikiLink(fm[s.areaLinkField]);
				const areaFile = areaLink
					? this.app.metadataCache.getFirstLinkpathDest(areaLink, file.path)
					: null;
				projects.push({
					file,
					name: fmString(fm, "name") ?? file.basename,
					status: (fmString(fm, "status") ?? "active").toLowerCase(),
					priority: fmString(fm, s.taskPriorityField)?.toLowerCase(),
					startDate: fmString(fm, "startDate"),
					dueDate: fmString(fm, s.taskDueDateField),
					completedDate: fmString(fm, "completedDate"),
					areaFile,
					areaName: areaFile?.basename.replace(/\.md$/i, ""),
					banner: fmString(fm, s.projectBannerField),
					color: fmString(fm, s.projectColorField),
				});
				continue;
			}

			if (inTasks && fm && (tagsIncludeTask(fm, s.taskTag) || tVal === "task")) {
				const pl = parseWikiLink(fm[s.projectLinkField]);
				const al = parseWikiLink(fm[s.areaLinkField]);
				const projectFile = pl
					? this.app.metadataCache.getFirstLinkpathDest(pl, file.path)
					: null;
				const areaFile = al
					? this.app.metadataCache.getFirstLinkpathDest(al, file.path)
					: null;
				const status = (fmString(fm, s.taskStatusField) ?? "todo").toLowerCase();
				tasks.push({
					file,
					title: fmString(fm, s.taskTitleField) ?? file.basename,
					status,
					priority: fmString(fm, s.taskPriorityField)?.toLowerCase(),
					dueDate: fmString(fm, s.taskDueDateField),
					completedDate: fmString(fm, s.taskCompletedDateField),
					projectFile,
					areaFile,
				});
				continue;
			}

			if (inMeetings && fm) {
				const durRaw = fm[s.meetingDurationField];
				const duration =
					typeof durRaw === "number"
						? durRaw
						: typeof durRaw === "string"
							? Number.parseFloat(durRaw)
							: undefined;
				const tmRaw = fm[s.meetingTotalMinutesField];
				const totalMinutesTracked =
					typeof tmRaw === "number"
						? tmRaw
						: typeof tmRaw === "string"
							? Number.parseFloat(tmRaw)
							: undefined;
				const pl = parseWikiLink(fm[s.projectLinkField]);
				const projectFile = pl
					? this.app.metadataCache.getFirstLinkpathDest(pl, file.path)
					: null;
				meetings.push({
					file,
					date: fmString(fm, s.meetingDateField),
					title: fmString(fm, s.meetingTitleField) ?? file.basename,
					duration: Number.isFinite(duration) ? duration : undefined,
					totalMinutesTracked: Number.isFinite(totalMinutesTracked)
						? totalMinutesTracked
						: undefined,
					projectFile,
				});
			}
		}

		this.snapshot = {
			areas,
			projects,
			tasks,
			meetings,
			rebuiltAt: Date.now(),
		};
		bumpIndexRevision();
	}

	resolveProjectByPath(path: string): IndexedProject | undefined {
		return this.snapshot.projects.find((p) => p.file.path === path);
	}

	getProjectRollup(projectPath: string, s: FulcrumSettings): ProjectRollup | null {
		const project = this.resolveProjectByPath(projectPath);
		if (!project) return null;

		const done = new Set(parseList(s.taskDoneStatuses));
		const projectTasks = this.snapshot.tasks.filter(
			(t) => t.projectFile?.path === projectPath,
		);
		const meetings = this.snapshot.meetings.filter(
			(m) => m.projectFile?.path === projectPath,
		);

		const year = String(new Date().getFullYear());
		const prefixes = parseFolderPrefixList(s.atomicNoteFolderPrefixes);
		const linkField = s.projectLinkField;
		const atomicRows: AtomicNoteRow[] = [];

		for (const f of this.app.vault.getMarkdownFiles()) {
			if (f.path === projectPath) continue;
			if (!fileLinksToProject(this.app, f, projectPath, linkField)) continue;
			if (isUnderFolder(f.path, s.taskNotesFolder)) continue;
			if (prefixes.length > 0 && !isUnderAtomicPrefixes(f.path, prefixes, year)) {
				continue;
			}
			if (prefixes.length === 0) continue;

			const cache = this.app.metadataCache.getFileCache(f);
			const fm = cache?.frontmatter as Record<string, unknown> | undefined;
			const dateRaw = fmString(fm, "date") ?? fmString(fm, "startTime");
			const dateSort = dateRaw
				? dateRaw.slice(0, 10)
				: new Date(f.stat.mtime).toISOString().slice(0, 10);
			atomicRows.push({
				file: f,
				status: fmString(fm, s.taskStatusField) ?? fmString(fm, "status"),
				dateSort,
				dateDisplay: dateSort,
				trackedMinutes: readTrackedMinutesFromFm(fm),
			});
		}

		atomicRows.sort((a, b) => {
			const c = b.dateSort.localeCompare(a.dateSort);
			if (c !== 0) return c;
			return b.file.basename.localeCompare(a.file.basename);
		});

		let doneTasks = 0;
		let overdueTasks = 0;
		for (const t of projectTasks) {
			const isDone = done.has(t.status);
			if (isDone) doneTasks++;
			if (isOverdue(t.dueDate, isDone)) overdueTasks++;
		}
		const totalTasks = projectTasks.length;
		const openTasks = totalTasks - doneTasks;
		const completionRatio =
			totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

		const openTaskList = projectTasks.filter((t) => !done.has(t.status));
		const priorityRank: Record<string, number> = {high: 3, medium: 2, low: 1};
		const nextTasks = [...openTaskList].sort((a, b) => {
			const ad = a.dueDate ?? "\uffff";
			const bd = b.dueDate ?? "\uffff";
			if (ad !== bd) return ad.localeCompare(bd);
			const ap = priorityRank[a.priority ?? ""] ?? 0;
			const bp = priorityRank[b.priority ?? ""] ?? 0;
			return bp - ap;
		});

		const pageMeta = readProjectPageMeta(this.app, project.file, s);
		const projectFm = this.app.metadataCache.getFileCache(project.file)?.frontmatter as
			| Record<string, unknown>
			| undefined;
		const projectSelfMinutes = readTrackedMinutesFromFm(projectFm);

		let taskTracked = 0;
		for (const t of projectTasks) {
			const tfm = this.app.metadataCache.getFileCache(t.file)?.frontmatter as
				| Record<string, unknown>
				| undefined;
			taskTracked += readTrackedMinutesFromFm(tfm);
		}

		let atomicSum = 0;
		const atomicPaths = new Set<string>();
		for (const r of atomicRows) {
			atomicSum += r.trackedMinutes;
			atomicPaths.add(r.file.path);
		}

		let meetingOnlyMinutes = 0;
		for (const m of meetings) {
			if (atomicPaths.has(m.file.path)) continue;
			if (m.totalMinutesTracked != null) meetingOnlyMinutes += m.totalMinutesTracked;
			else if (m.duration != null) meetingOnlyMinutes += m.duration;
		}

		const aggregatedTrackedMinutes =
			projectSelfMinutes + taskTracked + atomicSum + meetingOnlyMinutes;

		const hasProjectColor = Boolean(project.color?.trim());
		const bannerImageSrc = resolveBannerImageSrc(
			this.app,
			project.file,
			project.banner,
		);
		const accentColorCss = resolveProjectAccentCss(
			hasProjectColor ? project.color : undefined,
		);

		return {
			project,
			tasks: projectTasks,
			meetings,
			atomicNotes: atomicRows,
			totalTasks,
			doneTasks,
			openTasks,
			overdueTasks,
			completionRatio,
			nextTasks,
			aggregatedTrackedMinutes,
			pageMeta,
			bannerImageSrc,
			accentColorCss,
			hasBannerImage: bannerImageSrc != null,
			hasProjectColor,
		};
	}

	/** Active projects: not in done status set. */
	getActiveProjects(s: FulcrumSettings): IndexedProject[] {
		const done = new Set(parseList(s.projectDoneStatuses));
		return this.snapshot.projects.filter((p) => !done.has(p.status));
	}

	projectsForArea(areaFile: TFile): IndexedProject[] {
		return this.snapshot.projects.filter((p) => p.areaFile?.path === areaFile.path);
	}
}
