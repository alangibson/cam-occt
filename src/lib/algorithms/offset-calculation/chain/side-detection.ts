import type { Shape, Point2D } from '../../../../lib/types/geometry';
import type { Chain } from '../../chain-detection/chain-detection';
import type {
    OffsetSide,
    SideDetectionResult,
    SideDetectionOptions,
} from './types.ts';
import { isChainClosed } from '../../part-detection';
import {
    getShapePointAt,
    getShapeMidpoint,
    normalizeVector,
} from '$lib/geometry';
import { isPointInsideChainExact } from '../../raytracing/point-in-chain';
import { CHAIN_CLOSURE_TOLERANCE } from '$lib/geometry/chain';

/**
 * Side Detection Module
 *
 * This module determines which side of a chain an offset shape lies on.
 * For closed chains: detects inner/outer using winding number algorithm
 * For open chains: detects left/right using chain orientation
 */

/**
 * Default options for side detection
 */
const DEFAULT_SIDE_DETECTION_OPTIONS: Required<SideDetectionOptions> = {
    useWindingNumber: true,
    sampleCount: 10, // Increased from 5 for better accuracy
    normalOffset: 0.1,
};

function crossProduct2D(v1: Point2D, v2: Point2D): number {
    return v1.x * v2.y - v1.y * v2.x;
}

/**
 * Detects which side of the original chain an offset shape is on
 *
 * @param shape - The offset shape to classify
 * @param offset - The offset distance (positive or negative)
 * @param chain - The original chain
 * @param tolerance - Geometric tolerance
 * @param options - Additional options for side detection
 * @returns Side detection result with confidence
 */
export function detectChainSide(
    shape: Shape,
    offset: number,
    chain: Chain,
    tolerance: number,
    isClosed: boolean,
    options?: SideDetectionOptions
): SideDetectionResult {
    const opts: Required<SideDetectionOptions> = {
        ...DEFAULT_SIDE_DETECTION_OPTIONS,
        ...options,
    };

    if (isClosed) {
        // For closed chains, use winding number to determine inside/outside
        return detectClosedChainSide(shape, offset, chain, tolerance, opts);
    } else {
        // For open chains, use orientation to determine left/right
        return detectOpenChainSide(shape, offset, chain, tolerance, opts);
    }
}

/**
 * Detects side for closed chains using winding number algorithm
 */
function detectClosedChainSide(
    shape: Shape,
    offset: number,
    chain: Chain,
    tolerance: number,
    options: Required<SideDetectionOptions>
): SideDetectionResult {
    // Sample points along the offset shape
    const samplePoints: Point2D[] = [];
    const windingNumbers: number[] = [];

    for (let i: number = 0; i < options.sampleCount; i++) {
        const t: number = i / (options.sampleCount - 1);
        const point: Point2D = getShapeMidpoint(shape, t);
        samplePoints.push(point);

        // Check if point is inside the original chain using exact ray-tracing
        const isInside: boolean = isPointInsideChainExact(point, chain);
        windingNumbers.push(isInside ? 1 : 0);
    }

    // Determine consensus
    const insideCount: number = windingNumbers.filter((w) => w > 0).length;
    const confidence: number =
        Math.abs(insideCount - options.sampleCount / 2) /
        (options.sampleCount / 2);

    // Logic: If points are inside the chain, it's inner. If points are outside, it's outer.
    // The offset direction sign doesn't matter for side detection - spatial position matters
    const isInside: boolean = insideCount > options.sampleCount / 2;
    const side: OffsetSide = isInside ? 'inner' : 'outer';

    return {
        side,
        confidence,
        method: 'winding',
    };
}

/**
 * Detects side for open chains using spatial position relative to chain direction
 */
