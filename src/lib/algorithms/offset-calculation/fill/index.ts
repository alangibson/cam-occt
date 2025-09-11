import type { Point2D, Shape } from '$lib/types/geometry';
import { GeometryType } from '$lib/types/geometry';
import type {
    FillOptions,
    FillResult,
    FillStrategy,
    GapContext,
    ShapeExtension,
} from './types';
import { MAX_EXTENSION } from '$lib/algorithms/constants';
import { findShapeIntersections } from '../intersect';
import { pointDistance } from '../trim';
import {
    CONFIDENCE_THRESHOLD,
    HIGH_PRECISION_TOLERANCE,
    TOLERANCE_SNAP_MULTIPLIER,
} from '../../../geometry/constants';
import { fillLineToIntersection } from './line';
import { fillArcToIntersection } from './arc';
import { fillCircleToIntersection } from './circle';
import { fillPolylineToIntersection } from './polyline';
import { fillSplineToIntersection } from './spline';
import { fillEllipseToIntersection } from './ellipse';
import type { IntersectionResult } from '../chain/types';

/**
 * Fill Module - Main Entry Point
 *
 * This module provides the main API for filling gaps between offset shapes
 * by extending them to their intersection points. This eliminates visible
 * gaps in chain offsets and ensures continuity.
 */

const DEFAULT_FILL_OPTIONS: FillOptions = {
    maxExtension: MAX_EXTENSION,
    tolerance: HIGH_PRECISION_TOLERANCE,
    extendDirection: 'auto',
};

/**
 * Fill the gap between two consecutive shapes by extending them to their intersection
 *
 * @param context - Information about the gap and shapes
 * @param options - Fill operation options
 * @returns Result containing extended shapes or error information
 */
export function fillGapBetweenShapes(
    context: GapContext,
    options: FillOptions = DEFAULT_FILL_OPTIONS
): { shape1Result: FillResult; shape2Result: FillResult } {
    const results: { shape1Result: FillResult; shape2Result: FillResult } = {
        shape1Result: createFailureResult('Shape extension not attempted'),
        shape2Result: createFailureResult('Shape extension not attempted'),
    };

    try {
        // Step 1: Validate input
        const validation: { valid: boolean; error?: string } =
            validateGapContext(context, options);
        if (!validation.valid) {
            results.shape1Result = createFailureResult(
                `Validation failed: ${validation.error}`
            );
            results.shape2Result = createFailureResult(
                `Validation failed: ${validation.error}`
            );
            return results;
        }

        // Step 2: Determine fill strategy
        const strategy: FillStrategy = determineFillStrategy(context, options);

        // Step 3: Find intersection with extended shapes
        const intersection: Point2D | null = findExtendedIntersection(
            context,
            options
        );
        if (!intersection) {
            results.shape1Result = createFailureResult(
                'No intersection found with extended shapes'
            );
            results.shape2Result = createFailureResult(
                'No intersection found with extended shapes'
            );
            return results;
        }

        // Step 4: Apply the selected strategy
        switch (strategy) {
            case 'extend-first':
                results.shape1Result = extendShapeToPoint(
                    context.shape1,
                    intersection,
                    options
                );
                results.shape2Result = createSuccessResult(
                    context.shape2,
                    null,
                    intersection
                );
                break;

            case 'extend-second':
                results.shape1Result = createSuccessResult(
                    context.shape1,
                    null,
                    intersection
                );
                results.shape2Result = extendShapeToPoint(
                    context.shape2,
                    intersection,
                    options
                );
                break;

            case 'extend-both':
                results.shape1Result = extendShapeToPoint(
                    context.shape1,
                    intersection,
                    options
                );
                results.shape2Result = extendShapeToPoint(
                    context.shape2,
                    intersection,
                    options
                );
                break;

            case 'snap-endpoints':
                // For now, treat as extend-both
                results.shape1Result = extendShapeToPoint(
                    context.shape1,
                    intersection,
                    options
                );
                results.shape2Result = extendShapeToPoint(
                    context.shape2,
                    intersection,
                    options
                );
                break;

            default:
                results.shape1Result = createFailureResult(
                    `Unsupported fill strategy: ${strategy}`
                );
                results.shape2Result = createFailureResult(
                    `Unsupported fill strategy: ${strategy}`
                );
        }
    } catch (error) {
        const errorMsg: string =
            error instanceof Error ? (error as Error).message : String(error);
        results.shape1Result = createFailureResult(
            `Fill operation failed: ${errorMsg}`
        );
        results.shape2Result = createFailureResult(
            `Fill operation failed: ${errorMsg}`
        );
    }

    return results;
}

