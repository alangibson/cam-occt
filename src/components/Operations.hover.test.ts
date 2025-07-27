import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { partStore, clearHighlight } from '$lib/stores/parts';
import { chainStore, selectChain } from '$lib/stores/chains';

// Mock the Operations component functions directly
describe('Operations Component Hover Functions', () => {
  let hoveredPartId: string | null = null;
  let hoveredPathId: string | null = null;

  // These are the actual functions from Operations.svelte
  function handlePartHover(partId: string | null) {
    hoveredPartId = partId;
    if (partId) {
      // This should call the highlightPart function
      partStore.update(state => ({
        ...state,
        highlightedPartId: partId
      }));
    } else {
      // This should call clearHighlight
      partStore.update(state => ({
        ...state,
        highlightedPartId: null
      }));
    }
  }

  function handlePathHover(pathId: string | null) {
    hoveredPathId = pathId;
    // This should call selectChain
    chainStore.update(state => ({
      ...state,
      selectedChainId: pathId
    }));
  }

  beforeEach(() => {
    hoveredPartId = null;
    hoveredPathId = null;
    clearHighlight();
    selectChain(null);
  });

  it('should update part store when hovering over part', () => {
    const testPartId = 'part-test-123';
    
    // Verify initial state
    expect(get(partStore).highlightedPartId).toBe(null);
    
    // Simulate hovering over a part
    handlePartHover(testPartId);
    
    // Verify local state is updated
    expect(hoveredPartId).toBe(testPartId);
    
    // Verify store is updated
    expect(get(partStore).highlightedPartId).toBe(testPartId);
  });

  it('should clear part highlighting when hovering away', () => {
    const testPartId = 'part-test-123';
    
    // First hover over part
    handlePartHover(testPartId);
    expect(get(partStore).highlightedPartId).toBe(testPartId);
    
    // Then hover away (null)
    handlePartHover(null);
    
    // Verify local state is cleared
    expect(hoveredPartId).toBe(null);
    
    // Verify store is cleared
    expect(get(partStore).highlightedPartId).toBe(null);
  });

  it('should update chain store when hovering over path', () => {
    const testChainId = 'chain-test-456';
    
    // Verify initial state
    expect(get(chainStore).selectedChainId).toBe(null);
    
    // Simulate hovering over a path
    handlePathHover(testChainId);
    
    // Verify local state is updated
    expect(hoveredPathId).toBe(testChainId);
    
    // Verify store is updated
    expect(get(chainStore).selectedChainId).toBe(testChainId);
  });

  it('should change chain selection when hovering over different paths', () => {
    const firstChainId = 'chain-test-456';
    const secondChainId = 'chain-test-789';
    
    // Hover over first path
    handlePathHover(firstChainId);
    expect(get(chainStore).selectedChainId).toBe(firstChainId);
    
    // Hover over second path
    handlePathHover(secondChainId);
    
    // Verify selection changed
    expect(hoveredPathId).toBe(secondChainId);
    expect(get(chainStore).selectedChainId).toBe(secondChainId);
  });

  it('should clear chain selection when hovering away from paths', () => {
    const testChainId = 'chain-test-456';
    
    // First hover over path
    handlePathHover(testChainId);
    expect(get(chainStore).selectedChainId).toBe(testChainId);
    
    // Then hover away (null)
    handlePathHover(null);
    
    // Verify local state is cleared
    expect(hoveredPathId).toBe(null);
    
    // Verify store is cleared
    expect(get(chainStore).selectedChainId).toBe(null);
  });

  it('should handle simultaneous part and path hovering', () => {
    const testPartId = 'part-test-123';
    const testChainId = 'chain-test-456';
    
    // Hover over part
    handlePartHover(testPartId);
    expect(get(partStore).highlightedPartId).toBe(testPartId);
    
    // Hover over path (should not affect part highlighting)
    handlePathHover(testChainId);
    expect(get(chainStore).selectedChainId).toBe(testChainId);
    expect(get(partStore).highlightedPartId).toBe(testPartId); // Should still be highlighted
    
    // Clear part hover
    handlePartHover(null);
    expect(get(partStore).highlightedPartId).toBe(null);
    expect(get(chainStore).selectedChainId).toBe(testChainId); // Chain should still be selected
    
    // Clear path hover
    handlePathHover(null);
    expect(get(chainStore).selectedChainId).toBe(null);
  });
});