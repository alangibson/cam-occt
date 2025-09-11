import { EPSILON } from '$lib/geometry/math/constants';
import type { Shape, Point2D, Ellipse } from '$lib/types/geometry';
import { generateId } from '$lib/domain/id';
import type { KeepSide, TrimResult } from '../types';

/**
 * Trim an ellipse at a specific point
 */
export function trimEllipse(
    shape: Shape,
    point: Point2D,
    keepSide: KeepSide,
    tolerance: number
): TrimResult {
    const ellipse: import('$lib/types/geometry').Ellipse =
        shape.geometry as Ellipse;
    const result: TrimResult = {
        success: false,
        shape: null,
        warnings: [],
        errors: [],
    };

    const { center, majorAxisEndpoint, minorToMajorRatio } = ellipse;

    // Calculate ellipse parameters
    const a: number = Math.sqrt(
        majorAxisEndpoint.x ** 2 + majorAxisEndpoint.y ** 2
    ); // Semi-major axis
    const b: number = a * minorToMajorRatio; // Semi-minor axis
    const rotAngle: number = Math.atan2(
        majorAxisEndpoint.y,
        majorAxisEndpoint.x
    );
    const cosRot: number = Math.cos(rotAngle);
    const sinRot: number = Math.sin(rotAngle);

    // Transform point to ellipse local coordinates
    const dx: number = point.x - center.x;
    const dy: number = point.y - center.y;
    const localX: number = dx * cosRot + dy * sinRot;
    const localY: number = -dx * sinRot + dy * cosRot;

    // Check if point is on the ellipse
    const ellipseValue: number = (localX / a) ** 2 + (localY / b) ** 2;
    if (Math.abs(ellipseValue - 1.0) > tolerance) {
        result.errors.push('Trim point is not on the ellipse');
        return result;
    }

    // Calculate the parameter (angle) of the trim point
    const trimAngle: number = Math.atan2(localY / b, localX / a);
    const normalizedTrimAngle: number =
        trimAngle < 0 ? trimAngle + 2 * Math.PI : trimAngle;

    // If this is already an ellipse arc, check if we're within bounds
    if (ellipse.startParam !== undefined && ellipse.endParam !== undefined) {
        const startParam: number = ellipse.startParam;
        const endParam: number = ellipse.endParam;

        // Check if trim point is within existing arc bounds
        let angleInRange: boolean = false;
        if (startParam <= endParam) {
            angleInRange =
                normalizedTrimAngle >= startParam - tolerance &&
                normalizedTrimAngle <= endParam + tolerance;
        } else {
            angleInRange =
                normalizedTrimAngle >= startParam - tolerance ||
                normalizedTrimAngle <= endParam + tolerance;
        }

        if (!angleInRange) {
            result.errors.push('Trim point is not within ellipse arc bounds');
            return result;
        }
    }

    // Create ellipse arc based on keepSide
    let newStartParam: number;
    let newEndParam: number;

    if (ellipse.startParam !== undefined && ellipse.endParam !== undefined) {
        // Already an arc - trim it further
        const currentStart: number = ellipse.startParam;
        const currentEnd: number = ellipse.endParam;

        switch (keepSide) {
            case 'start':
            case 'before':
                newStartParam = currentStart;
                newEndParam = normalizedTrimAngle;
                break;
            case 'end':
            case 'after':
                newStartParam = normalizedTrimAngle;
                newEndParam = currentEnd;
                break;
            default:
                result.errors.push(
                    `Invalid keepSide value for ellipse arc trimming: ${keepSide}`
                );
                return result;
        }
    } else {
        // Full ellipse - convert to arc
        const gapSize: number = 0.05; // Small gap in radians

        switch (keepSide) {
            case 'start':
            case 'before':
                newStartParam = normalizedTrimAngle + gapSize;
                newEndParam = normalizedTrimAngle + 2 * Math.PI - gapSize;
                break;
            case 'end':
            case 'after':
                newStartParam = normalizedTrimAngle + gapSize;
                newEndParam = normalizedTrimAngle + 2 * Math.PI - gapSize;
                break;
            default:
                result.errors.push(
                    `Invalid keepSide value for ellipse trimming: ${keepSide}`
                );
                return result;
        }
    }

    // Normalize angles to [0, 2π)
    const normalizeAngle: (angle: number) => number = (angle: number) => {
        angle = angle % (2 * Math.PI);
        return angle < 0 ? angle + 2 * Math.PI : angle;
    };

    newStartParam = normalizeAngle(newStartParam);
    newEndParam = normalizeAngle(newEndParam);

    // Validate the arc isn't degenerate
    let angularRange: number = Math.abs(newEndParam - newStartParam);
    if (angularRange > Math.PI) {
        angularRange = 2 * Math.PI - angularRange;
    }

    if (angularRange < EPSILON) {
        result.errors.push(
            'Trimmed ellipse arc would be degenerate (zero angular range)'
        );
        return result;
    }

    // Create the trimmed ellipse (as ellipse arc)
    const trimmedEllipse: Ellipse = {
        center: { ...center },
        majorAxisEndpoint: { ...majorAxisEndpoint },
        minorToMajorRatio,
        startParam: newStartParam,
        endParam: newEndParam,
    };

    result.shape = {
        ...shape,
        id: generateId(),
        geometry: trimmedEllipse,
    };
    result.success = true;

    if (ellipse.startParam === undefined && ellipse.endParam === undefined) {
        result.warnings.push(
            'Full ellipse converted to ellipse arc for trimming'
        );
    }

    return result;
}
