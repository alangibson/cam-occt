/**
 * Chain and polygon functions
 */

import {
    GeometryType,
    type Arc,
    type Circle,
    type Line,
    type Point2D,
    type Shape,
} from '$lib/types/geometry';
import type { Chain } from './interfaces';
import type { Ellipse } from '$lib/geometry/ellipse';
import type { Polyline } from '$lib/geometry/polyline';
import type { Spline } from '$lib/geometry/spline';
import {
    getShapeEndPoint,
    getShapeStartPoint,
    reverseShape,
    tessellateShape,
    getShapePoints,
} from '$lib/geometry/shape/functions';
import {
    GEOMETRIC_PRECISION_TOLERANCE,
    calculatePerimeter,
} from '$lib/geometry/math';
import { CHAIN_CLOSURE_TOLERANCE, POLYGON_POINTS_MIN } from './constants';
import { CONTAINMENT_AREA_TOLERANCE } from '$lib/geometry/constants';
import { isEllipseClosed } from '$lib/geometry/ellipse/index';
import { WindingDirection } from './enums';
import { JSTS_MIN_LINEAR_RING_COORDINATES } from '$lib/algorithms/part-detection/geometric-containment';
import {
    calculateDistanceBetweenPoints,
    roundToDecimalPlaces,
} from '$lib/geometry/math/functions';
import { Coordinate, GeometryFactory } from 'jsts/org/locationtech/jts/geom';
import { AREA_RATIO_THRESHOLD } from '$lib/algorithms/constants';
import { calculateChainBoundingBox } from '$lib/geometry/bounding-box/functions';
import { RelateOp } from 'jsts/org/locationtech/jts/operation/relate';
import {
    DEFAULT_PART_DETECTION_PARAMETERS,
    type PartDetectionParameters,
} from '$lib/types/part-detection';
import {
    isPolygonContained,
    removeDuplicatePoints,
} from '$lib/geometry/polygon/functions';
import { getArcTangent } from '$lib/geometry/arc/functions';
import { getCircleTangent } from '$lib/geometry/circle/functions';
import { getLineTangent } from '$lib/geometry/line/functions';
import { getPolylineTangent } from '$lib/geometry/polyline/functions';
import { getSplineTangent } from '$lib/geometry/spline/functions';

/**
 * Reverses a chain's direction by reversing both the order of shapes
 * and the internal geometry of each shape.
 * This is used when applying cut direction that differs from the chain's natural direction.
 *
 * @param chain - The chain to reverse
 * @returns A new chain with reversed direction
 */
export function reverseChain(chain: Chain): Chain {
    return {
        ...chain,
        shapes: chain.shapes
            .slice()
            .reverse()
            .map((shape) => reverseShape(shape)),
    };
}

/**
 * Calculate the signed area of a polygon using the shoelace formula
 *
 * The signed area indicates the winding direction:
 * - Positive area: Clockwise (CW) winding
 * - Negative area: Counter-clockwise (CCW) winding
 * - Zero area: Degenerate polygon (collinear points or self-intersecting)
 *
 * @param points Array of polygon vertices in order
 * @returns Signed area of the polygon (positive for CW, negative for CCW)
 */
export function calculateSignedArea(points: Point2D[]): number {
    if (points.length < POLYGON_POINTS_MIN) {
        return 0; // Need at least 3 points to form a polygon
    }

    let area: number = 0;
    for (let i: number = 0; i < points.length; i++) {
        const j: number = (i + 1) % points.length;
        area += (points[j].x - points[i].x) * (points[j].y + points[i].y);
    }
    return area / 2;
}

/**
 * Determine the winding direction of a polygon
 *
 * @param points Array of polygon vertices in order
 * @returns 'CW' for clockwise, 'CCW' for counter-clockwise, 'degenerate' for zero area
 */
export function getWindingDirection(points: Point2D[]): WindingDirection {
    const signedArea: number = calculateSignedArea(points);

    if (Math.abs(signedArea) < Number.EPSILON) {
        return WindingDirection.degenerate;
    }

    return signedArea > 0 ? WindingDirection.CW : WindingDirection.CCW;
}

/**
 * Check if a polygon is wound clockwise
 *
 * @param points Array of polygon vertices in order
 * @returns True if clockwise, false if counter-clockwise or degenerate
 */
export function isClockwise(points: Point2D[]): boolean {
    return calculateSignedArea(points) > 0;
}

/**
 * Check if a polygon is wound counter-clockwise
 *
 * @param points Array of polygon vertices in order
 * @returns True if counter-clockwise, false if counter-clockwise or degenerate
 */
