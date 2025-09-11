/**
 * Chain and polygon functions
 */

import type { Point2D } from '$lib/types/geometry';
import type { Chain } from '$lib/algorithms/chain-detection/chain-detection';
import {
    getShapeEndPoint,
    getShapeStartPoint,
    reverseShape,
    tessellateShape,
} from '$lib/geometry/shape/functions';
import { calculatePerimeter } from '$lib/geometry/math';
import { calculatePolygonArea as calculatePolygonAreaShared } from '$lib/utils/polygon-geometry-shared';
import { CHAIN_CLOSURE_TOLERANCE, POLYGON_POINTS_MIN } from './constants';
import { WindingDirection } from './enums';
import { JSTS_MIN_LINEAR_RING_COORDINATES } from '$lib/algorithms/part-detection/geometric-containment';
import { roundToDecimalPlaces } from '../math/functions';
import { GeometryFactory, Coordinate } from 'jsts/org/locationtech/jts/geom';
import { AREA_RATIO_THRESHOLD } from '$lib/algorithms/constants';
import { calculateChainBoundingBox } from '$lib/utils/shape-bounds-utils';
import { RelateOp } from 'jsts/org/locationtech/jts/operation/relate';
import {
    DEFAULT_PART_DETECTION_PARAMETERS,
    type PartDetectionParameters,
} from '$lib/types/part-detection';

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
 * Calculate the unsigned (absolute) area of a polygon
 * Delegated to polygon-geometry-shared.ts to eliminate duplication
 *
 * @param points Array of polygon vertices in order
 * @returns Absolute area of the polygon (always positive)
 */
export function calculatePolygonArea(points: Point2D[]): number {
    return calculatePolygonAreaShared(points);
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
 * Check if a chain is closed within tolerance
 * Uses the same logic as part detection for consistency
 */

export function isChainClosed(chain: Chain, tolerance: number): boolean {
    if (chain.shapes.length === 0) return false;

    const firstShape = chain.shapes[0];
    const lastShape = chain.shapes[chain.shapes.length - 1];

    const firstStart = getShapeStartPoint(firstShape);
    const lastEnd = getShapeEndPoint(lastShape);

    // Check if the chain is closed (end connects to start within tolerance)
    const distance = Math.sqrt(
        Math.pow(firstStart.x - lastEnd.x, 2) +
            Math.pow(firstStart.y - lastEnd.y, 2)
    );

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

            if (
                (innerChain.id === 'chain-2' || innerChain.id === 'chain-4') &&
                outerChain.id === 'chain-3'
            ) {
                console.log(
                    `  JSTS RelateOp.contains (linestring) result: ${result}`
                );
            }

            return result;
        }
    } catch (error) {
        console.warn('Error in geometric containment detection:', error);
        return false;
    }
}
