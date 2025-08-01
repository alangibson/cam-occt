import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { chainStore, setChains, clearChains, setTolerance, getShapeChainId, getChainShapeIds, getChainById } from './chains';
import type { ShapeChain } from '../algorithms/chain-detection';
import { generateId } from '../utils/id';
import { CutDirection, LeadType } from '../types/direction';

describe('Chain Store', () => {
  const mockChains: ShapeChain[] = [
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
  });

  it('should set chains correctly', () => {
    setChains(mockChains);
    const state = get(chainStore);
    expect(state.chains).toEqual(mockChains);
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
});