export function isCounterClockwise(points: Point2D[]): boolean {
    return calculateSignedArea(points) < 0;
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

    const area: number = calculateSignedArea(points);
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
        const cross: number =
            points[i].x * points[j].y - points[j].x * points[i].y;
        cx += (points[i].x + points[j].x) * cross;
        cy += (points[i].y + points[j].y) * cross;
    }

    // The formula works correctly with signed area - don't use absolute value
    // If the polygon is CW (positive area), the centroid calculation is direct
    // If the polygon is CCW (negative area), both area and cross products are negative, so they cancel out
    // eslint-disable-next-line no-magic-numbers
    const factor: number = 1 / (6 * area);
    return { x: cx * factor, y: cy * factor };
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
} /**
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
        if (shape.type === 'polyline') {
            // Check the explicit closed flag from DXF parsing
            const polyline: Polyline = shape.geometry as Polyline;
            if (
                typeof polyline.closed === 'boolean' &&
                polyline.closed === true
            ) {
                return true; // Explicitly closed polylines are definitely closed
            }
            // If closed is false or undefined, fall through to geometric check
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
 * Calculate the area of a closed chain using JSTS
 */

export function calculateChainArea(
    chain: Chain,
    tolerance: number = CHAIN_CLOSURE_TOLERANCE,
    params: PartDetectionParameters = DEFAULT_PART_DETECTION_PARAMETERS
): number {
    if (!isChainClosed(chain, tolerance)) return 0; // Only closed chains have area

    const points = tessellateChain(chain, params);
    if (points.length < POLYGON_POINTS_MIN) return 0;

    const geometryFactory = new GeometryFactory();

    try {
        // Convert points to JSTS coordinates with precision rounding
        const coords = points.map(
            (p) =>
                new Coordinate(
                    roundToDecimalPlaces(p.x, params.decimalPrecision),
                    roundToDecimalPlaces(p.y, params.decimalPrecision)
                )
        );

        // Ensure the ring is closed
        if (!coords[0].equals(coords[coords.length - 1])) {
            coords.push(coords[0]);
        }

        const linearRing = geometryFactory.createLinearRing(coords);
        const polygon = geometryFactory.createPolygon(linearRing);

        return polygon.getArea();
    } catch (error) {
        console.warn('Error calculating chain area:', error);
        return 0;
    }
} /**
 * Check if one closed chain contains another using JSTS geometric operations
 * Based on MetalHeadCAM implementation
 */

