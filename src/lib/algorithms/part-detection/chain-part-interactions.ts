import { chainStore } from '$lib/stores/chains/store';
import { partStore } from '$lib/stores/parts/store';
import type {
    DetectedPart,
    PartHole,
} from '$lib/algorithms/part-detection/part-detection';

/**
 * Shared chain interaction handlers for both Prepare and Program stages
 */

/**
 * Find the part that contains a given chain (either as shell or hole).
 * This is used by both simulation and lead visualization to ensure consistent lead calculations.
 * @param chainId - The ID of the chain to find
 * @param parts - Array of detected parts to search
 * @returns The part containing the chain, or undefined if not found
 */
export function findPartContainingChain(
    chainId: string,
    parts: DetectedPart[]
): DetectedPart | undefined {
    if (!chainId || !parts) return undefined;

    return parts.find(
        (p) =>
            p.shell.chain.id === chainId ||
            p.holes.some((h: PartHole) => h.chain.id === chainId)
    );
}

// Chain selection functions
export function handleChainClick(
    chainId: string,
    selectedChainId: string | null
) {
    if (selectedChainId === chainId) {
        chainStore.selectChain(null); // Deselect if already selected
    } else {
        chainStore.selectChain(chainId);
    }
}

// Chain hover functions
export function handleChainMouseEnter(chainId: string) {
    chainStore.highlightChain(chainId);
}

export function handleChainMouseLeave() {
    // Clear chain highlight on mouse leave since chains have separate selection state
    chainStore.clearChainHighlight();
}

// Part selection functions
export function handlePartClick(partId: string, selectedPartId: string | null) {
    if (selectedPartId === partId) {
        partStore.selectPart(null);
    } else {
        partStore.selectPart(partId);
    }
}

// Part hover functions
export function handlePartMouseEnter(partId: string) {
    partStore.hoverPart(partId);
}

export function handlePartMouseLeave() {
    partStore.clearPartHover();
}
