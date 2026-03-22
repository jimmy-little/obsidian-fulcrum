import type {App, TFile, Vault} from "obsidian";
import {normalizePath} from "obsidian";
import {appendFulcrumProjectLog, formatFulcrumProjectLogLine} from "./projectNote";
import {parseList, type FulcrumSettings} from "./settingsDefaults";

async function ensureFolderPath(vault: Vault, folderPath: string): Promise<void> {
	const norm = normalizePath(folderPath.trim());
	if (!norm) throw new Error("Folder path is empty.");
	const segments = norm.split("/").filter(Boolean);
	let acc = "";
	for (const seg of segments) {
		acc = acc ? `${acc}/${seg}` : seg;
		if (vault.getAbstractFileByPath(acc)) continue;
		await vault.createFolder(acc);
	}
}

function uniqueFilePathInDir(vault: Vault, dir: string, fileName: string): string {
	const base = normalizePath(`${dir}/${fileName}`);
	if (!vault.getAbstractFileByPath(base)) return base;
	const stem = fileName.replace(/\.md$/i, "");
	let n = 1;
	for (;;) {
		const p = normalizePath(`${dir}/${stem} (${n}).md`);
		if (!vault.getAbstractFileByPath(p)) return p;
		n += 1;
	}
}

/**
 * Appends a log line, sets project status to the first configured “done” status, then moves the note
 * into the completed-projects folder (unless it is already there). Uses {@link FileManager.renameFile}
 * so Obsidian can update links.
 */
export async function markProjectCompleteAndMove(
	app: App,
	projectFile: TFile,
	s: FulcrumSettings,
	options?: {note?: string},
): Promise<string> {
	const destDir = normalizePath(s.completedProjectsFolder.trim());
	if (!destDir) throw new Error("Set a completed projects folder in Fulcrum settings.");

	await ensureFolderPath(app.vault, destDir);

	const note = options?.note?.replace(/\s+/g, " ").trim() ?? "";
	const logMessage = note.length > 0 ? `Marked complete — ${note}` : "Marked complete";
	await appendFulcrumProjectLog(
		app,
		projectFile,
		s.projectLogSectionHeading,
		formatFulcrumProjectLogLine(logMessage),
	);

	const statusKey = s.projectStatusField.trim().replace(/:+$/u, "") || "status";
	const doneStatuses = parseList(s.projectDoneStatuses);
	const statusValue = (doneStatuses[0] ?? "completed").trim().toLowerCase();

	await app.fileManager.processFrontMatter(projectFile, (fm) => {
		(fm as Record<string, unknown>)[statusKey] = statusValue;
	});

	const parent = projectFile.parent?.path ?? "";
	if (normalizePath(parent) === destDir) {
		return projectFile.path;
	}

	const newPath = uniqueFilePathInDir(app.vault, destDir, projectFile.name);
	await app.fileManager.renameFile(projectFile, newPath);
	return newPath;
}
