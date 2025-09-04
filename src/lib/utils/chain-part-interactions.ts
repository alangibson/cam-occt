import { selectChain, highlightChain, clearChainHighlight } from '../stores/chains';
import { selectPart, hoverPart, clearPartHover } from '../stores/parts';

/**
 * Shared chain interaction handlers for both Prepare and Program stages
 */

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