import { selectChain, highlightChain, clearChainHighlight } from '../stores/chains';
import { selectPart, hoverPart, clearPartHover } from '../stores/parts';
import type { DetectedPart, PartHole } from '../algorithms/part-detection';

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
export function findPartContainingChain(chainId: string, parts: DetectedPart[]): DetectedPart | undefined {
  if (!chainId || !parts) return undefined;
  
  return parts.find(p => 
    p.shell.chain.id === chainId || 
    p.holes.some((h: PartHole) => h.chain.id === chainId)
  );
}

// Chain selection functions
export function handleChainClick(chainId: string, selectedChainId: string | null) {
  if (selectedChainId === chainId) {
    selectChain(null); // Deselect if already selected
  } else {
    selectChain(chainId);
  }
}

// Chain hover functions
export function handleChainMouseEnter(chainId: string) {
  highlightChain(chainId);
}

export function handleChainMouseLeave() {
  // Clear chain highlight on mouse leave since chains have separate selection state
  clearChainHighlight();
}

// Part selection functions  
export function handlePartClick(partId: string, selectedPartId: string | null) {
  if (selectedPartId === partId) {
    selectPart(null);
  } else {
    selectPart(partId);
  }
}

// Part hover functions  
export function handlePartMouseEnter(partId: string) {
  hoverPart(partId);
}

export function handlePartMouseLeave() {
  clearPartHover();
}