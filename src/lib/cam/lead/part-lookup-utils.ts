import type { Part } from '$lib/cam/part/interfaces';
import type { Chain } from '$lib/geometry/chain/interfaces';

/**
 * Determine if a chain (original or offset) is a hole within the given part.
 * Uses originalChainId for offset chains to get correct classification.
 */
export function isChainHoleInPart(chain: Chain, part: Part): boolean {
    const lookupId = chain.originalChainId || chain.id;

    return part.voids.some((hole) => hole.chain.id === lookupId);
}

/**
 * Determine if a chain (original or offset) is a shell for the given part.
 * Uses originalChainId for offset chains to get correct classification.
 */
export function isChainShellInPart(chain: Chain, part: Part): boolean {
    const lookupId = chain.originalChainId || chain.id;

    return part.shell.id === lookupId;
}
