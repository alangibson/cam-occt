import { writable } from 'svelte/store';
import type { Chain } from '../algorithms/chain-detection/chain-detection';
import { setChainsDirection } from '../algorithms/chain-detection/chain-detection';

export interface ChainStore {
    chains: Chain[];
    tolerance: number;
    selectedChainId: string | null;
    highlightedChainId: string | null;
}

const initialState: ChainStore = {
    chains: [],
    tolerance: 0.1,
    selectedChainId: null,
    highlightedChainId: null,
};

export const chainStore: ReturnType<typeof writable<ChainStore>> =
    writable<ChainStore>(initialState);

// Helper functions
export function setChains(chains: Chain[]) {
    chainStore.update((state) => {
        // Automatically analyze and set clockwise property for all chains when they're first set
        const chainsWithDirection = setChainsDirection(chains, state.tolerance);
        return {
            ...state,
            chains: chainsWithDirection,
        };
    });
}

export function clearChains() {
    chainStore.update((state) => ({
        ...state,
        chains: [],
    }));
}

export function setTolerance(tolerance: number) {
    chainStore.update((state) => ({
        ...state,
        tolerance,
    }));
}

// Helper to check if a shape is part of any chain
export function getShapeChainId(
    shapeId: string,
    chains: Chain[]
): string | null {
    for (const chain of chains) {
        if (chain.shapes.some((shape) => shape.id === shapeId)) {
            return chain.id;
        }
    }
    return null;
}

// Helper to get all shape IDs in the same chain
export function getChainShapeIds(shapeId: string, chains: Chain[]): string[] {
    for (const chain of chains) {
        if (chain.shapes.some((shape) => shape.id === shapeId)) {
            return chain.shapes.map((shape) => shape.id);
        }
    }
    return [shapeId]; // Return just the shape if not in a chain
}

// Helper to get chain by ID
export function getChainById(chainId: string, chains: Chain[]): Chain | null {
    return chains.find((chain) => chain.id === chainId) || null;
}

// Chain selection functions
export function selectChain(chainId: string | null) {
    chainStore.update((state) => ({
        ...state,
        selectedChainId: chainId,
    }));
}

export function clearChainSelection() {
    chainStore.update((state) => ({
        ...state,
        selectedChainId: null,
    }));
}

// Helper to get shape IDs for the selected chain
export function getSelectedChainShapeIds(
    selectedChainId: string | null,
    chains: Chain[]
): string[] {
    if (!selectedChainId) return [];

    const chain: Chain | null = getChainById(selectedChainId, chains);
    return chain ? chain.shapes.map((shape) => shape.id) : [];
}

// Chain highlighting functions
export function highlightChain(chainId: string | null) {
    chainStore.update((state) => ({
        ...state,
        highlightedChainId: chainId,
    }));
}

export function clearChainHighlight() {
    chainStore.update((state) => ({
        ...state,
        highlightedChainId: null,
    }));
}
