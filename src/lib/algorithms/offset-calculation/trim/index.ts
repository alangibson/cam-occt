import type { Arc } from '$lib/geometry/arc';
import type { Circle } from '$lib/geometry/circle';
import type { Line } from '$lib/geometry/line';
import type { Polyline } from '$lib/geometry/polyline';
import type { IntersectionResult } from '$lib/algorithms/offset-calculation/chain/types';
import type { Point2D, Shape } from '$lib/types';
import { MICRO_TOLERANCE } from '$lib/geometry/constants';
import { trimArc } from './arc';
import { trimCircle } from './circle';
import { trimLine } from './line';
import { trimPolyline } from './polyline';
import { trimEllipse } from './ellipse';
import type { KeepSide, TrimResult } from './types';
import { polylineToPoints } from '$lib/geometry/polyline';
import { isNearlyEqual, INTERSECTION_TOLERANCE } from '$lib/geometry/math';
import { pointDistance } from '$lib/algorithms/offset-calculation/shared/trim-extend-utils';

/**
 * Intersection scoring constants for comprehensive intersection scoring system
 */
const INTERSECTION_CONFIDENCE_THRESHOLD = 0.5;
const INTERSECTION_HIGH_CONFIDENCE_THRESHOLD = 0.9;
const INTERSECTION_TOLERANCE_MULTIPLIER = 10;
const INTERSECTION_SCORE_DISTANCE_WEIGHT = 40;
const INTERSECTION_SCORE_CONFIDENCE_WEIGHT = 30;
const INTERSECTION_SCORE_EXACT = 20;
const INTERSECTION_SCORE_TANGENT = 15;
const INTERSECTION_SCORE_APPROXIMATE = 10;
const INTERSECTION_SCORE_COINCIDENT = 5;
const INTERSECTION_SCORE_PARAMETER_WEIGHT = 5;
const INTERSECTION_SCORE_MAX_DISTANCE = 100;

// Re-export shared utilities for backward compatibility
export { pointDistance } from '$lib/algorithms/offset-calculation/shared/trim-extend-utils';

/**
 * Trimming Module
 *
 * This module provides precise shape trimming capabilities for chain offset operations.
 * It handles trimming shapes at intersection points to create sharp corners while
 * maintaining geometric accuracy and parallelism invariants.
 *
 * Key features:
 * - Supports all shape types (line, arc, circle, polyline, spline, ellipse)
 * - Maintains shape-specific properties after trimming
 * - Creates sharp corners with minimal geometry deviation
 * - Handles edge cases and degenerate geometries robustly
 */
const DEFAULT_TOLERANCE: number = INTERSECTION_TOLERANCE;

/**
 * Main entry point for trimming a shape at a specific point
 *
 * @param shape - The shape to trim
 * @param point - The point where trimming should occur
 * @param keepSide - Which side of the shape to keep
 * @param tolerance - Geometric tolerance for point matching
 * @returns Result containing the trimmed shape or error information
 */
export function trimShapeAtPoint(
    shape: Shape,
    point: Point2D,
    keepSide: KeepSide,
    tolerance: number = DEFAULT_TOLERANCE
): TrimResult {
    const result: TrimResult = {
        success: false,
        shape: null,
        warnings: [],
        errors: [],
    };

    try {
        switch (shape.type) {
            case 'line':
                return trimLine(shape, point, keepSide, tolerance);
            case 'arc':
                return trimArc(shape, point, keepSide, tolerance);
            case 'circle':
                return trimCircle(shape, point, keepSide, tolerance);
            case 'polyline':
                return trimPolyline(shape, point, keepSide, tolerance);
            case 'spline':
                // Disabled because this breaks splines.
                // Also doesnt seem necessary for splines.
                // return trimSpline(shape, point, keepSide, tolerance);
                result.success = true;
                result.shape = shape;
                return result;
            case 'ellipse':
                return trimEllipse(shape, point, keepSide, tolerance);
            default:
                result.errors.push(
                    `Unsupported shape type for trimming: ${shape.type}`
                );
                return result;
        }
    } catch (error) {
        result.errors.push(`Trimming failed: ${(error as Error).message}`);
        return result;
    }
}

