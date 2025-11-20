// Helper to get all chain IDs that belong to a specific part

import type { PartVoid } from '$lib/cam/part/interfaces';
import type { Part } from '$lib/cam/part/classes.svelte';
import { PartType } from '$lib/cam/part/enums';

export function getPartChainIds(partId: string, parts: Part[]): string[] {
    const part: Part | undefined = parts.find((p) => p.id === partId);
    if (!part) return [];

    const chainIds: string[] = [];

    // Add shell chain ID
    chainIds.push(part.shell.id);

    // Add all hole chain IDs
    function addHoleChainIds(holes: PartVoid[]): void {
        for (const hole of holes) {
            chainIds.push(hole.chain.id);
        }
    }

    addHoleChainIds(part.voids);

    return chainIds;
}
// Helper to get the type of a chain (shell or hole)

export function getChainPartType(
    chainId: string,
    parts: Part[]
): PartType.SHELL | PartType.HOLE | null {
    for (const part of parts) {
        if (part.shell.id === chainId) {
            return PartType.SHELL;
        }

        // Check holes recursively
        if (isChainInHoles(chainId, part.voids)) {
            return PartType.HOLE;
        }
    }
    return null;
}
function isChainInHoles(chainId: string, holes: PartVoid[]): boolean {
    for (const hole of holes) {
        if (hole.chain.id === chainId) {
            return true;
        }
    }
    return false;
}
