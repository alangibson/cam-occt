/**
 * Visualization Helper Functions
 *
 * Functions for generating visualization overlays and finding chains/shapes
 */

import type { Chain } from '$lib/cam/chain/classes.svelte';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { Shape } from '$lib/cam/shape/classes';
import {
    getShapeStartPoint,
    getShapeEndPoint,
    getShapeOrigin,
} from '$lib/cam/shape/functions';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { ChainEndpoint, ShapePoint } from '$lib/stores/overlay/interfaces';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { CHAIN_CLOSURE_TOLERANCE } from '$lib/cam/chain/constants';

/**
 * Find a chain by ID
 */
export function getChainById(chainId: string, chains: Chain[]): Chain | null {
    return chains.find((chain) => chain.id === chainId) || null;
}

// Helper functions to generate chain overlay data
export function generateChainEndpoints(chains: ChainData[]): ChainEndpoint[] {
    const endpoints: ChainEndpoint[] = [];

    chains.forEach((chain) => {
        if (chain.shapes.length === 0) return;

        const firstShape: ShapeData = chain.shapes[0];
        const lastShape: ShapeData = chain.shapes[chain.shapes.length - 1];

        const start: Point2D = getShapeStartPoint(new Shape(firstShape));
        const end: Point2D = getShapeEndPoint(new Shape(lastShape));

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

/**
 * Get the chain ID for a shape
 */
export function getShapeChainId(
    shapeId: string,
    chains: Chain[]
): string | null {
    // Check in chains
    for (const chain of chains) {
        if (chain.shapes.some((s) => s.id === shapeId)) {
            return chain.id;
        }
    }

    return null;
}

/**
 * Get all shape IDs in a chain
 */
export function getChainShapeIds(shapeId: string, chains: Chain[]): string[] {
    for (const chain of chains) {
        if (chain.shapes.some((s) => s.id === shapeId)) {
            return chain.shapes.map((s) => s.id);
        }
    }
    return [];
}

// Helper functions to generate shape overlay data
export function generateShapePoints(
    shapes: ShapeData[],
    selectedShapeIds: Set<string>
): ShapePoint[] {
    const points: ShapePoint[] = [];

    shapes.forEach((shape) => {
        if (selectedShapeIds.has(shape.id)) {
            // Generate origin, start, and end points for selected shapes
            const origin: Point2D | null = getShapeOrigin(new Shape(shape));
            const start: Point2D = getShapeStartPoint(new Shape(shape));
            const end: Point2D = getShapeEndPoint(new Shape(shape));

            if (origin) {
                points.push({ ...origin, type: 'origin', shapeId: shape.id });
            }
            points.push({ ...start, type: 'start', shapeId: shape.id });
            points.push({ ...end, type: 'end', shapeId: shape.id });
        }
    });

    return points;
}
