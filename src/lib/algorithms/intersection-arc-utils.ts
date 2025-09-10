import type { Point2D } from '../types/geometry';
import type { Arc } from '$lib/geometry/arc';
import type { IntersectionResult } from './offset-calculation/chain/types';
import { EPSILON } from '../constants';
import { normalizeAngle } from '../utils/polygon-geometry-shared';

// Re-export normalizeAngle from shared library for backward compatibility
export { normalizeAngle };

/**
 * Check if an angle is within an arc's angular range
 */
export function isAngleInArcRange(
    angle: number,
    startAngle: number,
    endAngle: number,
    clockwise: boolean
): boolean {
    // For full circles or extended arcs (>= 2π), always return true
    const totalAngle: number = Math.abs(endAngle - startAngle);
    if (totalAngle >= 2 * Math.PI - EPSILON) {
        return true;
    }

    const normAngle: number = normalizeAngle(angle);
    const normStart: number = normalizeAngle(startAngle);
    const normEnd: number = normalizeAngle(endAngle);

    if (clockwise) {
        if (normStart > normEnd) {
            // Clockwise arc from higher angle to lower angle (e.g., 180° to 90°)
            // In clockwise direction: valid angles go FROM start TO end by decreasing
            // This means angles between end and start are valid (the shorter path)
            return (
                normAngle >= normEnd - EPSILON &&
                normAngle <= normStart + EPSILON
            );
        } else {
            // Clockwise arc from lower angle to higher angle (e.g., 30° to 330°)
            // Arc spans across 0° in clockwise direction (the long way around)
            // Valid angles are from start to 360° OR from 0° to end
            return (
                normAngle >= normStart - EPSILON ||
                normAngle <= normEnd + EPSILON
            );
        }
    } else {
        if (normStart <= normEnd) {
            return (
                normAngle >= normStart - EPSILON &&
                normAngle <= normEnd + EPSILON
            );
        } else {
            return (
                normAngle >= normStart - EPSILON ||
                normAngle <= normEnd + EPSILON
            );
        }
    }
}

/**
 * Calculate parameter on arc for a given point
 */
export function calculateArcParameter(point: Point2D, arc: Arc): number {
    const { center, startAngle, endAngle, clockwise } = arc;
    const angle: number = Math.atan2(point.y - center.y, point.x - center.x);

    // For full circles (2π arcs), handle specially
    const totalAngle: number = clockwise
        ? (startAngle - endAngle + 2 * Math.PI) % (2 * Math.PI)
        : (endAngle - startAngle + 2 * Math.PI) % (2 * Math.PI);

    if (totalAngle < EPSILON) {
        // Full circle case - return normalized parameter
        const fullCircleParam: number = clockwise
            ? (startAngle - angle + 2 * Math.PI) % (2 * Math.PI)
            : (angle - startAngle + 2 * Math.PI) % (2 * Math.PI);
        return fullCircleParam / (2 * Math.PI);
    }

    const angleFromStart: number = clockwise
        ? (startAngle - angle + 2 * Math.PI) % (2 * Math.PI)
        : (angle - startAngle + 2 * Math.PI) % (2 * Math.PI);

    return angleFromStart / totalAngle;
}

/**
 * Check if a point lies on an arc (within angular bounds)
 */
export function isPointOnArc(point: Point2D, arc: Arc): boolean {
    const { center, startAngle, endAngle, clockwise } = arc;

    const angle: number = Math.atan2(point.y - center.y, point.x - center.x);
    const inRange: boolean = isAngleInArcRange(
        angle,
        startAngle,
        endAngle,
        clockwise
    );

    return inRange;
}

/**
 * Process arc intersection results and create IntersectionResult objects
 */
export function processArcIntersectionResults(
    results: IntersectionResult[]
): IntersectionResult[] {
    return results.map((result) => ({
        point: result.point,
        param1: result.param1,
        param2: result.param2,
        distance: result.distance || 0,
        type: result.type || 'exact',
        confidence: result.confidence || 1.0,
        onExtension: result.onExtension || false,
    }));
}
