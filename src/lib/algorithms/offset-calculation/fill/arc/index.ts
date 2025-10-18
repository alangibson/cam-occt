import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Shape } from '$lib/geometry/shape/interfaces';
import type {
    FillOptions,
    FillResult,
    ShapeExtension,
} from '$lib/algorithms/offset-calculation/fill/types';
import {
    type ArcExtensionResult,
    calculateArcExtension,
    extendArcToPoint,
    getArcEndpoint,
} from '$lib/algorithms/offset-calculation/extend/arc';
import { pointDistance } from '$lib/algorithms/offset-calculation/shared/trim-extend-utils';
import {
    createArcExtensionConfig,
    createArcExtensionOptions,
} from '$lib/algorithms/offset-calculation/extend/arc-operations-utils';
import { calculateIntersectionAngle } from '$lib/geometry/arc/functions';
import {
    CONFIDENCE_HIGH_THRESHOLD,
    HIGH_PRECISION_TOLERANCE,
} from '$lib/geometry/constants';

/**
 * Arc Fill Module
 *
 * This module provides gap filling for arc shapes by extending their
 * angular range to reach intersection points. It preserves all arc
 * properties (center, radius, clockwise direction) while extending
 * the angular coverage.
 */

/**
 * Extend an arc to reach a specific intersection point
 *
 * @param shape - The arc shape to extend
 * @param intersectionPoint - Target point to extend to
 * @param options - Fill operation options
 * @returns Result containing the extended arc or error information
 */
export function fillArcToIntersection(
    shape: Shape,
    intersectionPoint: Point2D,
    options: FillOptions
): FillResult {
    if (shape.type !== 'arc') {
        return createFailureResult('Shape must be an arc');
    }

    const arc: Arc = shape.geometry as Arc;

    try {
        // Validate arc geometry and intersection point
        const validationResult = validateArcAndIntersection(
            arc,
            intersectionPoint,
            options.tolerance
        );
        if (!validationResult.isValid) {
            return createFailureResult(validationResult.error);
        }

        // Use the extend module for all extension logic
        const extendConfig = createArcExtensionOptions(options);
        const extendedArc = extendArcToPoint(
            arc,
            intersectionPoint,
            extendConfig
        );

        if (!extendedArc) {
            // Calculate if extension would exceed maximum
            const intersectionAngle = calculateIntersectionAngle(
                intersectionPoint,
                arc
            );
            const extendDirection = createArcExtensionConfig(
                arc,
                intersectionAngle,
                options
            );

            if (extendDirection) {
                const extensionInfo: ArcExtensionResult = calculateArcExtension(
                    arc,
                    intersectionAngle,
                    extendDirection
                );
                if (extensionInfo.success) {
                    const linearExtension: number =
                        extensionInfo.angularExtension * arc.radius;
                    if (linearExtension > options.maxExtension) {
                        return createFailureResult(
                            'Extension distance exceeds maximum allowed'
                        );
                    }
                }
            }

            return createFailureResult(
                'Failed to extend arc to intersection point'
            );
        }

        // Calculate extension info for the shape extension data
        const intersectionAngle = calculateIntersectionAngle(
            intersectionPoint,
            arc
        );
        const extendDirection = createArcExtensionConfig(
            arc,
            intersectionAngle,
            options
        );

        if (!extendDirection) {
            return createFailureResult(
                'Could not determine arc extension direction'
            );
        }

        const extensionInfo: ArcExtensionResult = calculateArcExtension(
            arc,
            intersectionAngle,
            extendDirection
        );
        if (!extensionInfo.success) {
            return createFailureResult(
                extensionInfo.error || 'Arc extension calculation failed'
            );
        }

        const extension: ShapeExtension = {
            type: 'angular',
            amount: extensionInfo.angularExtension,
            direction: extendDirection,
            originalShape: shape,
            extensionStart: getArcEndpoint(
                arc,
                extendDirection === 'start' ? arc.startAngle : arc.endAngle
            ),
            extensionEnd: intersectionPoint,
        };

        return {
            success: true,
            extendedShape: {
                ...shape,
                geometry: extendedArc,
            },
            extension,
            intersectionPoint,
            warnings: [],
            errors: [],
            confidence: CONFIDENCE_HIGH_THRESHOLD,
        };
    } catch (error) {
        return createFailureResult(
            `Arc extension failed: ${error instanceof Error ? (error as Error).message : String(error)}`
        );
    }
}

/**
 * Validate arc geometry and intersection point
 */
function validateArcAndIntersection(
    arc: Arc,
    intersectionPoint: Point2D,
    tolerance: number
): { isValid: boolean; error: string } {
    // Validate arc geometry first
    if (arc.radius <= 0) {
        return { isValid: false, error: 'Arc radius must be positive' };
    }

    // Check if intersection point is on the arc's circle
    const distanceFromCenter = pointDistance(intersectionPoint, arc.center);
    const radiusTolerance = Math.max(
        tolerance,
        arc.radius * HIGH_PRECISION_TOLERANCE
    );

    if (Math.abs(distanceFromCenter - arc.radius) > radiusTolerance) {
        return {
            isValid: false,
            error: 'Intersection point is not on arc circle',
        };
    }

    return { isValid: true, error: '' };
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
