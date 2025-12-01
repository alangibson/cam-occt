/**
 * Chain Normalization Algorithm
 *
 * Analyzes chains to detect cases where shapes have coincident points but
 * are not properly connected for chain traversal (end-to-start connectivity).
 *
 * Issues detected:
 * - Two lines with coincident end points (should be end-to-start)
 * - Two lines with coincident start points (should be end-to-start)
 * - Shapes with coincident points that break traversal order
 */

import { Chain } from '$lib/cam/chain/classes';
import { Shape } from '$lib/cam/shape/classes';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import type { ChainNormalizationParameters } from '$lib/cam/preprocess/algorithm-parameters';
import { DEFAULT_CHAIN_NORMALIZATION_PARAMETERS_MM } from '$lib/cam/preprocess/algorithm-parameters';
import {
    getShapeEndPoint,
    getShapeStartPoint,
    reverseShape,
} from '$lib/cam/shape/functions';
import { CHAIN_CLOSURE_TOLERANCE } from '$lib/cam/chain/constants';
import {
    DEFAULT_ARRAY_NOT_FOUND_INDEX,
    PRECISION_DECIMAL_PLACES,
    TOLERANCE_RELAXATION_MULTIPLIER,
} from '$lib/geometry/constants';
import { detectCutDirection } from '$lib/cam/cut/cut-direction';
import { CutDirection } from '$lib/cam/cut/enums';

interface ChainTraversalIssue {
    type:
        | 'coincident_endpoints'
        | 'coincident_startpoints'
        | 'broken_traversal';
    chainId: string;
    shapeIndex1: number;
    shapeIndex2: number;
    point1: Point2D;
    point2: Point2D;
    description: string;
}

export interface ChainNormalizationResult {
    chainId: string;
    issues: ChainTraversalIssue[];
    canTraverse: boolean;
    description: string;
}

/**
 * Normalizes a chain by reordering and reversing shapes for proper traversal
 */
export function normalizeChain(
    chain: Chain,
    params: ChainNormalizationParameters = DEFAULT_CHAIN_NORMALIZATION_PARAMETERS_MM
): Chain {
    const { traversalTolerance }: { traversalTolerance: number } = params;

    let normalizedShapes: Shape[];

    if (chain.shapes.length <= 1) {
        // Single shape - no traversal order needed, but still need to normalize
        normalizedShapes = chain.shapes;
    } else {
        // Multiple shapes - find optimal traversal order
        normalizedShapes = buildOptimalTraversalOrder(
            chain.shapes,
            traversalTolerance
        );
    }

    // Create the normalized chain with updated shapes
    const normalizedChain = new Chain({
        id: chain.id,
        name: chain.name,
        shapes: normalizedShapes.map((s) => s.toData()),
        clockwise: chain.clockwise,
        originalChainId: chain.originalChainId,
    });

    // Set the chain-level clockwise property based on the final geometry
    const direction = detectCutDirection(normalizedChain, traversalTolerance);

    return new Chain({
        id: normalizedChain.id,
        name: normalizedChain.name,
        shapes: normalizedChain.shapes.map((s) => s.toData()),
        clockwise:
            direction === CutDirection.CLOCKWISE
                ? true
                : direction === CutDirection.COUNTERCLOCKWISE
                  ? false
                  : null, // null for open chains
        originalChainId: normalizedChain.originalChainId,
    });
}

/**
 * Analyzes all chains for traversal issues
 */
export function analyzeChainTraversal(
    chains: Chain[],
    params: ChainNormalizationParameters = DEFAULT_CHAIN_NORMALIZATION_PARAMETERS_MM
): ChainNormalizationResult[] {
    return chains.map((chain) => analyzeChainTraversalIssues(chain, params));
}

/**
 * Analyzes a single chain for traversal issues
 */
function analyzeChainTraversalIssues(
    chain: Chain,
    params: ChainNormalizationParameters = DEFAULT_CHAIN_NORMALIZATION_PARAMETERS_MM
): ChainNormalizationResult {
    const issues: ChainTraversalIssue[] = [];

    if (chain.shapes.length < 2) {
        return {
            chainId: chain.id,
            issues: [],
            canTraverse: true,
            description:
                'Chain has fewer than 2 shapes - no traversal issues possible',
        };
    }

    // Check if we can traverse the chain properly (end-to-start connectivity)
    const traversalPath: { canTraverse: boolean; path: number[] } =
        attemptChainTraversal(chain, params);

    if (!traversalPath.canTraverse) {
        // Find specific issues that prevent traversal
        const detectedIssues: ChainTraversalIssue[] =
            detectSpecificTraversalIssues(chain);
        issues.push(...detectedIssues);
    }

    // Also check for coincident points that might indicate improper connections
    const coincidentIssues: ChainTraversalIssue[] =
        detectCoincidentPointIssues(chain);
    issues.push(...coincidentIssues);

    return {
        chainId: chain.id,
        issues,
        canTraverse: traversalPath.canTraverse,
        description: generateChainDescription(
            chain,
            issues,
            traversalPath.canTraverse
        ),
    };
}

