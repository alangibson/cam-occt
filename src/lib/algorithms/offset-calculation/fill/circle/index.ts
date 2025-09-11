import type { Point2D, Shape } from '$lib/types/geometry';
import type { Circle } from '$lib/geometry/circle';
import type { FillOptions, FillResult } from '../types';
import type { OperationParams } from '../../shared/fill-extend-ops';
import {
    getCirclePoint,
    processCircleOperation,
    processFillExtendResult,
} from '../../shared/fill-extend-ops';

/**
 * Circle Fill Module
 *
 * This module provides gap filling for circle shapes by converting them to arcs
 * and then extending the arc range to reach intersection points. Since circles
 * are closed shapes, extension creates an arc with expanded angular coverage.
 */

/**
 * Extend a circle to reach a specific intersection point
 *
 * For circles, we convert to an arc starting at the intersection point and
 * extending in the direction that provides the shortest path around the circle.
 *
 * @param shape - The circle shape to extend
 * @param intersectionPoint - Target point to extend to
 * @param options - Fill operation options
 * @returns Result containing the extended arc or error information
 */
export function fillCircleToIntersection(
    shape: Shape,
    intersectionPoint: Point2D,
    options: FillOptions
): FillResult {
    if (shape.type !== 'circle') {
        return createFailureResult('Shape must be a circle');
    }

    const circle: import('$lib/types/geometry').Circle =
        shape.geometry as Circle;

    // Convert FillOptions to OperationParams
    const params: OperationParams = {
        tolerance: options.tolerance,
        maxExtension: options.maxExtension,
        extendDirection: options.extendDirection,
    };

    // Use shared processing logic
    const result = processCircleOperation(
        circle,
        intersectionPoint,
        'fill',
        params
    );

    // Process result using shared function
    return processFillExtendResult(
        result,
        shape,
        intersectionPoint,
        'fill',
        (s: Shape, angle: number) => getCirclePoint(s.geometry as Circle, angle)
    );
}

/**
 * Create a failed fill result
 */
function createFailureResult(error: string): FillResult {
    return {
        success: false,
        extendedShape: null,
        warnings: [],
        errors: [error],
        confidence: 0.0,
    };
}
