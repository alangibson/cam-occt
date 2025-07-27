import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { partStore, highlightPart, clearHighlight } from '$lib/stores/parts';
import { chainStore, selectChain } from '$lib/stores/chains';

describe('Operations Final Integration Test', () => {
  beforeEach(() => {
    clearHighlight();
    selectChain(null);
  });

  it('should complete full part hover workflow like Operations component', () => {
    const testPartId = 'part-final-123';
    
    console.log('=== Testing Part Hover Workflow ===');
    
    // Step 1: Verify initial state (like when page loads)
    const initialState = get(partStore);
    console.log('Initial part store:', initialState);
    expect(initialState.highlightedPartId).toBe(null);
    
    // Step 2: Simulate mouseenter on part in Operations apply-to menu
    console.log('Simulating mouseenter on part:', testPartId);
    highlightPart(testPartId);
    
    // Step 3: Verify store is updated (this should trigger DrawingCanvas re-render)
    const highlightedState = get(partStore);
    console.log('Part store after highlight:', highlightedState);
    expect(highlightedState.highlightedPartId).toBe(testPartId);
    
    // Step 4: Simulate mouseleave from part in Operations apply-to menu
    console.log('Simulating mouseleave from part');
    clearHighlight();
    
    // Step 5: Verify highlighting is cleared
    const clearedState = get(partStore);
    console.log('Part store after clear:', clearedState);
    expect(clearedState.highlightedPartId).toBe(null);
  });

  it('should complete full path hover workflow like Operations component', () => {
    const testChainId = 'chain-final-456';
    
    console.log('=== Testing Path Hover Workflow ===');
    
    // Step 1: Verify initial state
    const initialState = get(chainStore);
    console.log('Initial chain store:', initialState);
    expect(initialState.selectedChainId).toBe(null);
    
    // Step 2: Simulate mouseenter on path in Operations apply-to menu
    console.log('Simulating mouseenter on path:', testChainId);
    selectChain(testChainId);
    
    // Step 3: Verify store is updated (this should trigger DrawingCanvas re-render)
    const selectedState = get(chainStore);
    console.log('Chain store after selection:', selectedState);
    expect(selectedState.selectedChainId).toBe(testChainId);
    
    // Step 4: Simulate hover over different path
    const secondChainId = 'chain-final-789';
    console.log('Simulating mouseenter on different path:', secondChainId);
    selectChain(secondChainId);
    
    // Step 5: Verify selection changed
    const changedState = get(chainStore);
    console.log('Chain store after selection change:', changedState);
    expect(changedState.selectedChainId).toBe(secondChainId);
    
    // Step 6: Simulate mouseleave from path (hovering away)
    console.log('Simulating mouseleave from path');
    selectChain(null);
    
    // Step 7: Verify selection is cleared
    const clearedState = get(chainStore);
    console.log('Chain store after clear:', clearedState);
    expect(clearedState.selectedChainId).toBe(null);
  });

  it('should handle complex interaction workflow', () => {
    const partId = 'part-complex-111';
    const chainId = 'chain-complex-222';
    
    console.log('=== Testing Complex Interaction Workflow ===');
    
    // User hovers over part in Operations menu
    highlightPart(partId);
    expect(get(partStore).highlightedPartId).toBe(partId);
    expect(get(chainStore).selectedChainId).toBe(null);
    
    // User then hovers over path in Operations menu (part should stay highlighted)
    selectChain(chainId);
    expect(get(partStore).highlightedPartId).toBe(partId);
    expect(get(chainStore).selectedChainId).toBe(chainId);
    
    // User hovers away from part but stays on path
    clearHighlight();
    expect(get(partStore).highlightedPartId).toBe(null);
    expect(get(chainStore).selectedChainId).toBe(chainId);
    
    // User hovers away from path
    selectChain(null);
    expect(get(partStore).highlightedPartId).toBe(null);
    expect(get(chainStore).selectedChainId).toBe(null);
    
    console.log('Complex workflow completed successfully');
  });

  it('should verify DrawingCanvas would get the correct data', () => {
    console.log('=== Testing DrawingCanvas Integration Data ===');
    
    const testPartId = 'part-canvas-integration';
    const testChainId = 'chain-canvas-integration';
    
    // Simulate what DrawingCanvas reactive statements would see
    let partStoreValue = get(partStore);
    let chainStoreValue = get(chainStore);
    
    console.log('Before any changes:');
    console.log('  partStore.highlightedPartId:', partStoreValue.highlightedPartId);
    console.log('  chainStore.selectedChainId:', chainStoreValue.selectedChainId);
    
    // Highlight part (like Operations component does on part hover)
    highlightPart(testPartId);
    partStoreValue = get(partStore);
    console.log('After highlighting part:');
    console.log('  partStore.highlightedPartId:', partStoreValue.highlightedPartId);
    expect(partStoreValue.highlightedPartId).toBe(testPartId);
    
    // Select chain (like Operations component does on path hover)
    selectChain(testChainId);
    chainStoreValue = get(chainStore);
    console.log('After selecting chain:');
    console.log('  chainStore.selectedChainId:', chainStoreValue.selectedChainId);
    expect(chainStoreValue.selectedChainId).toBe(testChainId);
    
    // This is the data that DrawingCanvas reactive statements would receive
    console.log('DrawingCanvas would see:');
    console.log('  $partStore.highlightedPartId =', partStoreValue.highlightedPartId);
    console.log('  $chainStore.selectedChainId =', chainStoreValue.selectedChainId);
    
    // Clear everything
    clearHighlight();
    selectChain(null);
    
    partStoreValue = get(partStore);
    chainStoreValue = get(chainStore);
    console.log('After clearing everything:');
    console.log('  partStore.highlightedPartId:', partStoreValue.highlightedPartId);
    console.log('  chainStore.selectedChainId:', chainStoreValue.selectedChainId);
    
    expect(partStoreValue.highlightedPartId).toBe(null);
    expect(chainStoreValue.selectedChainId).toBe(null);
  });
});