/**
 * Extend a shape to reach a specific intersection point
 */
function extendShapeToPoint(
    shape: Shape,
    intersectionPoint: Point2D,
    options: FillOptions
): FillResult {
    switch (shape.type) {
        case GeometryType.LINE:
            return fillLineToIntersection(shape, intersectionPoint, options);
        case GeometryType.ARC:
            return fillArcToIntersection(shape, intersectionPoint, options);
        case GeometryType.CIRCLE:
            return fillCircleToIntersection(shape, intersectionPoint, options);
        case GeometryType.POLYLINE:
            return fillPolylineToIntersection(
                shape,
                intersectionPoint,
                options
            );
        case GeometryType.SPLINE:
            return fillSplineToIntersection(shape, intersectionPoint, options);
        case GeometryType.ELLIPSE:
            return fillEllipseToIntersection(shape, intersectionPoint, options);
        default:
            return createFailureResult(
                `Unsupported shape type for extension: ${shape.type}`
            );
    }
}

/**
 * Find intersection point between extended versions of both shapes
 */
function findExtendedIntersection(
    context: GapContext,
    options: FillOptions
): Point2D | null {
    try {
        // Use the existing intersection system with extensions enabled
        const intersections: IntersectionResult[] = findShapeIntersections(
            context.shape1,
            context.shape2,
            options.tolerance,
            true, // allow extensions
            options.maxExtension
        );

        if (intersections.length === 0) {
            return null;
        }

        // If preferred intersection is specified, find closest match
        if (options.preferredIntersection) {
            let bestIntersection: IntersectionResult = intersections[0];
            let bestDistance: number = pointDistance(
                intersections[0].point,
                options.preferredIntersection
            );

            for (let i: number = 1; i < intersections.length; i++) {
                const distance: number = pointDistance(
                    intersections[i].point,
                    options.preferredIntersection
                );
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestIntersection = intersections[i];
                }
            }

            return bestIntersection.point;
        }

        // Use the first high-confidence intersection
        const highConfidenceIntersections: IntersectionResult[] =
            intersections.filter((i) => i.confidence > CONFIDENCE_THRESHOLD);
        if (highConfidenceIntersections.length > 0) {
            return highConfidenceIntersections[0].point;
        }

        // Fall back to first intersection
        return intersections[0].point;
    } catch {
        return null;
    }
}

/**
 * Determine the best strategy for filling the gap
 */
function determineFillStrategy(
    context: GapContext,
    options: FillOptions
): FillStrategy {
    const { gapSize } = context;

    // For very small gaps, snap endpoints
    if (gapSize < options.tolerance * TOLERANCE_SNAP_MULTIPLIER) {
        return 'snap-endpoints';
    }

    // For medium gaps, extend both shapes to intersection
    if (gapSize < options.maxExtension) {
        return 'extend-both';
    }

    // For large gaps, this might not be fillable
    return 'extend-both'; // Try anyway
}

/**
 * Validate gap context and options
 */
function validateGapContext(
    context: GapContext,
    options: FillOptions
): { valid: boolean; error?: string } {
    if (!context.shape1 || !context.shape2) {
        return { valid: false, error: 'Both shapes must be provided' };
    }

    if (context.gapSize < 0) {
        return { valid: false, error: 'Gap size cannot be negative' };
    }

    if (options.maxExtension <= 0) {
        return { valid: false, error: 'Maximum extension must be positive' };
    }

    return { valid: true };
}

/**
 * Create a successful fill result
 */
function createSuccessResult(
    originalShape: Shape,
    extension: ShapeExtension | null,
    intersectionPoint: Point2D
): FillResult {
    const result: FillResult = {
        success: true,
        extendedShape: originalShape,
        intersectionPoint,
        warnings: [],
        errors: [],
        confidence: 1.0,
    };

    // Only add extension if it's not null
    if (extension) {
        result.extension = extension;
    }

    return result;
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

// All shape-specific fill functions are now implemented and imported above
