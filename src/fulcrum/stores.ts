import {writable} from "svelte/store";

/** Incremented after each index rebuild so views refresh. */
export const indexRevision = writable(0);

export function bumpIndexRevision(): void {
	indexRevision.update((n: number) => n + 1);
}
