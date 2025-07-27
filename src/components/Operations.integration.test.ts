import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { partStore, highlightPart, clearHighlight } from '$lib/stores/parts';
import { chainStore, selectChain } from '$lib/stores/chains';

describe('Operations Highlighting Integration', () => {
  beforeEach(() => {
    // Reset stores
    clearHighlight();
    selectChain(null);
  });

  it('should highlight parts in part store when handlePartHover is called', () => {
    const testPartId = 'part-123';
    
    // Verify initial state
    expect(get(partStore).highlightedPartId).toBe(null);
    
    // Simulate hovering over a part in Operations apply-to menu
    highlightPart(testPartId);
    
    // Verify part is highlighted in store
    expect(get(partStore).highlightedPartId).toBe(testPartId);
  });

  it('should clear part highlighting when hovering away', () => {
    const testPartId = 'part-123';
    
    // First highlight a part
    highlightPart(testPartId);
    expect(get(partStore).highlightedPartId).toBe(testPartId);
    
    // Then clear highlighting (simulating mouse leave)
    clearHighlight();
    
    // Verify highlighting is cleared
    expect(get(partStore).highlightedPartId).toBe(null);
  });

  it('should select chains in chain store when handlePathHover is called', () => {
    const testChainId = 'chain-456';
    
    // Verify initial state
    expect(get(chainStore).selectedChainId).toBe(null);
    
    // Simulate hovering over a path in Operations apply-to menu
    selectChain(testChainId);
    
    // Verify chain is selected in store
    expect(get(chainStore).selectedChainId).toBe(testChainId);
  });

  it('should change chain selection when hovering over different paths', () => {
    const firstChainId = 'chain-456';
    const secondChainId = 'chain-789';
    
    // Select first chain
    selectChain(firstChainId);
    expect(get(chainStore).selectedChainId).toBe(firstChainId);
    
    // Select second chain (simulating hovering over different path)
    selectChain(secondChainId);
    
    // Verify selection changed
    expect(get(chainStore).selectedChainId).toBe(secondChainId);
  });

  it('should clear chain selection when hovering away from paths', () => {
    const testChainId = 'chain-456';
    
    // First select a chain
    selectChain(testChainId);
    expect(get(chainStore).selectedChainId).toBe(testChainId);
    
    // Then clear selection (simulating mouse leave)
    selectChain(null);
    
    // Verify selection is cleared
    expect(get(chainStore).selectedChainId).toBe(null);
  });

  it('should handle multiple rapid hover changes correctly', () => {
    const partId1 = 'part-111';
    const partId2 = 'part-222';
    const chainId1 = 'chain-111';
    const chainId2 = 'chain-222';
    
    // Simulate rapid hovering between parts and paths
    highlightPart(partId1);
    expect(get(partStore).highlightedPartId).toBe(partId1);
    
    selectChain(chainId1);
    expect(get(chainStore).selectedChainId).toBe(chainId1);
    
    highlightPart(partId2);
    expect(get(partStore).highlightedPartId).toBe(partId2);
    
    selectChain(chainId2);
    expect(get(chainStore).selectedChainId).toBe(chainId2);
    
    // Clear both
    clearHighlight();
    selectChain(null);
    
    expect(get(partStore).highlightedPartId).toBe(null);
    expect(get(chainStore).selectedChainId).toBe(null);
  });
});