/**
 * Attempts to traverse a chain following end-to-start connectivity
 */
function attemptChainTraversal(
    chain: Chain,
    params: ChainNormalizationParameters
): { canTraverse: boolean; path: number[] } {
    if (chain.shapes.length === 0) return { canTraverse: true, path: [] };
    if (chain.shapes.length === 1) return { canTraverse: true, path: [0] };

    const {
        traversalTolerance,
        maxTraversalAttempts,
    }: { traversalTolerance: number; maxTraversalAttempts: number } = params;

    // Try starting from each shape to find a valid traversal path (limit attempts)
    const maxAttempts: number = Math.min(
        maxTraversalAttempts,
        chain.shapes.length
    );
    for (let startIndex: number = 0; startIndex < maxAttempts; startIndex++) {
        const result: { canTraverse: boolean; path: number[] } =
            attemptTraversalFromStart(chain, startIndex, traversalTolerance);
        if (result.canTraverse) {
            return result;
        }
    }

    // If no starting point works, return failure
    return { canTraverse: false, path: [] };
}

/**
 * Attempts traversal starting from a specific shape index
 */
function attemptTraversalFromStart(
    chain: Chain,
    startIndex: number,
    tolerance: number
): { canTraverse: boolean; path: number[] } {
    const path: number[] = [startIndex];
    let currentShapeIndex: number = startIndex;
    const usedShapes: Set<number> = new Set<number>([startIndex]);

    while (path.length < chain.shapes.length) {
        const currentShape: Shape = chain.shapes[currentShapeIndex];
        const currentEndPoint: Point2D = getShapeEndPoint(currentShape);

        // Find next shape whose start point connects to current end point
        let nextShapeIndex: number = DEFAULT_ARRAY_NOT_FOUND_INDEX;
        for (let i: number = 0; i < chain.shapes.length; i++) {
            if (usedShapes.has(i)) continue;

            const candidateShape: Shape = chain.shapes[i];
            const candidateStartPoint: Point2D =
                getShapeStartPoint(candidateShape);

            if (
                pointsAreClose(currentEndPoint, candidateStartPoint, tolerance)
            ) {
                nextShapeIndex = i;
                break;
            }
        }

        if (nextShapeIndex === DEFAULT_ARRAY_NOT_FOUND_INDEX) {
            // No connecting shape found, traversal fails
            return { canTraverse: false, path };
        }

        path.push(nextShapeIndex);
        usedShapes.add(nextShapeIndex);
        currentShapeIndex = nextShapeIndex;
    }

    return { canTraverse: true, path };
}

/**
 * Detects specific issues that prevent proper traversal
 */
function detectSpecificTraversalIssues(chain: Chain): ChainTraversalIssue[] {
    const issues: ChainTraversalIssue[] = [];
    const tolerance: number = CHAIN_CLOSURE_TOLERANCE;

    for (let i: number = 0; i < chain.shapes.length; i++) {
        for (let j: number = i + 1; j < chain.shapes.length; j++) {
            const shape1: Shape = chain.shapes[i];
            const shape2: Shape = chain.shapes[j];

            const shape1Start: Point2D = getShapeStartPoint(shape1);
            const shape1End: Point2D = getShapeEndPoint(shape1);
            const shape2Start: Point2D = getShapeStartPoint(shape2);
            const shape2End: Point2D = getShapeEndPoint(shape2);

            // Check for coincident end points (both shapes end at same point)
            if (pointsAreClose(shape1End, shape2End, tolerance)) {
                issues.push({
                    type: 'coincident_endpoints',
                    chainId: chain.id,
                    shapeIndex1: i,
                    shapeIndex2: j,
                    point1: shape1End,
                    point2: shape2End,
                    description: `Shapes ${i + 1} and ${j + 1} both end at the same point (${shape1End.x.toFixed(PRECISION_DECIMAL_PLACES)}, ${shape1End.y.toFixed(PRECISION_DECIMAL_PLACES)}). One should connect end-to-start with the other.`,
                });
            }

            // Check for coincident start points (both shapes start at same point)
            if (pointsAreClose(shape1Start, shape2Start, tolerance)) {
                issues.push({
                    type: 'coincident_startpoints',
                    chainId: chain.id,
                    shapeIndex1: i,
                    shapeIndex2: j,
                    point1: shape1Start,
                    point2: shape2Start,
                    description: `Shapes ${i + 1} and ${j + 1} both start at the same point (${shape1Start.x.toFixed(PRECISION_DECIMAL_PLACES)}, ${shape1Start.y.toFixed(PRECISION_DECIMAL_PLACES)}). One should connect end-to-start with the other.`,
                });
            }
        }
    }

    return issues;
}