export function isChainContainedInChain(
    innerChain: Chain,
    outerChain: Chain,
    tolerance: number,
    params: PartDetectionParameters = DEFAULT_PART_DETECTION_PARAMETERS
): boolean {
    // Only closed chains can contain other chains
    if (!isChainClosed(outerChain, tolerance)) {
        return false;
    }

    const geometryFactory = new GeometryFactory();

    try {
        // Convert outer chain to JSTS polygon
        const outerPoints = tessellateChain(outerChain, params);
        const outerCoords = outerPoints.map(
            (p) =>
                new Coordinate(
                    roundToDecimalPlaces(p.x, params.decimalPrecision),
                    roundToDecimalPlaces(p.y, params.decimalPrecision)
                )
        );

        // Remove duplicate consecutive coordinates (this can cause JSTS to fail)
        const cleanOuterCoords: Coordinate[] = [];
        for (let i = 0; i < outerCoords.length; i++) {
            const current = outerCoords[i];
            const previous = cleanOuterCoords[cleanOuterCoords.length - 1];
            // Only add if it's different from the previous coordinate
            if (!previous || !current.equals(previous)) {
                cleanOuterCoords.push(current);
            }
        }

        // Ensure the ring is closed
        if (
            cleanOuterCoords.length > 0 &&
            !cleanOuterCoords[0].equals(
                cleanOuterCoords[cleanOuterCoords.length - 1]
            )
        ) {
            cleanOuterCoords.push(cleanOuterCoords[0]);
        }

        // Check minimum coordinate count like MetalHeadCAM
        if (cleanOuterCoords.length < JSTS_MIN_LINEAR_RING_COORDINATES) {
            return false;
        }

        const outerLinearRing =
            geometryFactory.createLinearRing(cleanOuterCoords);
        const outerPolygon = geometryFactory.createPolygon(outerLinearRing);

        // Convert inner chain to JSTS geometry
        const innerPoints = tessellateChain(innerChain, params);
        const innerCoords = innerPoints.map(
            (p) =>
                new Coordinate(
                    roundToDecimalPlaces(p.x, params.decimalPrecision),
                    roundToDecimalPlaces(p.y, params.decimalPrecision)
                )
        );

        if (isChainClosed(innerChain, tolerance)) {
            // Inner chain is closed - create polygon and check containment
            // Remove duplicate consecutive coordinates for inner chain too
            const cleanInnerCoords: Coordinate[] = [];
            for (let i = 0; i < innerCoords.length; i++) {
                const current = innerCoords[i];
                const previous = cleanInnerCoords[cleanInnerCoords.length - 1];
                // Only add if it's different from the previous coordinate
                if (!previous || !current.equals(previous)) {
                    cleanInnerCoords.push(current);
                }
            }

            // Ensure the ring is closed
            if (
                cleanInnerCoords.length > 0 &&
                !cleanInnerCoords[0].equals(
                    cleanInnerCoords[cleanInnerCoords.length - 1]
                )
            ) {
                cleanInnerCoords.push(cleanInnerCoords[0]);
            }

            // Check minimum coordinate count like MetalHeadCAM
            if (cleanInnerCoords.length < JSTS_MIN_LINEAR_RING_COORDINATES) {
                return false;
            }

            const innerLinearRing =
                geometryFactory.createLinearRing(cleanInnerCoords);
            const innerPolygon = geometryFactory.createPolygon(innerLinearRing);

            // Use JSTS RelateOp to check containment
            const result = RelateOp.contains(outerPolygon, innerPolygon);

            // If JSTS geometric containment failed, try fallback approach
            if (!result) {
                const innerArea = innerPolygon.getArea();
                const outerArea = outerPolygon.getArea();
                const areaRatio = innerArea / outerArea;

                // If inner area is much smaller (< 5% of outer area), try bounding box check
                // This handles cases where JSTS fails due to complex tessellation but logical containment exists
                if (areaRatio < AREA_RATIO_THRESHOLD) {
                    // Calculate bounding boxes for fallback check
                    const innerBounds = calculateChainBoundingBox(innerChain);
                    const outerBounds = calculateChainBoundingBox(outerChain);

                    const boundingBoxContained =
                        innerBounds.min.x >= outerBounds.min.x &&
                        innerBounds.max.x <= outerBounds.max.x &&
                        innerBounds.min.y >= outerBounds.min.y &&
                        innerBounds.max.y <= outerBounds.max.y;

                    if (boundingBoxContained) {
                        return true; // Use bounding box fallback when geometric test fails
                    }
                }
            }

            return result;
        } else {
            // Inner chain is open - create linestring and check if all points are contained
            const innerLineString =
                geometryFactory.createLineString(innerCoords);
            const result = RelateOp.contains(outerPolygon, innerLineString);

            return result;
        }
    } catch (error) {
        console.warn('Error in geometric containment detection:', error);
        return false;
    }
} /**
 * Checks if one closed chain is completely contained within another closed chain
 * using proper geometric containment (point-in-polygon testing)
 */

export function isChainGeometricallyContained(
    innerChain: Chain,
    outerChain: Chain
): boolean {
    // Extract polygon points from both chains
    const innerPolygon: Point2D[] | null = extractPolygonFromChain(innerChain);
    const outerPolygon: Point2D[] | null = extractPolygonFromChain(outerChain);

    if (
        !innerPolygon ||
        !outerPolygon ||
        innerPolygon.length < POLYGON_POINTS_MIN ||
        outerPolygon.length < POLYGON_POINTS_MIN
    ) {
        throw new Error(
            `Failed to extract polygons for containment check: inner chain ${innerChain.id}=${!!innerPolygon}, outer chain ${outerChain.id}=${!!outerPolygon}. Chains may have gaps preventing polygon creation.`
        );
    }

    // Check if all points of inner polygon are inside outer polygon
    return isPolygonContained(innerPolygon, outerPolygon);
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

                if (distance > GEOMETRIC_PRECISION_TOLERANCE) {
                    points.push(...shapePoints);
                } else {
                    points.push(...shapePoints.slice(1));
                }
            }
        }
    }

    // Remove duplicate points and ensure we have enough for a polygon
    const cleanedPoints: Point2D[] = removeDuplicatePoints(points);
    return cleanedPoints.length >= POLYGON_POINTS_MIN ? cleanedPoints : null;
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

        case GeometryType.POLYLINE:
            return getPolylineTangent(shape.geometry as Polyline, isStart);

        case GeometryType.SPLINE:
            return getSplineTangent(shape.geometry as Spline, isStart);

        default:
            throw Error(`Can not find tangent for shape: ${shape}`);
    }
}