function detectOpenChainSide(
    shape: Shape,
    offset: number,
    chain: Chain,
    tolerance: number,
    options: Required<SideDetectionOptions>
): SideDetectionResult {
    // Sample multiple points along the offset shape to determine spatial position
    const samplePoints: Point2D[] = [];
    const crossProducts: number[] = [];

    for (let i: number = 0; i < options.sampleCount; i++) {
        const t: number = i / (options.sampleCount - 1);
        const offsetPoint: Point2D = getShapeMidpoint(shape, t);
        samplePoints.push(offsetPoint);

        // Find the closest point on the original chain to this offset point
        const closestChainInfo: {
            point: Point2D;
            shapeIndex: number;
            t: number;
            distance: number;
        } | null = findClosestPointOnChain(offsetPoint, chain);

        if (closestChainInfo) {
            // Get the chain direction at the closest point
            const chainDirection: Point2D = getChainDirectionAt(
                chain,
                closestChainInfo.shapeIndex,
                closestChainInfo.t
            );

            // Vector from chain point to offset point
            const toOffsetVector: Point2D = {
                x: offsetPoint.x - closestChainInfo.point.x,
                y: offsetPoint.y - closestChainInfo.point.y,
            };

            // Cross product determines which side: positive = left, negative = right
            const crossProd: number = crossProduct2D(
                chainDirection,
                toOffsetVector
            );
            crossProducts.push(crossProd);
        }
    }

    // Determine consensus from all sample points
    const leftCount: number = crossProducts.filter(
        (cp) => cp > tolerance
    ).length;
    const rightCount: number = crossProducts.filter(
        (cp) => cp < -tolerance
    ).length;
    const confidence: number =
        Math.abs(leftCount - rightCount) / options.sampleCount;

    // Determine side based on spatial analysis
    let side: OffsetSide;

    if (leftCount !== rightCount) {
        // Clear spatial consensus
        side = leftCount > rightCount ? 'left' : 'right';
    } else {
        // Ambiguous spatial result - use offset direction as tie-breaker
        // For open chains: positive offset typically goes to the right, negative to left
        side = offset > 0 ? 'right' : 'left';
    }

    return {
        side,
        confidence,
        method: 'orientation',
    };
}

/**
 * Checks if a point is inside a closed chain using exact ray-tracing
 *
 * @param point - Point to test
 * @param chain - Closed chain to test against
 * @returns True if point is inside the chain
 */
export function isPointInsideChain(point: Point2D, chain: Chain): boolean {
    return isPointInsideChainExact(point, chain);
}

/**
 * Determines the overall orientation vector for an open chain
 *
 * @param chain - Open chain to analyze
 * @returns Normalized orientation vector
 */
export function determineChainOrientation(chain: Chain): Point2D {
    if (isChainClosed(chain, CHAIN_CLOSURE_TOLERANCE)) {
        throw new Error('Chain orientation is only defined for open chains');
    }

    // Get start and end points of the chain
    const firstShape: Shape = chain.shapes[0];
    const lastShape: Shape = chain.shapes[chain.shapes.length - 1];

    const startPoint: Point2D = getShapePointAt(firstShape, 0);
    const endPoint: Point2D = getShapePointAt(lastShape, 1);

    // Calculate overall direction vector
    const direction: Point2D = {
        x: endPoint.x - startPoint.x,
        y: endPoint.y - startPoint.y,
    };

    return normalizeVector(direction);
}

/**
 * Finds the closest point on a chain to a given point
 *
 * @param point - Point to find closest chain point to
 * @param chain - Chain to search
 * @returns Information about the closest point including shape index and parameter
 */
function findClosestPointOnChain(
    point: Point2D,
    chain: Chain
): {
    point: Point2D;
    shapeIndex: number;
    t: number;
    distance: number;
} | null {
    let closestInfo: {
        point: Point2D;
        shapeIndex: number;
        t: number;
        distance: number;
    } | null = null;
    let minDistance: number = Infinity;

    for (
        let shapeIndex: number = 0;
        shapeIndex < chain.shapes.length;
        shapeIndex++
    ) {
        const shape: Shape = chain.shapes[shapeIndex];

        // Sample points along this shape to find closest
        const sampleCount: number = 20;
        for (let i: number = 0; i <= sampleCount; i++) {
            const t: number = i / sampleCount;
            const shapePoint: Point2D = getShapePointAt(shape, t);

            const dx: number = point.x - shapePoint.x;
            const dy: number = point.y - shapePoint.y;
            const distance: number = Math.sqrt(dx * dx + dy * dy);

            if (distance < minDistance) {
                minDistance = distance;
                closestInfo = {
                    point: shapePoint,
                    shapeIndex,
                    t,
                    distance,
                };
            }
        }
    }

    return closestInfo;
}

/**
 * Gets the direction vector of the chain at a specific point
 *
 * @param chain - The chain
 * @param shapeIndex - Index of the shape in the chain
 * @param t - Parameter on the shape (0-1)
 * @returns Normalized direction vector
 */
function getChainDirectionAt(
    chain: Chain,
    shapeIndex: number,
    t: number
): Point2D {
    const shape: Shape = chain.shapes[shapeIndex];

    // Get tangent vector at this point on the shape
    const delta: number = 0.001;
    const t1: number = Math.max(0, t - delta);
    const t2: number = Math.min(1, t + delta);

    const p1: Point2D = getShapePointAt(shape, t1);
    const p2: Point2D = getShapePointAt(shape, t2);

    // Calculate direction vector
    const direction: Point2D = {
        x: p2.x - p1.x,
        y: p2.y - p1.y,
    };

    return normalizeVector(direction);
}
