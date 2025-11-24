import type { PartData } from '$lib/cam/part/interfaces';
import type { ChainData } from '$lib/cam/chain/interfaces';

/**
 * Determine if a chain (original or offset) is a hole within the given part.
 * Uses originalChainId for offset chains to get correct classification.
 */
export function isChainHoleInPart(chain: ChainData, part: PartData): boolean {
    const lookupId = chain.originalChainId || chain.id;

    return part.voids.some((hole) => hole.chain.id === lookupId);
}

/**
 * Determine if a chain (original or offset) is a shell for the given part.
 * Uses originalChainId for offset chains to get correct classification.
 */
export function isChainShellInPart(chain: ChainData, part: PartData): boolean {
    const lookupId = chain.originalChainId || chain.id;

    return part.shell.id === lookupId;
}
