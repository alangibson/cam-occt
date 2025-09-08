import type {
    Shape,
    Point2D,
    Ellipse,
} from '../../../../../lib/types/geometry';
import type { FillOptions, FillResult } from '../types';
import type { OperationParams } from '../../shared/fill-extend-ops';
import {
    processEllipseOperation,
    getEllipsePoint,
    processFillExtendResult,
} from '../../shared/fill-extend-ops';

/**
 * Ellipse Fill Module
 *
 * This module provides gap filling for ellipse shapes by converting them to arcs
 * and then extending the arc range to reach intersection points. Since ellipses
 * are closed shapes, extension creates an elliptical arc with expanded angular coverage.
 */

/**
 * Extend an ellipse to reach a specific intersection point
 *
 * For ellipses, we convert to an elliptical arc starting near the intersection point
 * and extending in the direction that provides reasonable coverage.
 *
 * @param shape - The ellipse shape to extend
 * @param intersectionPoint - Target point to extend to
 * @param options - Fill operation options
 * @returns Result containing the extended elliptical arc or error information
 */
export function fillEllipseToIntersection(
    shape: Shape,
    intersectionPoint: Point2D,
    options: FillOptions
): FillResult {
    if (shape.type !== 'ellipse') {
        return createFailureResult('Shape must be an ellipse');
    }

    const ellipse: import('$lib/types/geometry').Ellipse =
        shape.geometry as Ellipse;

    // Convert FillOptions to OperationParams
    const params: OperationParams = {
        tolerance: options.tolerance,
        maxExtension: options.maxExtension,
        extendDirection: options.extendDirection,
    };

    // Use shared processing logic
    const result = processEllipseOperation(
        ellipse,
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
        (s: Shape, angle: number) =>
            getEllipsePoint(s.geometry as Ellipse, angle)
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