/**
 * Select the best intersection point for trimming from multiple candidates
 *
 * @param intersections - Available intersection points
 * @param jointPoint - Reference point (typically where shapes should connect)
 * @param tolerance - Geometric tolerance
 * @returns The best intersection point or null if none suitable
 */
export function selectTrimPoint(
    intersections: IntersectionResult[],
    jointPoint: Point2D,
    tolerance: number = DEFAULT_TOLERANCE
): IntersectionResult | null {
    if (intersections.length === 0) {
        return null;
    }

    if (intersections.length === 1) {
        return intersections[0];
    }

    // Filter out obviously bad intersections (very low confidence)
    let filteredIntersections: IntersectionResult[] = intersections.filter(
        (intersection) =>
            intersection.confidence > INTERSECTION_CONFIDENCE_THRESHOLD &&
            intersection.param1 >= -tolerance &&
            intersection.param1 <= 1 + tolerance &&
            intersection.param2 >= -tolerance &&
            intersection.param2 <= 1 + tolerance
    );

    // Additional validation: if parameters are near 0 or 1, verify the point actually matches
    // the geometry at those parameters. This helps catch invalid intersections from approximations.
    filteredIntersections = filteredIntersections.filter((intersection) => {
        // Only validate parameters that are very close to endpoints
        if (
            isNearlyEqual(intersection.param1, 0, INTERSECTION_TOLERANCE) ||
            isNearlyEqual(intersection.param1, 1, INTERSECTION_TOLERANCE) ||
            isNearlyEqual(intersection.param2, 0, INTERSECTION_TOLERANCE) ||
            isNearlyEqual(intersection.param2, 1, INTERSECTION_TOLERANCE)
        ) {
            // For now, just be more conservative with endpoint intersections
            // This is a temporary fix - a full implementation would validate against actual geometry
            return (
                intersection.distance < tolerance &&
                intersection.confidence > INTERSECTION_HIGH_CONFIDENCE_THRESHOLD
            );
        }
        return true; // Keep non-endpoint intersections
    });

    // If filtering removed everything, fall back to all intersections
    const candidateIntersections: IntersectionResult[] =
        filteredIntersections.length > 0
            ? filteredIntersections
            : intersections;

    // Score intersections based on multiple criteria
    const scoredIntersections: {
        intersection: IntersectionResult;
        score: number;
    }[] = candidateIntersections.map((intersection) => ({
        intersection,
        score: calculateIntersectionScore(intersection, jointPoint),
    }));

    // Sort by score (higher is better)
    scoredIntersections.sort((a, b) => b.score - a.score);

    // Return the highest-scoring intersection
    return scoredIntersections[0].intersection;
}

/**
 * Trim two consecutive shapes at their intersection points
 *
 * @param shape1 - First shape to trim
 * @param shape2 - Second shape to trim
 * @param intersections - Intersection points between the shapes
 * @param tolerance - Geometric tolerance
 * @returns Results for both trimmed shapes
 */
