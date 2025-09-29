import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
import type { Chain } from '$lib/geometry/chain/interfaces';

/**
 * Find the part that contains a given chain, handling both original chains and offset chains.
 * For offset chains, uses the originalChainId to find the correct part.
 */
export function findPartForChain(
    chain: Chain | string,
    parts: DetectedPart[]
): DetectedPart | undefined {
    // Handle both Chain objects and chain ID strings
    const chainId = typeof chain === 'string' ? chain : chain.id;
    const originalChainId =
        typeof chain === 'string' ? chainId : chain.originalChainId || chainId;

    // First try to find by original chain ID (handles offset chains)
    for (const part of parts) {
        if (part.shell.chain.id === originalChainId) {
            return part;
        }
        for (const hole of part.holes) {
            if (hole.chain.id === originalChainId) {
                return part;
            }
        }
    }

    // If originalChainId lookup failed and it's different from chainId,
    // also try the actual chainId as fallback
    if (originalChainId !== chainId) {
        for (const part of parts) {
            if (part.shell.chain.id === chainId) {
                return part;
            }
            for (const hole of part.holes) {
                if (hole.chain.id === chainId) {
                    return part;
                }
            }
        }
    }

    return undefined;
}

/**
 * Determine if a chain (original or offset) is a hole within the given part.
 * Uses originalChainId for offset chains to get correct classification.
 */
export function isChainHoleInPart(chain: Chain, part: DetectedPart): boolean {
    const lookupId = chain.originalChainId || chain.id;

    return part.holes.some((hole) => hole.chain.id === lookupId);
}

/**
 * Determine if a chain (original or offset) is a shell for the given part.
 * Uses originalChainId for offset chains to get correct classification.
 */
export function isChainShellInPart(chain: Chain, part: DetectedPart): boolean {
    const lookupId = chain.originalChainId || chain.id;

    return part.shell.chain.id === lookupId;
}