/**
 * Detects coincident point issues that might indicate connection problems
 */
function detectCoincidentPointIssues(chain: Chain): ChainTraversalIssue[] {
    const issues: ChainTraversalIssue[] = [];
    const tolerance: number = CHAIN_CLOSURE_TOLERANCE;

    // Look for shapes that have coincident points but are not in proper traversal order
    for (let i: number = 0; i < chain.shapes.length; i++) {
        const shape1: Shape = chain.shapes[i];

        for (let j: number = i + 1; j < chain.shapes.length; j++) {
            const shape2: Shape = chain.shapes[j];

            // Skip sequent shapes (they should connect)
            // Special case: first and last shapes are sequent if the chain is closed
            if (Math.abs(i - j) === 1) continue;
            if (
                (i === 0 && j === chain.shapes.length - 1) ||
                (j === 0 && i === chain.shapes.length - 1)
            ) {
                // Check if this is a closed chain by seeing if first and last shapes connect
                const firstShape: Shape = chain.shapes[0];
                const lastShape: Shape = chain.shapes[chain.shapes.length - 1];
                const firstStart: Point2D = getShapeStartPoint(firstShape);
                const lastEnd: Point2D = getShapeEndPoint(lastShape);

                if (pointsAreClose(firstStart, lastEnd, tolerance)) {
                    // This is a closed chain, so first and last shapes are effectively sequent
                    continue;
                }
            }

            const shape1Points: Point2D[] = getAllShapePoints(shape1);
            const shape2Points: Point2D[] = getAllShapePoints(shape2);

            // Check for any coincident points between non-sequent shapes
            for (const point1 of shape1Points) {
                for (const point2 of shape2Points) {
                    if (pointsAreClose(point1, point2, tolerance)) {
                        issues.push({
                            type: 'broken_traversal',
                            chainId: chain.id,
                            shapeIndex1: i,
                            shapeIndex2: j,
                            point1,
                            point2,
                            description: `Non-sequent shapes ${i + 1} and ${j + 1} have coincident points at (${point1.x.toFixed(PRECISION_DECIMAL_PLACES)}, ${point1.y.toFixed(PRECISION_DECIMAL_PLACES)}). This may indicate improper chain ordering.`,
                        });
                    }
                }
            }
        }
    }

    return issues;
}

/**
 * Gets all significant points from a shape (start, end, center for arcs/circles)
 * Note: Only includes connectivity-relevant points (start, end, centers).
 * Does NOT include spline control points as they are internal geometry.
 */
function getAllShapePoints(shape: Shape): Point2D[] {
    const points: Point2D[] = [];

    const start: Point2D = getShapeStartPoint(shape);
    const end: Point2D = getShapeEndPoint(shape);

    points.push(start);
    if (start.x !== end.x || start.y !== end.y) {
        points.push(end);
    }

    // Add center points for arcs and circles
    if (shape.type === 'arc' || shape.type === 'circle') {
        const geometry: Arc | Circle = shape.geometry as Arc | Circle;
        if (geometry.center) {
            points.push(geometry.center);
        }
    }

    // Add center point for ellipses
    if (shape.type === 'ellipse') {
        const geometry: Ellipse = shape.geometry as Ellipse;
        if (geometry.center) {
            points.push(geometry.center);
        }
    }

    // Note: Spline control points are NOT included because they are internal
    // geometry, not connectivity points. Including them causes false positive
    // "broken_traversal" warnings for long splines with coincident control points.

    return points;
}

/**
 * Checks if two points are close within tolerance
 */
function pointsAreClose(p1: Point2D, p2: Point2D, tolerance: number): boolean {
    const distance: number = Math.sqrt(
        Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)
    );
    return distance < tolerance;
}

/**
 * Generates a human-readable description of chain analysis results
 */
function generateChainDescription(
    chain: Chain,
    issues: ChainTraversalIssue[],
    canTraverse: boolean
): string {
    if (issues.length === 0) {
        return `Chain ${chain.id} (${chain.shapes.length} shapes): No traversal issues detected. Chain can be traversed properly.`;
    }

    const issueCount: number = issues.length;
    const traversalStatus: string = canTraverse
        ? 'can be traversed'
        : 'cannot be traversed properly';

    return `Chain ${chain.id} (${chain.shapes.length} shapes): ${issueCount} issue${issueCount === 1 ? '' : 's'} detected. Chain ${traversalStatus}.`;
}

