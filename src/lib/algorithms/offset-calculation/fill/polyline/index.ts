import type {
    Shape,
    Point2D,
    Polyline,
} from '../../../../../lib/types/geometry';
import type { FillOptions, FillResult, ShapeExtension } from '../types';
import {
    extendPolylineToPoint,
    determinePolylineExtensionDirection,
    calculatePolylineExtension,
    type PolylineExtensionResult,
} from '../../extend/polyline';
import { polylineToPoints } from '$lib/geometry/polyline';

/**
 * Polyline Fill Module
 *
 * This module provides gap filling for polyline shapes by extending them
 * to intersection points. Polylines can be extended by:
 * 1. Extending the first or last segment linearly
 * 2. Adding new points to extend the polyline path
 */

/**
 * Extend a polyline to reach a specific intersection point
 *
 * @param shape - The polyline shape to extend
 * @param intersectionPoint - Target point to extend to
 * @param options - Fill operation options
 * @returns Result containing the extended polyline or error information
 */
export function fillPolylineToIntersection(
    shape: Shape,
    intersectionPoint: Point2D,
    options: FillOptions
): FillResult {
    if (shape.type !== 'polyline') {
        return createFailureResult('Shape must be a polyline');
    }

    const polyline: import('$lib/types/geometry').Polyline =
        shape.geometry as Polyline;

    try {
        // Use the extend module for all extension logic
        const extendedPolyline: Polyline | null = extendPolylineToPoint(
            polyline,
            intersectionPoint,
            {
                maxExtension: options.maxExtension,
                tolerance: options.tolerance,
                direction:
                    options.extendDirection === 'start'
                        ? 'start'
                        : options.extendDirection === 'end'
                          ? 'end'
                          : 'auto',
            }
        );

        if (!extendedPolyline) {
            return createFailureResult(
                'Failed to extend polyline to intersection point'
            );
        }

        // Calculate extension info for the shape extension data
        const extendDirection: 'start' | 'end' | null =
            determinePolylineExtensionDirection(polyline, intersectionPoint, {
                maxExtension: options.maxExtension,
                tolerance: options.tolerance,
                direction:
                    options.extendDirection === 'start'
                        ? 'start'
                        : options.extendDirection === 'end'
                          ? 'end'
                          : 'auto',
            });

        if (!extendDirection) {
            return createFailureResult(
                'Could not determine polyline extension direction'
            );
        }

        const extensionInfo: PolylineExtensionResult =
            calculatePolylineExtension(
                polyline,
                intersectionPoint,
                extendDirection,
                {
                    maxExtension: options.maxExtension,
                    tolerance: options.tolerance,
                    direction:
                        options.extendDirection === 'start'
                            ? 'start'
                            : options.extendDirection === 'end'
                              ? 'end'
                              : 'auto',
                }
            );
        if (!extensionInfo.success) {
            return createFailureResult(
                extensionInfo.error || 'Polyline extension calculation failed'
            );
        }

        const extension: ShapeExtension = {
            type: 'linear',
            amount: extensionInfo.extensionDistance,
            direction: extendDirection,
            originalShape: shape,
            extensionStart: (() => {
                const points: import('$lib/types/geometry').Point2D[] =
                    polylineToPoints(polyline);
                return extendDirection === 'start'
                    ? points[0]
                    : points[points.length - 1];
            })(),
            extensionEnd: intersectionPoint,
        };

        return {
            success: true,
            extendedShape: {
                ...shape,
                geometry: extendedPolyline,
            },
            extension,
            intersectionPoint,
            warnings: [],
            errors: [],
            confidence: 1.0,
        };
    } catch (error) {
        return createFailureResult(
            `Polyline extension failed: ${error instanceof Error ? (error as Error).message : String(error)}`
        );
    }
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
