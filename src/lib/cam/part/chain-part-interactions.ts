import { selectionStore } from '$lib/stores/selection/store';
import type { Part, PartVoid } from './interfaces';

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
    parts: Part[]
): Part | undefined {
    if (!chainId || !parts) return undefined;

    return parts.find(
        (p) =>
            p.shell.id === chainId ||
            p.voids.some((h: PartVoid) => h.chain.id === chainId)
    );
}

// Chain selection functions
// Note: This function is called AFTER DrawingCanvas has already handled the selection.
// DrawingCanvas handles Ctrl/Cmd+click for multi-select, so we don't need to modify
// the selection here. This function is mainly for future extensibility.
export function handleChainClick(
    _chainId: string,
    _selectedChainIds: Set<string>
) {
    // Selection is already handled by DrawingCanvas
    // This function can be used for additional side effects if needed
}

// Chain hover functions
export function handleChainMouseEnter(chainId: string) {
    selectionStore.highlightChain(chainId);
}

export function handleChainMouseLeave() {
    // Clear chain highlight on mouse leave since chains have separate selection state
    selectionStore.clearChainHighlight();
}

// Part selection functions
// Note: This function is called AFTER DrawingCanvas has already handled the selection.
// DrawingCanvas handles Ctrl/Cmd+click for multi-select, so we don't need to modify
// the selection here. This function is mainly for future extensibility.
export function handlePartClick(
    _partId: string,
    _selectedPartIds: Set<string>
) {
    // Selection is already handled by DrawingCanvas
    // This function can be used for additional side effects if needed
}

// Part hover functions
export function handlePartMouseEnter(partId: string) {
    selectionStore.hoverPart(partId);
}

export function handlePartMouseLeave() {
    selectionStore.clearPartHover();
}