/**
 * Builds an optimal traversal order by trying different starting points and connections
 */
function buildOptimalTraversalOrder(
    shapes: Shape[],
    tolerance: number
): Shape[] {
    if (shapes.length <= 1) return shapes;

    let bestResult: Shape[] = shapes; // Default fallback
    let bestScore: number = 0; // Number of connected shapes

    // Try each shape as a potential starting point
    for (let startIdx: number = 0; startIdx < shapes.length; startIdx++) {
        const result: Shape[] = buildChainFromStartingShape(
            shapes,
            startIdx,
            tolerance
        );

        if (result.length === shapes.length) {
            // Successfully connected all shapes - perfect result
            return result;
        }

        // Keep track of the best partial result
        if (result.length > bestScore) {
            bestScore = result.length;
            bestResult = result;
        }
    }

    // If no perfect traversal found, try with larger tolerance for loose connections
    if (bestScore < shapes.length && tolerance < 1.0) {
        const relaxedTolerance: number = Math.min(
            tolerance * TOLERANCE_RELAXATION_MULTIPLIER,
            1.0
        );

        for (let startIdx: number = 0; startIdx < shapes.length; startIdx++) {
            const result: Shape[] = buildChainFromStartingShape(
                shapes,
                startIdx,
                relaxedTolerance
            );

            if (result.length === shapes.length) {
                return result;
            }

            if (result.length > bestScore) {
                bestScore = result.length;
                bestResult = result;
            }
        }
    }

    // If we still don't have all shapes, try to add remaining shapes in order
    if (bestScore < shapes.length) {
        const remainingShapes: Shape[] = shapes.filter(
            (shape) =>
                !bestResult.some((resultShape) => resultShape.id === shape.id)
        );
        bestResult = [...bestResult, ...remainingShapes];
    }

    if (bestScore < shapes.length) {
        console.warn(
            `Could not find perfect traversal order: connected ${bestScore}/${shapes.length} shapes`
        );
    }

    return bestResult;
}

/**
 * Builds a chain starting from a specific shape index
 */
function buildChainFromStartingShape(
    shapes: Shape[],
    startIdx: number,
    tolerance: number
): Shape[] {
    const result: Shape[] = [];
    const usedIndices: Set<number> = new Set<number>();

    // Add the starting shape
    result.push(shapes[startIdx]);
    usedIndices.add(startIdx);

    // Build the rest of the chain
    while (result.length < shapes.length) {
        const lastShape: Shape = result[result.length - 1];
        const lastEndPoint: Point2D = getShapeEndPoint(lastShape);

        if (!lastEndPoint) break;

        let foundConnection: boolean = false;
        let bestCandidate: {
            index: number;
            shape: Shape;
            distance: number;
        } | null = null;

        // Look for a shape that can connect to the end of our current chain
        for (let i: number = 0; i < shapes.length; i++) {
            if (usedIndices.has(i)) continue;

            const candidateShape: Shape = shapes[i];
            const candidateStart: Point2D = getShapeStartPoint(candidateShape);
            const candidateEnd: Point2D = getShapeEndPoint(candidateShape);

            // Calculate distances for both potential connections
            if (candidateStart) {
                const distance: number = Math.sqrt(
                    Math.pow(lastEndPoint.x - candidateStart.x, 2) +
                        Math.pow(lastEndPoint.y - candidateStart.y, 2)
                );

                if (distance < tolerance) {
                    if (!bestCandidate || distance < bestCandidate.distance) {
                        bestCandidate = {
                            index: i,
                            shape: candidateShape,
                            distance,
                        };
                    }
                }
            }

            if (candidateEnd) {
                const distance: number = Math.sqrt(
                    Math.pow(lastEndPoint.x - candidateEnd.x, 2) +
                        Math.pow(lastEndPoint.y - candidateEnd.y, 2)
                );

                if (distance < tolerance) {
                    const reversedShape: Shape = reverseShape(candidateShape);
                    if (!bestCandidate || distance < bestCandidate.distance) {
                        bestCandidate = {
                            index: i,
                            shape: reversedShape,
                            distance,
                        };
                    }
                }
            }
        }

        // Use the best connection found
        if (bestCandidate) {
            result.push(bestCandidate.shape);
            usedIndices.add(bestCandidate.index);
            foundConnection = true;
        }

        if (!foundConnection) {
            // Can't continue the chain from this point
            break;
        }
    }

    return result;
}
