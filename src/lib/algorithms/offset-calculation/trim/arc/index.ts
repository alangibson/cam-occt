import type { Arc, Point2D, Shape } from '$lib/types/geometry';
import { TOLERANCE } from '$lib/geometry/math/constants';
import { generateId } from '$lib/domain/id';
import { pointDistance } from '..';
import {
    type KeepSide,
    type TrimResult,
} from '$lib/algorithms/offset-calculation/trim/types';
import { isAngleInArcRange } from '$lib/geometry/arc/functions';
import { extendArcToPoint } from '$lib/algorithms/offset-calculation/extend/arc';
import { FULL_CIRCLE_RADIANS, HALF_CIRCLE_DEG } from '$lib/geometry/circle';

/**
 * Adjust arc angles based on the trim point and which side to keep
 * @param arc The arc to adjust angles for
 * @param pointAngle The angle of the trim point
 * @param keepSide Which side of the trim point to keep
 * @returns Updated start and end angles, or null if keepSide is invalid
 */
function adjustArcAnglesForTrim(
    arc: Arc,
    pointAngle: number,
    keepSide: KeepSide
): { newStartAngle: number; newEndAngle: number } | null {
    let newStartAngle = arc.startAngle;
    let newEndAngle = arc.endAngle;

    switch (keepSide) {
        case 'start':
        case 'before':
            newEndAngle = pointAngle;
            break;
        case 'end':
        case 'after':
            newStartAngle = pointAngle;
            break;
        default:
            return null;
    }

    return { newStartAngle, newEndAngle };
}

/**
 * Validate that a trimmed arc has a sufficient angular range
 * @param arc The arc to validate
 * @param tolerance The minimum angular range in radians
 * @returns True if the arc is valid, false if degenerate
 */
function validateArcAngleRange(arc: Arc, tolerance: number): boolean {
    let angleRange;
    if (arc.clockwise) {
        angleRange =
            arc.startAngle > arc.endAngle
                ? arc.startAngle - arc.endAngle
                : arc.startAngle - arc.endAngle + FULL_CIRCLE_RADIANS;
    } else {
        angleRange =
            arc.endAngle > arc.startAngle
                ? arc.endAngle - arc.startAngle
                : arc.endAngle - arc.startAngle + FULL_CIRCLE_RADIANS;
    }

    // Use the standard tolerance for minimum angular range (in radians)
    return angleRange >= (tolerance * Math.PI) / HALF_CIRCLE_DEG;
}

/**
 * Trim an arc shape at a specific point
 */
export function trimArc(
    shape: Shape,
    point: Point2D,
    keepSide: KeepSide,
    tolerance: number
): TrimResult {
    const arc: Arc = shape.geometry as Arc;
    const result: TrimResult = {
        success: false,
        shape: null,
        warnings: [],
        errors: [],
    };

    // Check if point is on the arc
    const pointAngle: number = Math.atan2(
        point.y - arc.center.y,
        point.x - arc.center.x
    );

    // Verify the point is at the correct radius
    const pointRadius: number = pointDistance(point, arc.center);
    if (Math.abs(pointRadius - arc.radius) > tolerance) {
        result.errors.push('Trim point is not on the arc');
        return result;
    }

    // Check if angle is within arc bounds - if not, try extending the arc instead
    if (
        !isAngleInArcRange(
            pointAngle,
            arc.startAngle,
            arc.endAngle,
            arc.clockwise
        )
    ) {
        // Point is outside arc range - attempt to extend the arc to reach this point
        try {
            const extendedArc: Arc | null = extendArcToPoint(arc, point);

            if (!extendedArc) {
                result.errors.push('Failed to extend arc to trim point');
                return result;
            }

            // Now trim the extended arc at the point
            const angles = adjustArcAnglesForTrim(
                extendedArc,
                pointAngle,
                keepSide
            );
            if (!angles) {
                result.errors.push(
                    `Invalid keepSide value for arc trimming: ${keepSide}`
                );
                return result;
            }

            // Create the trimmed arc from the extended arc
            const trimmedArc: Arc = {
                center: { ...extendedArc.center },
                radius: extendedArc.radius,
                startAngle: angles.newStartAngle,
                endAngle: angles.newEndAngle,
                clockwise: extendedArc.clockwise,
            };

            // Validate the trimmed arc is not degenerate
            if (!validateArcAngleRange(trimmedArc, TOLERANCE)) {
                result.errors.push(
                    'Trimmed arc would be degenerate (zero angular range)'
                );
                return result;
            }

            result.shape = {
                ...shape,
                id: generateId(),
                geometry: trimmedArc,
            };
            result.success = true;
            result.warnings.push('Arc was extended to reach trim point');

            return result;
        } catch (error) {
            result.errors.push(
                `Failed to extend arc to trim point: ${(error as Error).message}`
            );
            return result;
        }
    }

    const angles = adjustArcAnglesForTrim(arc, pointAngle, keepSide);
    if (!angles) {
        result.errors.push(
            `Invalid keepSide value for arc trimming: ${keepSide}`
        );
        return result;
    }

    // Create the trimmed arc
    const trimmedArc: Arc = {
        center: { ...arc.center },
        radius: arc.radius,
        startAngle: angles.newStartAngle,
        endAngle: angles.newEndAngle,
        clockwise: arc.clockwise,
    };

    // Validate the trimmed arc is not degenerate
    if (!validateArcAngleRange(trimmedArc, TOLERANCE)) {
        result.errors.push(
            'Trimmed arc would be degenerate (zero angular range)'
        );
        return result;
    }

    result.shape = {
        ...shape,
        id: generateId(),
        geometry: trimmedArc,
    };
    result.success = true;

    return result;
}
