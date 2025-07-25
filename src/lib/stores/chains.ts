import { writable } from 'svelte/store';
import type { ShapeChain } from '../algorithms/chain-detection';

interface ChainStore {
  chains: ShapeChain[];
  tolerance: number;
  selectedChainId: string | null;
}

const initialState: ChainStore = {
  chains: [],
  tolerance: 0.1,
  selectedChainId: null
};

export const chainStore = writable<ChainStore>(initialState);

// Helper functions
export function setChains(chains: ShapeChain[]) {
  chainStore.update(state => ({
    ...state,
    chains
  }));
}

export function clearChains() {
  chainStore.update(state => ({
    ...state,
    chains: []
  }));
}

export function setTolerance(tolerance: number) {
  chainStore.update(state => ({
    ...state,
    tolerance
  }));
}

// Helper to check if a shape is part of any chain
export function getShapeChainId(shapeId: string, chains: ShapeChain[]): string | null {
  for (const chain of chains) {
    if (chain.shapes.some(shape => shape.id === shapeId)) {
      return chain.id;
    }
  }
  return null;
}

// Helper to get all shape IDs in the same chain
export function getChainShapeIds(shapeId: string, chains: ShapeChain[]): string[] {
  for (const chain of chains) {
    if (chain.shapes.some(shape => shape.id === shapeId)) {
      return chain.shapes.map(shape => shape.id);
    }
  }
  return [shapeId]; // Return just the shape if not in a chain
}

// Helper to get chain by ID
export function getChainById(chainId: string, chains: ShapeChain[]): ShapeChain | null {
  return chains.find(chain => chain.id === chainId) || null;
}

// Chain selection functions
export function selectChain(chainId: string | null) {
  chainStore.update(state => ({
    ...state,
    selectedChainId: chainId
  }));
}

export function clearChainSelection() {
  chainStore.update(state => ({
    ...state,
    selectedChainId: null
  }));
}

// Helper to get shape IDs for the selected chain
export function getSelectedChainShapeIds(selectedChainId: string | null, chains: ShapeChain[]): string[] {
  if (!selectedChainId) return [];
  
  const chain = getChainById(selectedChainId, chains);
  return chain ? chain.shapes.map(shape => shape.id) : [];
}