import type {App} from "obsidian";
import {TFile} from "obsidian";
import {parseWikiLink} from "./wikilinks";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;

/** Map common vault color tokens to hex (extend as needed). */
const NAMED_PROJECT_COLORS: Record<string, string> = {
	charcoal: "#36454f",
	navy: "#1a237e",
	slate: "#546e7a",
	red: "#c0392b",
	orange: "#e67e22",
	yellow: "#f1c40f",
	green: "#27ae60",
	blue: "#2980b9",
	purple: "#8e44ad",
	pink: "#d63384",
	teal: "#00897b",
	coral: "#ff7f50",
	olive: "#708238",
	crimson: "#dc143c",
	violet: "#7b1fa2",
	sky: "#039be5",
	mint: "#26a69a",
	amber: "#ffb300",
	rust: "#b7410e",
	lavender: "#9575cd",
	sand: "#c2b280",
	gray: "#757575",
	grey: "#757575",
};

/**
 * CSS color for borders, charts, and solid banner fallback.
 * Unknown strings are passed through (valid CSS color names work).
 */
export function resolveProjectAccentCss(
	raw: string | undefined | null,
	fallback: string = "var(--interactive-accent)",
): string {
	if (raw == null || !String(raw).trim()) return fallback;
	const t = String(raw).trim();
	if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(t)) return t;
	if (/^(rgb|hsl)a?\(/i.test(t)) return t;
	const key = t.toLowerCase();
	const named = NAMED_PROJECT_COLORS[key];
	if (named) return named;
	return t;
}

function stripEmbedBang(s: string): string {
	return s.replace(/^\s*!\[\[/, "[[");
}

/**
 * Observable URI for `<img src>`, or remote https URL, or null.
 */
export function resolveBannerImageSrc(
	app: App,
	sourceFile: TFile,
	bannerRaw: string | undefined | null,
): string | null {
	if (bannerRaw == null || !String(bannerRaw).trim()) return null;
	let s = String(bannerRaw).trim();
	if (/^https?:\/\//i.test(s)) return s;

	s = stripEmbedBang(s);
	const link = parseWikiLink(s) ?? (s.includes("[[") ? null : s);
	if (!link) return null;

	const dest = app.metadataCache.getFirstLinkpathDest(link, sourceFile.path);
	if (dest instanceof TFile && IMAGE_EXT.test(dest.path)) {
		return app.vault.getResourcePath(dest);
	}
	return null;
}

function normalizeHexToRgb(hexIn: string): {r: number; g: number; b: number} | null {
	let h = hexIn.trim();
	const short = h.match(/^#([0-9a-fA-F]{3})$/i);
	if (short?.[1]) {
		const [r, g, b] = short[1].split("");
		h = `#${r}${r}${g}${g}${b}${b}`;
	}
	const m6 = h.match(/^#([0-9a-fA-F]{6})$/i);
	if (m6?.[1]) {
		const n = Number.parseInt(m6[1], 16);
		return {r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255};
	}
	const m8 = h.match(/^#([0-9a-fA-F]{8})$/i);
	if (m8?.[1]) {
		const n = Number.parseInt(m8[1].slice(0, 6), 16);
		return {r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255};
	}
	return null;
}

function srgbChannelToLinear(c: number): number {
	const x = c / 255;
	return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function relativeLuminanceHex(hex: string): number | null {
	const rgb = normalizeHexToRgb(hex);
	if (!rgb) return null;
	const R = srgbChannelToLinear(rgb.r);
	const G = srgbChannelToLinear(rgb.g);
	const B = srgbChannelToLinear(rgb.b);
	return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** Prefer white/light UI text on top of this solid hex background. */
export function preferLightForegroundOnSolidHex(hex: string): boolean {
	const L = relativeLuminanceHex(hex);
	if (L == null) return true;
	return L < 0.5;
}

/** Rough luminance (legacy); prefer {@link preferLightForegroundOnSolidHex} for banners. */
export function isHexLikelyDark(cssHex: string): boolean {
	const L = relativeLuminanceHex(cssHex);
	if (L == null) return true;
	return L < 0.5;
}
