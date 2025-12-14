/**
 * Chain and polygon functions
 */

import { GeometryType } from '$lib/geometry/enums';
import { Shape } from '$lib/cam/shape/classes';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import { Chain } from './classes.svelte';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import type { Spline } from '$lib/geometry/spline/interfaces';
import {
    getShapeEndPoint,
    getShapeStartPoint,
    reverseShape,
    tessellateShape,
    getShapePoints,
    getShapePointAt,
    getShapeLength,
    sampleShapes,
    shapeBoundingBox,
} from '$lib/cam/shape/functions';
import { CHAIN_CLOSURE_TOLERANCE, POLYGON_POINTS_MIN } from './constants';
import { CONTAINMENT_AREA_TOLERANCE } from '$lib/geometry/constants';
import { isEllipseClosed } from '$lib/geometry/ellipse/functions';
import { WindingDirection } from './enums';
import {
    calculatePerimeter,
    calculateDistanceBetweenPoints,
} from '$lib/geometry/math/functions';
import { combineBoundingBoxes } from '$lib/geometry/bounding-box/functions';
import { type PartDetectionParameters } from '$lib/cam/part/part-detection.interfaces';
import { DEFAULT_PART_DETECTION_PARAMETERS } from '$lib/cam/part/defaults';
import {
    calculateSignedArea,
    removeDuplicatePoints,
} from '$lib/geometry/polygon/functions';
import { getArcTangent } from '$lib/geometry/arc/functions';
import { getCircleTangent } from '$lib/geometry/circle/functions';
import { getLineTangent } from '$lib/geometry/line/functions';
import { getSplineTangent } from '$lib/geometry/spline/functions';
import { CutDirection } from '$lib/cam/cut/enums';
import { getDefaults } from '$lib/config/defaults/defaults-manager';
import type { ChainData, CutChainResult } from './interfaces';
import type { BoundingBoxData } from '$lib/geometry/bounding-box/interfaces';

/**
 * Reverses a chain's direction by reversing both the order of shapes
 * and the internal geometry of each shape.
 * This is used when applying cut direction that differs from the chain's natural direction.
 *
 * @param chain - The chain to reverse
 * @returns A new chain with reversed direction
 */
export function reverseChain(chain: Chain): Chain {
    // Clone and reverse the shapes array
    const reversedShapes = chain.shapes.slice().reverse();
    // Reverse each shape in-place
    reversedShapes.forEach((shape) => reverseShape(shape));

    return new Chain({
        id: chain.id,
        name: chain.name,
        shapes: reversedShapes,
        clockwise: chain.clockwise,
        originalChainId: chain.originalChainId,
    });
}

/**
 * Determine the winding direction of a polygon
 *
 * @param points Array of polygon vertices in order
 * @returns 'CW' for clockwise, 'CCW' for counter-clockwise, 'degenerate' for zero area
 */
export function getWindingDirection(points: Point2D[]): WindingDirection {
    const signedArea: number = calculateSignedArea({ points });

    if (Math.abs(signedArea) < Number.EPSILON) {
        return WindingDirection.degenerate;
    }

    return signedArea < 0 ? WindingDirection.CW : WindingDirection.CCW;
}

/**
 * Check if a polygon is wound clockwise
 *
 * @param points Array of polygon vertices in order
 * @returns True if clockwise, false if counter-clockwise or degenerate
 */
export function isClockwise(points: Point2D[]): boolean {
    return calculateSignedArea({ points }) < 0;
}

/**
 * Check if a polygon is wound counter-clockwise
 *
 * @param points Array of polygon vertices in order
 * @returns True if counter-clockwise, false if clockwise or degenerate
 */
export function isCounterClockwise(points: Point2D[]): boolean {
    return calculateSignedArea({ points }) > 0;
}

/**
 * Reverse the winding direction of a polygon by reversing the point order
 *
 * @param points Array of polygon vertices
 * @returns New array with reversed point order
 */
export function reverseWinding(points: Point2D[]): Point2D[] {
    return [...points].reverse();
}

/**
 * Ensure a polygon has clockwise winding direction
 *
 * @param points Array of polygon vertices
 * @returns Array with clockwise winding (reversed if originally CCW)
 */
export function ensureClockwise(points: Point2D[]): Point2D[] {
    return isClockwise(points) ? points : reverseWinding(points);
}

/**
 * Ensure a polygon has counter-clockwise winding direction
 *
 * @param points Array of polygon vertices
 * @returns Array with counter-clockwise winding (reversed if originally CW)
 */
