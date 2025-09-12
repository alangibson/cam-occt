import type { Chain } from '$lib/geometry/chain/interfaces';

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

// Helper to get shape IDs for the selected chain
export function getSelectedChainShapeIds(
    selectedChainId: string | null,
    chains: Chain[]
): string[] {
    if (!selectedChainId) return [];

    const chain: Chain | null = getChainById(selectedChainId, chains);
    return chain ? chain.shapes.map((shape) => shape.id) : [];
}
