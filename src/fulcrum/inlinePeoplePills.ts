import {MarkdownView, normalizePath, type App, type Plugin, TFile} from "obsidian";
import type {FulcrumSettings} from "./settingsDefaults";
import {getPersonNameAndAvatar} from "./projectPeople";
import {isUnderFolder} from "./utils/paths";

const PILL_ATTR = "data-fulcrum-person-pill";

/** Same silhouette as `fulcrum-person-card` when no `avatar` image is set. */
const PERSON_AVATAR_PLACEHOLDER_SVG =
	'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="3"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>';

function skipLinkHost(el: HTMLElement): boolean {
	return !!el.closest("pre, code");
}

function transformPeopleLinksInRoot(
	app: App,
	root: HTMLElement,
	sourcePath: string,
	s: FulcrumSettings,
): void {
	const folder = normalizePath(s.peopleFolder.trim());
	if (!folder) return;

	const avatarField = s.peopleAvatarField.trim() || "avatar";
	const anchors = Array.from(root.querySelectorAll("a.internal-link"));

	for (const node of anchors) {
		if (!(node instanceof HTMLAnchorElement)) continue;
		if (node.hasAttribute(PILL_ATTR)) continue;
		if (skipLinkHost(node)) continue;

		const linktext =
			(node.dataset.href && node.dataset.href.trim()) ||
			node.getAttribute("href")?.replace(/^#/, "").trim() ||
			node.textContent?.trim() ||
			"";
		if (!linktext) continue;

		const dest = app.metadataCache.getFirstLinkpathDest(linktext, sourcePath);
		if (!(dest instanceof TFile)) continue;
		if (!isUnderFolder(dest.path, folder)) continue;

		const {name, avatarSrc} = getPersonNameAndAvatar(app, dest, avatarField);

		node.setAttribute(PILL_ATTR, "1");
		node.classList.add("fulcrum-person-inline-pill");
		node.replaceChildren();

		const av = document.createElement("span");
		av.className = "fulcrum-person-inline-pill__avatar";
		av.setAttribute("aria-hidden", "true");
		if (avatarSrc) {
			const img = document.createElement("img");
			img.src = avatarSrc;
			img.alt = "";
			av.append(img);
		} else {
			av.innerHTML = PERSON_AVATAR_PLACEHOLDER_SVG;
		}

		const nameEl = document.createElement("span");
		nameEl.className = "fulcrum-person-inline-pill__name";
		nameEl.textContent = name;

		node.append(av, nameEl);
	}
}

/**
 * Reading view: markdown post-processor. Live Preview does not use this path — see {@link registerLivePreviewPeoplePillScan}.
 */
export function registerInlinePeoplePills(
	plugin: Plugin,
	getSettings: () => FulcrumSettings,
): void {
	plugin.registerMarkdownPostProcessor((el, ctx) => {
		if (!ctx.sourcePath) return;
		transformPeopleLinksInRoot(plugin.app, el, ctx.sourcePath, getSettings());
	}, 100);
}

/**
 * Source + Live Preview: `registerMarkdownPostProcessor` is not invoked there; scan editor DOM when it changes.
 */
export function registerLivePreviewPeoplePillScan(
	plugin: Plugin,
	getSettings: () => FulcrumSettings,
): void {
	let debounceTimer: number | undefined;

	function scanMarkdownLeaves(): void {
		plugin.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			if (!(view instanceof MarkdownView) || !view.file) return;
			transformPeopleLinksInRoot(
				plugin.app,
				view.containerEl,
				view.file.path,
				getSettings(),
			);
		});
	}

	function scheduleScan(): void {
		window.clearTimeout(debounceTimer);
		debounceTimer = window.setTimeout(() => {
			debounceTimer = undefined;
			scanMarkdownLeaves();
		}, 90);
	}

	const mo = new MutationObserver(() => {
		scheduleScan();
	});
	mo.observe(plugin.app.workspace.containerEl, {childList: true, subtree: true});

	plugin.registerEvent(plugin.app.workspace.on("active-leaf-change", scheduleScan));
	plugin.registerEvent(plugin.app.workspace.on("layout-change", scheduleScan));
	plugin.registerEvent(
		plugin.app.metadataCache.on("changed", (file) => {
			if (file instanceof TFile && file.extension === "md") scheduleScan();
		}),
	);

	scheduleScan();

	plugin.register(() => {
		window.clearTimeout(debounceTimer);
		mo.disconnect();
	});
}
