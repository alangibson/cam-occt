import { EPSILON } from '$lib/constants';
import type { Shape, Point2D, Line } from '$lib/types/geometry';
import type { Spline } from '$lib/geometry/spline';
import { generateId } from '$lib/utils/id';
import { pointDistance } from '..';
import { calculateLineParameter } from '../../shared/trim-extend-utils';
import { type KeepSide, type TrimResult } from '../types';
import {
    TOLERANCE_RELAXATION_MULTIPLIER,
    DEFAULT_ARRAY_NOT_FOUND_INDEX,
} from '../../../../geometry/constants';
import { MIN_CONTROL_POINTS_FOR_SPLINE } from '$lib/geometry/spline';

/**
 * Default spline weight assignment
 */
const DEFAULT_SPLINE_WEIGHT = 1.0;

/**
 * Trim a spline at a specific point
 */
export function trimSpline(
    shape: Shape,
    point: Point2D,
    keepSide: KeepSide,
    tolerance: number
): TrimResult {
    const spline: Spline = shape.geometry as Spline;
    const result: TrimResult = {
        success: false,
        shape: null,
        warnings: [],
        errors: [],
    };

    if (spline.controlPoints.length < MIN_CONTROL_POINTS_FOR_SPLINE) {
        result.errors.push(
            'Cannot trim spline with less than 2 control points'
        );
        return result;
    }

    // For spline trimming, we'll use a simplified approach:
    // 1. Find the parameter t where the intersection occurs
    // 2. Adjust the control points and fit points accordingly
    // First, try to find the parameter by checking against fit points if available
    let trimParam: number = DEFAULT_ARRAY_NOT_FOUND_INDEX;

    if (spline.fitPoints && spline.fitPoints.length > 0) {
        // Use fit points to estimate the parameter
        for (let i: number = 0; i < spline.fitPoints.length; i++) {
            const fitPoint: Point2D = spline.fitPoints[i];
            const distance: number = pointDistance(point, fitPoint);

            if (distance <= tolerance) {
                trimParam = i / (spline.fitPoints.length - 1); // Normalize to [0,1]
                break;
            }
        }

        // If not found on exact fit points, interpolate between closest ones
        if (trimParam === DEFAULT_ARRAY_NOT_FOUND_INDEX) {
            for (let i: number = 0; i < spline.fitPoints.length - 1; i++) {
                const segStart: Point2D = spline.fitPoints[i];
                const segEnd: Point2D = spline.fitPoints[i + 1];

                // Check if point is on this segment
                const segment: Line = { start: segStart, end: segEnd };
                const param: number = calculateLineParameter(point, segment);

                if (param >= 0 && param <= 1) {
                    const segmentLength: number = pointDistance(
                        segStart,
                        segEnd
                    );
                    if (segmentLength > EPSILON) {
                        const segmentVec: Point2D = {
                            x: segEnd.x - segStart.x,
                            y: segEnd.y - segStart.y,
                        };
                        const pointVec: Point2D = {
                            x: point.x - segStart.x,
                            y: point.y - segStart.y,
                        };
                        const perpDistance: number =
                            Math.abs(
                                segmentVec.x * pointVec.y -
                                    segmentVec.y * pointVec.x
                            ) / segmentLength;

                        if (perpDistance <= tolerance) {
                            trimParam =
                                (i + param) / (spline.fitPoints.length - 1);
                            break;
                        }
                    }
                }
            }
        }
    } else {
        // Fallback: use control points for estimation
        for (let i: number = 0; i < spline.controlPoints.length; i++) {
            const controlPoint: Point2D = spline.controlPoints[i];
            const distance: number = pointDistance(point, controlPoint);

            if (distance <= tolerance) {
                trimParam = i / (spline.controlPoints.length - 1);
                break;
            }
        }
    }

    if (trimParam === DEFAULT_ARRAY_NOT_FOUND_INDEX) {
        // If we can't find the point on the spline exactly, use a more relaxed approach
        // Find the closest point on the spline's bounding box or control points
        let minDistance: number = Infinity;
        let bestIndex: number = DEFAULT_ARRAY_NOT_FOUND_INDEX;

        // Check against all control points with relaxed tolerance
        for (let i: number = 0; i < spline.controlPoints.length; i++) {
            const controlPoint: Point2D = spline.controlPoints[i];
            const distance: number = pointDistance(point, controlPoint);
            if (distance < minDistance) {
                minDistance = distance;
                bestIndex = i;
            }
        }

        // Use a much more relaxed tolerance for splines (10x the normal tolerance)
        const relaxedTolerance: number =
            tolerance * TOLERANCE_RELAXATION_MULTIPLIER;
        if (
            bestIndex !== DEFAULT_ARRAY_NOT_FOUND_INDEX &&
            minDistance <= relaxedTolerance
        ) {
            trimParam = bestIndex / (spline.controlPoints.length - 1);
            result.warnings.push(
                'Spline trim point found via relaxed control point matching'
            );
        } else {
            result.errors.push('Trim point is not on the spline');
            return result;
        }
    }

    // Clamp parameter to valid range
    trimParam = Math.max(0, Math.min(1, trimParam));

    // Create trimmed spline based on keepSide
    let newControlPoints: Point2D[] = [];
    let newFitPoints: Point2D[] = [];
    let newKnots: number[] = [];
    let newWeights: number[] = [];

    if (keepSide === 'start' || keepSide === 'before') {
        // Keep the beginning portion of the spline
        const splitIndex: number = Math.ceil(
            trimParam * (spline.controlPoints.length - 1)
        );
        newControlPoints = spline.controlPoints.slice(0, splitIndex + 1);
        // Ensure the last control point is the intersection
        if (newControlPoints.length > 0) {
            newControlPoints[newControlPoints.length - 1] = { ...point };
        }

        if (spline.fitPoints && spline.fitPoints.length > 0) {
            const fitSplitIndex: number = Math.ceil(
                trimParam * (spline.fitPoints.length - 1)
            );
            newFitPoints = spline.fitPoints.slice(0, fitSplitIndex + 1);
            if (newFitPoints.length > 0) {
                newFitPoints[newFitPoints.length - 1] = { ...point };
            }
        }
    } else if (keepSide === 'end' || keepSide === 'after') {
        // Keep the ending portion of the spline
        const splitIndex: number = Math.floor(
            trimParam * (spline.controlPoints.length - 1)
        );
        newControlPoints = [
            { ...point },
            ...spline.controlPoints.slice(splitIndex + 1),
        ];

        if (spline.fitPoints && spline.fitPoints.length > 0) {
            const fitSplitIndex: number = Math.floor(
                trimParam * (spline.fitPoints.length - 1)
            );
            newFitPoints = [
                { ...point },
                ...spline.fitPoints.slice(fitSplitIndex + 1),
            ];
        }
    } else {
        result.errors.push(
            `Invalid keepSide value for spline trimming: ${keepSide}`
        );
        return result;
    }

    // Ensure minimum points for a valid spline
    if (newControlPoints.length < MIN_CONTROL_POINTS_FOR_SPLINE) {
        result.errors.push(
            'Trimmed spline would have less than 2 control points'
        );
        return result;
    }

    // Adjust other spline properties
    newWeights = spline.weights.slice(0, newControlPoints.length);
    if (newWeights.length < newControlPoints.length) {
        // Pad with unit weights if needed
        while (newWeights.length < newControlPoints.length) {
            newWeights.push(DEFAULT_SPLINE_WEIGHT);
        }
    }

    // Simplified knot vector (uniform)
    newKnots = [];
    for (
        let i: number = 0;
        i < newControlPoints.length + spline.degree + 1;
        i++
    ) {
        newKnots.push(i);
    }

    const trimmedSpline: Spline = {
        controlPoints: newControlPoints,
        knots: newKnots,
        weights: newWeights,
        degree: spline.degree,
        fitPoints: newFitPoints,
        closed: false, // Trimmed splines are always open
    };

    result.shape = {
        ...shape,
        id: generateId(),
        geometry: trimmedSpline,
    };
    result.success = true;
    result.warnings.push('Spline trimming uses simplified approximation');

    return result;
}
