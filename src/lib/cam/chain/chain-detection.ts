import type { Point2D } from '$lib/geometry/point/interfaces';
import { Shape } from '$lib/cam/shape/classes';
import { calculateSquaredDistance } from '$lib/geometry/math/functions';
import { getShapePoints } from '$lib/cam/shape/functions';
import { detectCutDirection } from '$lib/cam/cut/cut-direction';
import { CutDirection } from '$lib/cam/cut/enums';
import { CHAIN_CLOSURE_TOLERANCE } from '$lib/cam/chain/constants';
import { Chain } from '$lib/cam/chain/classes.svelte';
import { generateId } from '$lib/domain/id';

interface ChainDetectionOptions {
    tolerance: number;
}

/**
 * Core algorithm to detect chains of shapes based on point overlap within tolerance.
 *
 * A chain is defined as a connected sequence of shapes where:
 * - Some point in shape A overlaps with some point in shape B within the tolerance
 * - The overlap relationship is transitive (A connects to B, B connects to C → A, B, C form a chain)
 * - ALL shapes form chains, including single isolated shapes (both open and closed)
 *
 * Algorithm uses Union-Find (Disjoint Set) data structure for efficient chain detection.
 */
export function detectShapeChains(
    shapes: Shape[],
    options: ChainDetectionOptions = { tolerance: 0.05 }
): Chain[] {
    if (shapes.length === 0) return [];

    const { tolerance }: { tolerance: number } = options;
    const unionFind: UnionFind = new UnionFind(shapes.length);

    // Compare each pair of shapes for connectivity
    for (let i: number = 0; i < shapes.length; i++) {
        for (let j: number = i + 1; j < shapes.length; j++) {
            if (areShapesConnected(shapes[i], shapes[j], tolerance)) {
                unionFind.union(i, j);
            }
        }
    }

    // Group shapes by their root component
    const chainGroups: Map<number, number[]> = new Map<number, number[]>();
    for (let i: number = 0; i < shapes.length; i++) {
        const root: number = unionFind.find(i);
        if (!chainGroups.has(root)) {
            chainGroups.set(root, []);
        }
        chainGroups.get(root)!.push(i);
    }

    // Convert to ShapeChain objects
    const chains: Chain[] = [];
    let chainId: number = 1;

    for (const [, shapeIndices] of chainGroups) {
        if (shapeIndices.length > 1) {
            // Multiple connected shapes form a chain
            chains.push(
                new Chain({
                    id: generateId(),
                    name: `${chainId}`,
                    shapes: shapeIndices.map((index) => shapes[index]),
                })
            );
            chainId++;
        } else if (shapeIndices.length === 1) {
            // Single shape - ALL single shapes form chains (both open and closed)
            const singleShape: Shape = shapes[shapeIndices[0]];
            chains.push(
                new Chain({
                    id: generateId(),
                    name: `${chainId}`,
                    shapes: [singleShape],
                })
            );
            chainId++;
        }
    }

    return chains;
}

/**
 * Check if two shapes are connected (any point from shape A overlaps with any point from shape B within tolerance)
 */
function areShapesConnected(
    shapeA: Shape,
    shapeB: Shape,
    tolerance: number
): boolean {
    const pointsA: Point2D[] = getShapePoints(shapeA, {
        mode: 'CHAIN_DETECTION',
    });
    const pointsB: Point2D[] = getShapePoints(shapeB, {
        mode: 'CHAIN_DETECTION',
    });

    // Check if any point from shape A is within tolerance of any point from shape B
    for (const pointA of pointsA) {
        for (const pointB of pointsB) {
            if (arePointsWithinTolerance(pointA, pointB, tolerance)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Check if two points are within the specified tolerance distance
 */
function arePointsWithinTolerance(
    pointA: Point2D,
    pointB: Point2D,
    tolerance: number
): boolean {
    const distance: number = Math.sqrt(
        calculateSquaredDistance(pointA, pointB)
    );
    return distance <= tolerance;
}

/**
 * Union-Find (Disjoint Set) data structure for efficient connected component detection
 */
class UnionFind {
    private parent: number[];
    private rank: number[];

    constructor(size: number) {
        this.parent = Array.from({ length: size }, (_, i) => i);
        this.rank = new Array(size).fill(0);
    }

    find(x: number): number {
        if (this.parent[x] !== x) {
            this.parent[x] = this.find(this.parent[x]); // Path compression
        }
        return this.parent[x];
    }

    union(x: number, y: number): boolean {
        const rootX: number = this.find(x);
        const rootY: number = this.find(y);

        if (rootX === rootY) return false; // Already in same set

        // Union by rank for optimal performance
        if (this.rank[rootX] < this.rank[rootY]) {
            this.parent[rootX] = rootY;
        } else if (this.rank[rootX] > this.rank[rootY]) {
            this.parent[rootY] = rootX;
        } else {
            this.parent[rootY] = rootX;
            this.rank[rootX]++;
        }

        return true;
    }
}

/**
 * Analyze and set the clockwise property for a chain.
 * This should be called once during the Prepare stage when chains are first created.
 *
 * @param chain - The chain to analyze
 * @param tolerance - Tolerance for determining if chain is closed
 * @returns The chain with clockwise property set
 */
function setChainDirection(
    chain: Chain,
    tolerance: number = CHAIN_CLOSURE_TOLERANCE
): Chain {
    const direction = detectCutDirection(chain, tolerance);

    return new Chain({
        id: chain.id,
        name: chain.name,
        shapes: chain.shapes,
        clockwise:
            direction === CutDirection.CLOCKWISE
                ? true
                : direction === CutDirection.COUNTERCLOCKWISE
                  ? false
                  : null,
        originalChainId: chain.originalChainId,
    });
}

/**
 * Analyze and set clockwise properties for multiple chains.
 *
 * @param chains - Array of chains to analyze
 * @param tolerance - Tolerance for determining if chains are closed
 * @returns Array of chains with clockwise properties set
 */
export function setChainsDirection(
    chains: Chain[],
    tolerance: number = CHAIN_CLOSURE_TOLERANCE
): Chain[] {
    return chains.map((chain) => setChainDirection(chain, tolerance));
}
