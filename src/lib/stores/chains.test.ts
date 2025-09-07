import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { chainStore, setChains, clearChains, setTolerance, getShapeChainId, getChainShapeIds, getChainById, highlightChain, clearChainHighlight, selectChain } from './chains';
import type { Chain } from '../algorithms/chain-detection/chain-detection';
import { LeadType } from '../types/direction';

describe('Chain Store', () => {
  const mockChains: Chain[] = [
    {
      id: 'chain-1',
      shapes: [
        { id: 'shape-1', type: LeadType.LINE, geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } } },
        { id: 'shape-2', type: LeadType.LINE, geometry: { start: { x: 10, y: 0 }, end: { x: 20, y: 0 } } }
      ]
    },
    {
      id: 'chain-2', 
      shapes: [
        { id: 'shape-3', type: 'circle', geometry: { center: { x: 50, y: 50 }, radius: 5 } },
        { id: 'shape-4', type: LeadType.LINE, geometry: { start: { x: 55, y: 50 }, end: { x: 65, y: 50 } } }
      ]
    }
  ];

  it('should initialize with empty chains and default tolerance', () => {
    const state = get(chainStore);
    expect(state.chains).toEqual([]);
    expect(state.tolerance).toBe(0.1);
    expect(state.selectedChainId).toBeNull();
    expect(state.highlightedChainId).toBeNull();
  });

  it('should set chains correctly', () => {
    setChains(mockChains);
    const state = get(chainStore);
    // Expect that chains are set with clockwise property automatically analyzed
    expect(state.chains).toHaveLength(2);
    expect(state.chains[0].id).toBe('chain-1');
    expect(state.chains[1].id).toBe('chain-2');
    // Both chains in this test should be open (non-closed), so clockwise should be null
    expect(state.chains[0].clockwise).toBe(null);
    expect(state.chains[1].clockwise).toBe(null);
  });

  it('should clear chains', () => {
    setChains(mockChains);
    clearChains();
    const state = get(chainStore);
    expect(state.chains).toEqual([]);
  });

  it('should set tolerance', () => {
    setTolerance(0.1);
    const state = get(chainStore);
    expect(state.tolerance).toBe(0.1);
  });

  it('should get shape chain ID correctly', () => {
    const chainId = getShapeChainId('shape-1', mockChains);
    expect(chainId).toBe('chain-1');

    const nonExistentChainId = getShapeChainId('shape-999', mockChains);
    expect(nonExistentChainId).toBeNull();
  });

  it('should get all shape IDs in a chain', () => {
    const shapeIds = getChainShapeIds('shape-1', mockChains);
    expect(shapeIds).toEqual(['shape-1', 'shape-2']);

    const isolatedShapeIds = getChainShapeIds('shape-999', mockChains);
    expect(isolatedShapeIds).toEqual(['shape-999']);
  });

  it('should get chain by ID', () => {
    const chain = getChainById('chain-1', mockChains);
    expect(chain).toEqual(mockChains[0]);

    const nonExistentChain = getChainById('chain-999', mockChains);
    expect(nonExistentChain).toBeNull();
  });

  describe('Chain Highlighting', () => {
    it('should highlight a chain', () => {
      const testChainId = 'chain-123';
      
      highlightChain(testChainId);
      
      const state = get(chainStore);
      expect(state.highlightedChainId).toBe(testChainId);
      expect(state.selectedChainId).toBeNull(); // Should not affect selection
    });

    it('should clear chain highlight', () => {
      const testChainId = 'chain-123';
      
      // First highlight a chain
      highlightChain(testChainId);
      expect(get(chainStore).highlightedChainId).toBe(testChainId);
      
      // Then clear the highlight
      clearChainHighlight();
      expect(get(chainStore).highlightedChainId).toBeNull();
    });

    it('should allow highlighting and selection to coexist', () => {
      const selectedChainId = 'chain-selected';
      const highlightedChainId = 'chain-highlighted';
      
      // Select one chain and highlight another
      selectChain(selectedChainId);
      highlightChain(highlightedChainId);
      
      const state = get(chainStore);
      expect(state.selectedChainId).toBe(selectedChainId);
      expect(state.highlightedChainId).toBe(highlightedChainId);
    });

    it('should handle null chain highlighting', () => {
      highlightChain(null);
      
      const state = get(chainStore);
      expect(state.highlightedChainId).toBeNull();
    });
  });
});