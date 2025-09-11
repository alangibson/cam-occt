import type { Point2D, Line } from '../types/geometry';
import type { IntersectionResult } from './offset-calculation/chain/types';
import { EPSILON } from '$lib/geometry/math';
import { TOLERANCE_RELAXATION_MULTIPLIER } from '../geometry/constants';

export type SegmentPosition = 'first' | 'intermediate' | 'last' | 'only';

/**
 * Calculate parameter t where point lies on line (0 = start, 1 = end)
 */
export function calculateLineParameterForPoint(
    point: Point2D,
    line: Line
): number {
    const dx: number = line.end.x - line.start.x;
    const dy: number = line.end.y - line.start.y;
    const lineLength2: number = dx * dx + dy * dy;

    if (lineLength2 < EPSILON * EPSILON) {
        return 0; // Degenerate line
    }

    const dotProduct: number =
        (point.x - line.start.x) * dx + (point.y - line.start.y) * dy;
    return dotProduct / lineLength2;
}

/**
 * Check if a parameter value is valid for a given segment position
 */
export function isParameterValidForSegment(
    param: number,
    position: SegmentPosition
): boolean {
    const tolerance: number = EPSILON * TOLERANCE_RELAXATION_MULTIPLIER; // Small tolerance for floating point precision

    switch (position) {
        case 'only':
            // Standalone segment - allow slight extension on both ends for chain offset
            return true;

        case 'first':
            // First segment - allow extension before start (param < 0), but not past end (param > 1)
            return param <= 1 + tolerance;

        case 'intermediate':
            // Intermediate segment - only allow intersections within bounds
            return param >= -tolerance && param <= 1 + tolerance;

        case 'last':
            // Last segment - allow extension past end (param > 1), but not before start (param < 0)
            return param >= -tolerance;

        default:
            return param >= -tolerance && param <= 1 + tolerance;
    }
}

/**
 * Core line-line intersection calculation
 * Returns intersection parameters without segment bounds checking
 */
export function calculateLineIntersection(
    line1: Line,
    line2: Line
): IntersectionResult[] {
    const x1: number = line1.start.x,
        y1: number = line1.start.y;
    const x2: number = line1.end.x,
        y2: number = line1.end.y;
    const x3: number = line2.start.x,
        y3: number = line2.start.y;
    const x4: number = line2.end.x,
        y4: number = line2.end.y;

    const dx1: number = x2 - x1,
        dy1: number = y2 - y1;
    const dx2: number = x4 - x3,
        dy2: number = y4 - y3;

    // Handle degenerate cases (point-line intersections)
    const line1IsPoint: boolean =
        Math.abs(dx1) < EPSILON && Math.abs(dy1) < EPSILON;
    const line2IsPoint: boolean =
        Math.abs(dx2) < EPSILON && Math.abs(dy2) < EPSILON;

    if (line1IsPoint && line2IsPoint) {
        // Both are points - check if they're the same
        if (Math.abs(x1 - x3) < EPSILON && Math.abs(y1 - y3) < EPSILON) {
            return [
                {
                    point: { x: x1, y: y1 },
                    param1: 0,
                    param2: 0,
                    distance: 0,
                    type: 'exact',
                    confidence: 1.0,
                },
            ];
        }
        return [];
    }

    if (line1IsPoint) {
        // Line1 is a point, check if it lies on line2 (extended infinitely)
        const t2: number =
            Math.abs(dx2) > Math.abs(dy2) ? (x1 - x3) / dx2 : (y1 - y3) / dy2;

        const projectedX: number = x3 + t2 * dx2;
        const projectedY: number = y3 + t2 * dy2;

        if (
            Math.abs(projectedX - x1) < EPSILON &&
            Math.abs(projectedY - y1) < EPSILON
        ) {
            return [
                {
                    point: { x: x1, y: y1 },
                    param1: 0,
                    param2: snapParameter(t2),
                    distance: 0,
                    type: 'exact',
                    confidence: 1.0,
                },
            ];
        }
        return [];
    }

    if (line2IsPoint) {
        // Line2 is a point, check if it lies on line1 (extended infinitely)
        const t1: number =
            Math.abs(dx1) > Math.abs(dy1) ? (x3 - x1) / dx1 : (y3 - y1) / dy1;

        const projectedX: number = x1 + t1 * dx1;
        const projectedY: number = y1 + t1 * dy1;

        if (
            Math.abs(projectedX - x3) < EPSILON &&
            Math.abs(projectedY - y3) < EPSILON
        ) {
            return [
                {
                    point: { x: x3, y: y3 },
                    param1: snapParameter(t1),
                    param2: 0,
                    distance: 0,
                    type: 'exact',
                    confidence: 1.0,
                },
            ];
        }
        return [];
    }

    const denominator: number = dx1 * dy2 - dy1 * dx2;

    // Check for parallel lines
    if (Math.abs(denominator) < EPSILON) {
        return []; // Parallel lines - no intersection
    }

    // Calculate intersection parameters
    const t1: number =
        ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
    const t2: number =
        ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / denominator;

    // Calculate intersection point
    const point: Point2D = {
        x: x1 + t1 * dx1,
        y: y1 + t1 * dy1,
    };

    // Only snap parameters if they're very close to 0 or 1 but still within [0,1]
    // Don't snap parameters outside [0,1] as they indicate extensions
    const snapT1: number = t1 > 0 && t1 < 1 ? snapParameter(t1) : t1;
    const snapT2: number = t2 > 0 && t2 < 1 ? snapParameter(t2) : t2;

    const result: IntersectionResult = {
        point,
        param1: snapT1,
        param2: snapT2,
        distance: 0,
        type: 'exact',
        confidence: 1.0,
    };

    return [result];
}

/**
 * Snap parameter to 0 or 1 if very close to endpoints
 */
export function snapParameter(t: number): number {
    if (t < EPSILON) return 0;
    if (t > 1 - EPSILON) return 1;
    return t;
}
