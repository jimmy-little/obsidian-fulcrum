import type {App, TFile} from "obsidian";
import {parseWikiLink} from "./wikilinks";

function destForRawLink(app: App, raw: unknown, sourcePath: string): TFile | null {
	if (raw == null) return null;
	if (typeof raw === "string") {
		const pl = parseWikiLink(raw);
		if (!pl) return null;
		return app.metadataCache.getFirstLinkpathDest(pl, sourcePath);
	}
	if (Array.isArray(raw)) {
		for (const item of raw) {
			const d = destForRawLink(app, item, sourcePath);
			if (d) return d;
		}
	}
	return null;
}

/** Whether this file’s `project` (or configured) field resolves to the project file. */
export function fileLinksToProject(
	app: App,
	file: TFile,
	projectPath: string,
	linkField: string,
): boolean {
	const fm = app.metadataCache.getFileCache(file)?.frontmatter as
		| Record<string, unknown>
		| undefined;
	if (!fm) return false;
	const raw = fm[linkField];
	const dest = destForRawLink(app, raw, file.path);
	return dest?.path === projectPath;
}