export function ensureCounterClockwise(points: Point2D[]): Point2D[] {
    return isCounterClockwise(points) ? points : reverseWinding(points);
}

/**
 * Calculate the centroid (geometric center) of a polygon
 *
 * @param points Array of polygon vertices in order
 * @returns Point representing the centroid
 */
export function calculatePolygonCentroid(points: Point2D[]): Point2D {
    if (points.length === 0) {
        return { x: 0, y: 0 };
    }

    const area: number = calculateSignedArea({ points });
    if (Math.abs(area) < Number.EPSILON) {
        // Degenerate polygon - return arithmetic mean of points
        const sum: Point2D = points.reduce(
            (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
            {
                x: 0,
                y: 0,
            }
        );
        return { x: sum.x / points.length, y: sum.y / points.length };
    }

    let cx: number = 0,
        cy: number = 0;
    for (let i: number = 0; i < points.length; i++) {
        const j: number = (i + 1) % points.length;
        // Standard shoelace cross product
        const cross: number =
            points[i].x * points[j].y - points[j].x * points[i].y;
        cx += (points[i].x + points[j].x) * cross;
        cy += (points[i].y + points[j].y) * cross;
    }

    // calculateSignedArea uses shoelace formula (positive for CCW, negative for CW)
    // The cross product calculation above also uses shoelace convention
    // So they have matching signs and no negation is needed
    // eslint-disable-next-line no-magic-numbers
    const factor: number = 1 / (6 * area);
    return { x: cx * factor, y: cy * factor };
}

/**
 * Get the center point (centroid) of a chain
 *
 * Special cases:
 * - Single circle: returns circle center
 * - Single arc: returns arc center
 * - General case: tessellates shapes and calculates polygon centroid
 *
 * @param chain - The chain to find the center of
 * @returns The center point of the chain
 */
export function getChainCentroid(chain: Chain): Point2D {
    if (chain.shapes.length === 0) {
        return { x: 0, y: 0 };
    }

    // Special case: single circle - return center
    if (
        chain.shapes.length === 1 &&
        chain.shapes[0].type === GeometryType.CIRCLE
    ) {
        const circle = chain.shapes[0].geometry as Circle;
        return circle.center;
    }

    // Special case: single arc - return center
    if (
        chain.shapes.length === 1 &&
        chain.shapes[0].type === GeometryType.ARC
    ) {
        const arc = chain.shapes[0].geometry as Arc;
        return arc.center;
    }

    // General case: tessellate all shapes and calculate polygon centroid
    const points: Point2D[] = [];
    for (const shape of chain.shapes) {
        const shapePoints = tessellateShape(
            shape,
            DEFAULT_PART_DETECTION_PARAMETERS
        );
        points.push(...shapePoints);
    }

    return calculatePolygonCentroid(points);
}

/**
 * Check if a polygon is simple (non-self-intersecting)
 *
 * This is a basic check - it doesn't detect all self-intersections but catches
 * the most common cases like immediately adjacent segments intersecting.
 *
 * @param points Array of polygon vertices in order
 * @returns True if the polygon appears to be simple
 */
export function isSimplePolygon(points: Point2D[]): boolean {
    if (points.length < POLYGON_POINTS_MIN) {
        return false;
    }

    // Check for duplicate consecutive points
    for (let i: number = 0; i < points.length; i++) {
        const j: number = (i + 1) % points.length;
        const dx: number = points[j].x - points[i].x;
        const dy: number = points[j].y - points[i].y;
        if (Math.sqrt(dx * dx + dy * dy) < Number.EPSILON) {
            return false; // Duplicate points
        }
    }

    return true; // Basic validation passed
}

/**
 * Calculate the perimeter of a polygon
 *
 * @param points Array of polygon vertices in order
 * @returns Total perimeter length
 */
export function calculatePolygonPerimeter(points: Point2D[]): number {
    return calculatePerimeter(points);
}

/**
 * Convert a chain to a series of points by tessellating all shapes
 */
export function tessellateChain(
    chain: Chain,
    params: PartDetectionParameters = DEFAULT_PART_DETECTION_PARAMETERS
): Point2D[] {
    const points: Point2D[] = [];

    for (const shape of chain.shapes) {
        const shapePoints = tessellateShape(shape, params);
        points.push(...shapePoints);
    }

    return points;
}

/**
 * Tessellate chain preserving individual shape boundaries
 * Returns array of point arrays (one per shape) for Clipper2 offsetting
 *
 * @param chain - The chain to tessellate
 * @param params - Tessellation parameters
 * @returns Array of point arrays, one per shape
 */
export function tessellateChainToShapes(
    chain: Chain,
    params: PartDetectionParameters = DEFAULT_PART_DETECTION_PARAMETERS
): Point2D[][] {
    return chain.shapes.map((shape) => tessellateShape(shape, params));
}
/**
 * Helper function to get all endpoints from a shape
 */
function getShapeEndpoints(shape: Shape): Point2D[] {
    const start: Point2D = getShapeStartPoint(shape);
    const end: Point2D = getShapeEndPoint(shape);

    const points: Point2D[] = [];
    points.push(start);
    if (start.x !== end.x || start.y !== end.y) {
        points.push(end);
    }

    return points;
}

/**
 * Check if a chain is closed within tolerance
 * Enhanced version with special handling for single-shape circles, ellipses, and polylines
 */
export function isChainClosed(
    chain: Chain,
    tolerance: number = CHAIN_CLOSURE_TOLERANCE
): boolean {
    if (chain.shapes.length === 0) return false;

    // Special case: single-shape circles, ellipses, and closed polylines are inherently closed
    if (chain.shapes.length === 1) {
        const shape: Shape = chain.shapes[0];
        if (shape.type === 'circle') {
            return true;
        }
        if (shape.type === 'ellipse') {
            const ellipse: Ellipse = shape.geometry as Ellipse;
            // Use the centralized ellipse closed detection logic
            return isEllipseClosed(ellipse, CONTAINMENT_AREA_TOLERANCE);
        }
    }

    // Get all endpoints from the shapes in the chain
    const endpoints: Point2D[] = [];

    for (const shape of chain.shapes) {
        const shapeEndpoints: Point2D[] = getShapeEndpoints(shape);
        endpoints.push(...shapeEndpoints);
    }

    // A closed chain should have all endpoints paired up (each point appears exactly twice)
    // For a truly closed chain, the start of the first shape should connect to the end of the last shape
    const firstShape: Shape = chain.shapes[0];
    const lastShape: Shape = chain.shapes[chain.shapes.length - 1];

    const firstStart: Point2D = getShapeStartPoint(firstShape);
    const lastEnd: Point2D = getShapeEndPoint(lastShape);

    // Check if the chain is closed (end connects to start within tolerance)
    const distance: number = Math.sqrt(
        Math.pow(firstStart.x - lastEnd.x, 2) +
            Math.pow(firstStart.y - lastEnd.y, 2)
    );

    // Use ONLY the user-set tolerance - no adaptive tolerance calculations allowed
    return distance < tolerance;
}

/**
 * Extracts a polygon representation from a chain for geometric operations
 */
export function extractPolygonFromChain(chain: Chain): Point2D[] | null {
    if (!chain || !chain.shapes || chain.shapes.length === 0) {
        return null;
    }

    const points: Point2D[] = [];

    for (const shape of chain.shapes) {
        const shapePoints: Point2D[] = getShapePoints(shape, {
            resolution: 'HIGH',
        });
        if (shapePoints && shapePoints.length > 0) {
            // Add points, but avoid duplicating the last point of previous shape with first point of next
            if (points.length === 0) {
                points.push(...shapePoints);
            } else {
                // Skip first point if it's close to the last added point
                const lastPoint = points[points.length - 1];
                const firstNewPoint = shapePoints[0];
                const distance = calculateDistanceBetweenPoints(
                    lastPoint,
                    firstNewPoint
                );

                if (distance > getDefaults().geometry.precisionTolerance) {
                    points.push(...shapePoints);
                } else {
                    points.push(...shapePoints.slice(1));
                }
            }
        }
    }

    // Remove duplicate points and ensure we have enough for a polygon
    const cleanedPolygon = removeDuplicatePoints({ points });
    return cleanedPolygon.points.length >= POLYGON_POINTS_MIN
        ? cleanedPolygon.points
        : null;
}

/**
 * Extract all points from a chain for area calculation
 */
export function getChainPoints(chain: Chain): Point2D[] {
    const points: Point2D[] = [];

    for (const shape of chain.shapes) {
        const shapePoints: Point2D[] = getShapePoints(shape, {
            resolution: 'HIGH',
        });
        points.push(...shapePoints);
    }

    return points;
}

/**
 * Get the start point of a shape chain
 */
export function getChainStartPoint(chain: Chain): Point2D {
    if (chain.shapes.length === 0) {
        throw new Error('Chain has no shapes');
    }

    const firstShape = chain.shapes[0];
    return getShapeStartPoint(firstShape);
}

/**
 * Get the end point of a shape chain
 */
export function getChainEndPoint(chain: Chain): Point2D {
    if (chain.shapes.length === 0) {
        throw new Error('Chain has no shapes');
    }

    const lastShape: Shape = chain.shapes[chain.shapes.length - 1];
    return getShapeEndPoint(lastShape);
}

/**
 * Get the tangent direction at a point on the chain.
 */
export function getChainTangent(
    chain: Chain,
    point: Point2D,
    isStart: boolean
): Point2D {
    const shape: Shape = isStart
        ? chain.shapes[0]
        : chain.shapes[chain.shapes.length - 1];

    switch (shape.type) {
        case GeometryType.LINE:
            return getLineTangent(shape.geometry as Line);

        case GeometryType.ARC:
            return getArcTangent(shape.geometry as Arc, isStart);

        case GeometryType.CIRCLE:
            return getCircleTangent(shape.geometry as Circle, point);

        case GeometryType.SPLINE:
            return getSplineTangent(shape.geometry as Spline, isStart);

        default:
            throw Error(`Can not find tangent for shape: ${shape}`);
    }
}

/**
 * Get a point on a chain at parameter t (0-1).
 *
 * The parameter t represents the position along the entire chain length:
 * - t = 0: start of the chain
 * - t = 1: end of the chain
 * - t = 0.5: midpoint of the chain by length
 *
 * @param chain - The chain to evaluate
 * @param t - Parameter value between 0 and 1
 * @returns Point on the chain at the specified parameter
 * @throws Error if chain has no shapes or t is out of range
 */
export function getChainPointAt(chain: Chain, t: number): Point2D {
    if (chain.shapes.length === 0) {
        throw new Error('Chain has no shapes');
    }

    // Clamp t to [0, 1] range
    const clampedT = Math.max(0, Math.min(1, t));

    // Handle edge cases
    if (clampedT === 0) {
        return getChainStartPoint(chain);
    }
    if (clampedT === 1) {
        return getChainEndPoint(chain);
    }

    // Calculate lengths of all shapes
    const shapeLengths: number[] = chain.shapes.map((shape) =>
        getShapeLength(shape)
    );

    // Calculate total chain length
    const totalLength: number = shapeLengths.reduce(
        (sum, length) => sum + length,
        0
    );

    // Handle degenerate case of zero-length chain
    if (totalLength === 0) {
        return getChainStartPoint(chain);
    }

    // Find target distance along the chain
    const targetDistance: number = clampedT * totalLength;

    // Find which shape contains this distance
    let accumulatedDistance: number = 0;
    for (let i = 0; i < chain.shapes.length; i++) {
        const shapeLength: number = shapeLengths[i];
        const nextDistance: number = accumulatedDistance + shapeLength;

        if (targetDistance <= nextDistance) {
            // This shape contains the target point
            // Convert global parameter to local parameter for this shape
            let localT: number;
            if (shapeLength === 0) {
                // Degenerate shape - return start point
                localT = 0;
            } else {
                localT = (targetDistance - accumulatedDistance) / shapeLength;
            }

            return getShapePointAt(chain.shapes[i], localT);
        }

        accumulatedDistance = nextDistance;
    }

    // Fallback: return end point (should only happen due to floating point errors)
    return getChainEndPoint(chain);
}

/**
 * Sample points along a chain at regular distance intervals
 *
 * Uses sampleShapes to sample the chain's shapes at evenly-spaced
 * intervals along the path. This is useful for detecting geometric interactions by
 * converting curves into discrete sample points.
 *
 * @param chain - The chain to sample along
 * @param intervalDistance - The distance between each sample point along the path (in drawing units)
 * @param includeDirection - Whether to calculate direction vectors (default: true)
 * @returns Array of sampled points with their direction vectors at each sample location
 */
export function sampleChain(
    chain: Chain,
    intervalDistance: number,
    includeDirection: boolean = true
): { point: Point2D; direction: Point2D }[] {
    return sampleShapes(chain.shapes, intervalDistance, includeDirection);
}

/**
 * Get CutDirection from chain's stored clockwise property.
 * This replaces the unreliable detectCutDirection() calls.
 *
 * @param chain - The chain to analyze
 * @returns The cut direction based on the chain's clockwise property
 */
export function getChainCutDirection(chain: Chain | undefined): CutDirection {
    if (!chain) return CutDirection.NONE;

    return chain.clockwise === true
        ? CutDirection.CLOCKWISE
        : chain.clockwise === false
          ? CutDirection.COUNTERCLOCKWISE
          : CutDirection.NONE;
}

/**
 * Calculates the bounding box of a chain by aggregating bounds of all shapes
 */
export function chainBoundingBox(chain: ChainData): BoundingBoxData {
    const shapeBounds = chain.shapes.map((shape) => shapeBoundingBox(shape));
    return combineBoundingBoxes(shapeBounds);
}

/**
 * Helper function to create cut chain with deep cloned shapes ordered for execution.
 *
 * This function:
 * 1. Deep clones shapes to ensure Cut owns its execution order
 * 2. Determines natural direction from original chain
 * 3. Applies user's requested direction preference
 * 4. Reverses chain if needed to match requested direction
 *
 * @param originalChain - The original chain before any offset
 * @param userCutDirection - User's preferred cut direction
 * @param offsetShapes - Optional offset shapes (takes priority over original shapes)
 * @returns Object containing the cut chain and execution clockwise direction
 */
export function createCutChain(
    originalChain: Chain,
    userCutDirection: CutDirection,
    offsetShapes?: Shape[]
): CutChainResult {
    // Determine which shapes to clone (offset shapes take priority)
    const shapesToClone: Shape[] = offsetShapes || originalChain.shapes;

    // Deep clone the shapes array to ensure Cut owns its execution order
    const clonedShapes: Shape[] = shapesToClone.map((shape) => {
        const data = shape.toData();
        return new Shape({
            id: data.id,
            type: data.type,
            layer: data.layer,
            geometry: { ...data.geometry },
        });
    });

    // Get the natural direction of the ORIGINAL chain (geometric property)
    const naturalDirection = getChainCutDirection(originalChain);

    // Handle case where user specifies NONE (no direction preference)
    if (userCutDirection === CutDirection.NONE) {
        return {
            cutChain: new Chain({
                id: `${originalChain.id}-cut`,
                name: `${originalChain.name || originalChain.id}-cut`,
                shapes: clonedShapes.map((s) => s.toData()),
            }),
            executionClockwise: null,
        };
    }

    // Determine final execution order based on user preference vs natural direction
    let executionShapes: Shape[];
    let executionClockwise: boolean;

    // For open chains (naturalDirection is NONE), apply user's requested direction
    if (naturalDirection === CutDirection.NONE) {
        // Open chain - user wants specific direction
        // For open chains, we can interpret direction as traversal order:
        // CLOCKWISE = original order, COUNTERCLOCKWISE = reversed order
        if (userCutDirection === CutDirection.COUNTERCLOCKWISE) {
            const reversedChain = reverseChain(
                new Chain({
                    id: originalChain.id,
                    name: originalChain.name || originalChain.id,
                    shapes: clonedShapes.map((s) => s.toData()),
                })
            );
            executionShapes = reversedChain.shapes;
        } else {
            executionShapes = clonedShapes;
        }
        executionClockwise = userCutDirection === CutDirection.CLOCKWISE;
    } else if (naturalDirection !== userCutDirection) {
        // Closed chain - user wants opposite of natural direction
        const reversedChain = reverseChain(
            new Chain({
                id: originalChain.id,
                name: originalChain.name || originalChain.id,
                shapes: clonedShapes.map((s) => s.toData()),
            })
        );
        executionShapes = reversedChain.shapes;
        executionClockwise = userCutDirection === CutDirection.CLOCKWISE;
    } else {
        // Closed chain - user wants same as natural direction
        executionShapes = clonedShapes;
        executionClockwise = userCutDirection === CutDirection.CLOCKWISE;
    }

    // Create cut chain with execution-ordered shapes
    const cutChain = new Chain({
        id: `${originalChain.id}-cut`,
        name: `${originalChain.name || originalChain.id}-cut`,
        shapes: executionShapes.map((s) => s.toData()),
        originalChainId: originalChain.id, // Preserve reference to original chain for part lookup
        clockwise: executionClockwise, // Use execution winding direction (accounts for shape reversal)
    });

    return { cutChain, executionClockwise };
}