export function trimConsecutiveShapes(
    shape1: Shape,
    shape2: Shape,
    intersections: IntersectionResult[],
    tolerance: number = DEFAULT_TOLERANCE
): { shape1Result: TrimResult; shape2Result: TrimResult } {
    const results: { shape1Result: TrimResult; shape2Result: TrimResult } = {
        shape1Result: {
            success: false,
            shape: null,
            warnings: [],
            errors: [],
        } as TrimResult,
        shape2Result: {
            success: false,
            shape: null,
            warnings: [],
            errors: [],
        } as TrimResult,
    };

    if (intersections.length === 0) {
        results.shape1Result.errors.push(
            'No intersections found between shapes'
        );
        results.shape2Result.errors.push(
            'No intersections found between shapes'
        );
        return results;
    }

    // Find the connection point between the two shapes
    const jointPoint: Point2D = findConnectionPoint(shape1, shape2);

    // Select the best intersection point for trimming
    const selectedIntersection: IntersectionResult | null = selectTrimPoint(
        intersections,
        jointPoint,
        tolerance
    );

    if (!selectedIntersection) {
        results.shape1Result.errors.push(
            'No suitable intersection point found'
        );
        results.shape2Result.errors.push(
            'No suitable intersection point found'
        );
        return results;
    }

    // Use a more relaxed tolerance for trimming to handle approximation errors
    const trimmingTolerance: number = Math.max(
        tolerance * INTERSECTION_TOLERANCE_MULTIPLIER,
        MICRO_TOLERANCE
    );

    // Trim both shapes at the selected intersection
    // Shape1 should be trimmed to end at the intersection (keep start portion)
    results.shape1Result = trimShapeAtPoint(
        shape1,
        selectedIntersection.point,
        'before',
        trimmingTolerance
    );
    // Shape2 should be trimmed to start at the intersection (keep end portion)
    results.shape2Result = trimShapeAtPoint(
        shape2,
        selectedIntersection.point,
        'after',
        trimmingTolerance
    );

    return results;
}

/**
 * Calculate intersection quality score
 */
function calculateIntersectionScore(
    intersection: IntersectionResult,
    jointPoint: Point2D
): number {
    let score: number = 0;

    // Distance factor (closer to joint point is better)
    const distance: number = pointDistance(intersection.point, jointPoint);
    const maxDistance: number = INTERSECTION_SCORE_MAX_DISTANCE; // Arbitrary maximum for normalization
    score +=
        Math.max(0, (maxDistance - distance) / maxDistance) *
        INTERSECTION_SCORE_DISTANCE_WEIGHT;

    // Confidence factor
    score += intersection.confidence * INTERSECTION_SCORE_CONFIDENCE_WEIGHT;

    // Intersection type factor (exact > tangent > approximate)
    switch (intersection.type) {
        case 'exact':
            score += INTERSECTION_SCORE_EXACT;
            break;
        case 'tangent':
            score += INTERSECTION_SCORE_TANGENT;
            break;
        case 'approximate':
            score += INTERSECTION_SCORE_APPROXIMATE;
            break;
        case 'coincident':
            score += INTERSECTION_SCORE_COINCIDENT;
            break;
    }

    // Parameter factor (prefer intersections not too close to endpoints)
    const param1Factor: number = Math.min(
        intersection.param1,
        1 - intersection.param1
    );
    const param2Factor: number = Math.min(
        intersection.param2,
        1 - intersection.param2
    );
    score +=
        (param1Factor + param2Factor) * INTERSECTION_SCORE_PARAMETER_WEIGHT;

    return score;
}

/**
 * Find the connection point between two shapes (where they should meet)
 */
function findConnectionPoint(shape1: Shape, shape2: Shape): Point2D {
    // For testing purposes, use a simple midpoint of shape centers
    const center1: Point2D = getShapeCenter(shape1);
    const center2: Point2D = getShapeCenter(shape2);

    return {
        x: (center1.x + center2.x) / 2,
        y: (center1.y + center2.y) / 2,
    };
}

/**
 * Get the center point of any shape type
 */
function getShapeCenter(shape: Shape): Point2D {
    switch (shape.type) {
        case 'line':
            const line: Line = shape.geometry as Line;
            return {
                x: (line.start.x + line.end.x) / 2,
                y: (line.start.y + line.end.y) / 2,
            };
        case 'arc':
            const arc: Arc = shape.geometry as Arc;
            return arc.center;
        case 'circle':
            const circle: Circle = shape.geometry as Circle;
            return circle.center;
        case 'polyline':
            const polyline: Polyline = shape.geometry as Polyline;
            const points: Point2D[] = polylineToPoints(polyline);
            return {
                x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
                y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
            };
        default:
            return { x: 0, y: 0 };
    }
}
