import type { Point2D } from '$lib/geometry/point/interfaces';
import type { ShapeData } from '$lib/geometry/shape/interfaces';
import type { ChainData } from '$lib/geometry/chain/interfaces';
import {
    getShapeEndPoint,
    getShapeStartPoint,
} from '$lib/geometry/shape/functions';
import { CHAIN_CLOSURE_TOLERANCE } from '$lib/geometry/chain/constants';
import type { ChainEndpoint } from '$lib/stores/overlay/interfaces';
import type { CutData } from '$lib/cam/cut/interfaces';

// Helper functions to generate chain overlay data
export function generateChainEndpoints(chains: ChainData[]): ChainEndpoint[] {
    const endpoints: ChainEndpoint[] = [];

    chains.forEach((chain) => {
        if (chain.shapes.length === 0) return;

        const firstShape: ShapeData = chain.shapes[0];
        const lastShape: ShapeData = chain.shapes[chain.shapes.length - 1];

        const start: Point2D = getShapeStartPoint(firstShape);
        const end: Point2D = getShapeEndPoint(lastShape);

        endpoints.push({ ...start, type: 'start', chainId: chain.id });

        if (
            Math.abs(end.x - start.x) > CHAIN_CLOSURE_TOLERANCE ||
            Math.abs(end.y - start.y) > CHAIN_CLOSURE_TOLERANCE
        ) {
            endpoints.push({ ...end, type: 'end', chainId: chain.id });
        }
    });

    return endpoints;
}

// Helper to check if a shape is part of any chain
export function getShapeChainId(
    shapeId: string,
    chains: ChainData[],
    cuts?: CutData[] // Optional cuts parameter for searching offset shapes
): string | null {
    // First search original chains (existing logic)
    for (const chain of chains) {
        if (chain.shapes.some((shape) => shape.id === shapeId)) {
            return chain.id;
        }
    }

    // If not found in original chains, search offset shapes in cuts
    if (cuts) {
        for (const cut of cuts) {
            if (cut.offset?.offsetShapes) {
                const found = cut.offset.offsetShapes.some(
                    (s: ShapeData) => s.id === shapeId
                );
                if (found) {
                    return cut.chainId; // Return the chain that this cut is based on
                }
            }
        }
    }

    return null;
}

// Helper to get all shape IDs in the same chain
export function getChainShapeIds(
    shapeId: string,
    chains: ChainData[]
): string[] {
    for (const chain of chains) {
        if (chain.shapes.some((shape) => shape.id === shapeId)) {
            return chain.shapes.map((shape) => shape.id);
        }
    }
    return [shapeId]; // Return just the shape if not in a chain
}

// Helper to get chain by ID
export function getChainById(
    chainId: string,
    chains: ChainData[]
): ChainData | null {
    return chains.find((chain) => chain.id === chainId) || null;
}
