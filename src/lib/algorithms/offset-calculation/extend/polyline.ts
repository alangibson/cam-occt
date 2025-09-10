import type { Point2D, Shape } from '../../../types/geometry';
import type { Polyline } from '$lib/geometry/polyline';
import { EPSILON, MAX_EXTENSION } from '../../../constants';
import { pointDistance } from '../trim';
import {
    polylineToPoints,
    createPolylineFromVertices,
} from '$lib/geometry/polyline';

/**
 * Polyline Extension Module
 *
 * This module provides comprehensive polyline extension functionality including:
 * - Simple bilateral extension (original functionality)
 * - Intelligent directional extension
 * - Extension to specific target points
 * - Extension parameter calculation
 */

/**
 * Extension direction options for polylines
 */
export type PolylineExtensionDirection = 'start' | 'end' | 'auto';

/**
 * Extension options for polyline operations
 */
export interface PolylineExtensionOptions {
    /** Maximum distance to extend */
    maxExtension?: number;
    /** Geometric tolerance */
    tolerance?: number;
    /** Which end to extend */
    direction?: PolylineExtensionDirection;
}

/**
 * Result of polyline extension calculation
 */
export interface PolylineExtensionResult {
    /** Whether the extension calculation succeeded */
    success: boolean;
    /** Distance of extension */
    extensionDistance: number;
    /** Direction of extension */
    direction: 'start' | 'end';
    /** Error message if failed */
    error?: string;
}

/**
 * Create an extended polyline by extending the first and last segments
 * (Original simple extension function)
 */
export function createExtendedPolyline(
    polyline: Polyline,
    extendStart: boolean,
    extendEnd: boolean,
    extensionLength: number
): Polyline {
    const points: Point2D[] = polylineToPoints(polyline);

    if (points.length < 2) {
        return polyline; // Cannot extend a polyline with less than 2 points
    }

    const extendedPoints: Point2D[] = [...points];

    // Extend the start (first segment)
    if (extendStart) {
        const firstPoint: Point2D = points[0];
        const secondPoint: Point2D = points[1];

        // Calculate direction from second to first point
        const dx: number = firstPoint.x - secondPoint.x;
        const dy: number = firstPoint.y - secondPoint.y;
        const length: number = Math.sqrt(dx * dx + dy * dy);

        if (length > EPSILON) {
            const unitX: number = dx / length;
            const unitY: number = dy / length;

            // Add extended point before the first point
            const extendedStartPoint: Point2D = {
                x: firstPoint.x + unitX * extensionLength,
                y: firstPoint.y + unitY * extensionLength,
            };

            extendedPoints.unshift(extendedStartPoint);
        }
    }

    // Extend the end (last segment)
    if (extendEnd && !polyline.closed) {
        const lastPoint: Point2D = points[points.length - 1];
        const secondLastPoint: Point2D = points[points.length - 2];

        // Calculate direction from second-last to last point
        const dx: number = lastPoint.x - secondLastPoint.x;
        const dy: number = lastPoint.y - secondLastPoint.y;
        const length: number = Math.sqrt(dx * dx + dy * dy);

        if (length > EPSILON) {
            const unitX: number = dx / length;
            const unitY: number = dy / length;

            // Add extended point after the last point
            const extendedEndPoint: Point2D = {
                x: lastPoint.x + unitX * extensionLength,
                y: lastPoint.y + unitY * extensionLength,
            };

            extendedPoints.push(extendedEndPoint);
        }
    }

    // Create a new polyline shape with extended points
    const extendedShape: Shape = createPolylineFromVertices(
        extendedPoints,
        false
    );
    return extendedShape.geometry as Polyline;
}

/**
 * Extend a polyline to reach a specific intersection point
 *
 * @param polyline - The polyline to extend
 * @param intersectionPoint - Target point to extend to
 * @param options - Extension options
 * @returns Extended polyline or null if extension failed
 */
export function extendPolylineToPoint(
    polyline: Polyline,
    intersectionPoint: Point2D,
    options: PolylineExtensionOptions = {}
): Polyline | null {
    const defaultOptions: Required<PolylineExtensionOptions> = {
        maxExtension: MAX_EXTENSION,
        tolerance: 1e-6,
        direction: 'auto' as PolylineExtensionDirection,
    };
    const opts: Required<PolylineExtensionOptions> = {
        ...defaultOptions,
        ...options,
    };

    try {
        // Step 1: Validate polyline geometry
        const polylinePoints: Point2D[] = polylineToPoints(polyline);
        if (!polylinePoints || polylinePoints.length < 2) {
            return null;
        }

        // Step 2: Determine which end to extend
        const extendDirection: 'start' | 'end' | null =
            determinePolylineExtensionDirection(
                polyline,
                intersectionPoint,
                opts
            );
        if (!extendDirection) {
            return null;
        }

        // Step 3: Calculate extension parameters
        const extensionInfo: PolylineExtensionResult =
            calculatePolylineExtension(
                polyline,
                intersectionPoint,
                extendDirection,
                opts
            );
        if (!extensionInfo.success) {
            return null;
        }

        // Step 4: Validate extension distance
        if (extensionInfo.extensionDistance > opts.maxExtension!) {
            return null;
        }

        // Step 5: Create extended polyline
        return createExtendedPolylineToPoint(
            polyline,
            intersectionPoint,
            extendDirection,
            extensionInfo
        );
    } catch {
        return null;
    }
}

/**
 * Determine which end of the polyline should be extended
 */
export function determinePolylineExtensionDirection(
    polyline: Polyline,
    intersectionPoint: Point2D,
    options: PolylineExtensionOptions
): 'start' | 'end' | null {
    if (options.direction === 'start' || options.direction === 'end') {
        return options.direction;
    }

    // Auto mode: extend the end that's closer to the intersection point
    const polylinePoints: Point2D[] = polylineToPoints(polyline);
    const startPoint: Point2D = polylinePoints[0];
    const endPoint: Point2D = polylinePoints[polylinePoints.length - 1];

    const distToStart: number = pointDistance(startPoint, intersectionPoint);
    const distToEnd: number = pointDistance(endPoint, intersectionPoint);

    // Also consider if the intersection point is along the polyline's projection
    // Check if intersection is beyond the start or end of the polyline
    const isBeforeStart: boolean = isPointBeforePolylineStart(
        polyline,
        intersectionPoint
    );
    const isAfterEnd: boolean = isPointAfterPolylineEnd(
        polyline,
        intersectionPoint
    );

    if (isBeforeStart && !isAfterEnd) {
        return 'start';
    } else if (isAfterEnd && !isBeforeStart) {
        return 'end';
    } else {
        // Neither clearly before start nor after end, use distance
        return distToStart < distToEnd ? 'start' : 'end';
    }
}

/**
 * Check if a point is before the start of the polyline (in the direction of the first segment)
 */
export function isPointBeforePolylineStart(
    polyline: Polyline,
    point: Point2D
): boolean {
    const polylinePoints: Point2D[] = polylineToPoints(polyline);
    if (polylinePoints.length < 2) return false;

    const firstPoint: Point2D = polylinePoints[0];
    const secondPoint: Point2D = polylinePoints[1];

    // Create a line from the first segment and check if point projects before start
    const segmentDir: { x: number; y: number } = {
        x: secondPoint.x - firstPoint.x,
        y: secondPoint.y - firstPoint.y,
    };

    const toPoint: { x: number; y: number } = {
        x: point.x - firstPoint.x,
        y: point.y - firstPoint.y,
    };

    const projectionParam: number =
        (toPoint.x * segmentDir.x + toPoint.y * segmentDir.y) /
        (segmentDir.x * segmentDir.x + segmentDir.y * segmentDir.y);

    return projectionParam < 0;
}

/**
 * Check if a point is after the end of the polyline (in the direction of the last segment)
 */
export function isPointAfterPolylineEnd(
    polyline: Polyline,
    point: Point2D
): boolean {
    const polylinePoints: Point2D[] = polylineToPoints(polyline);
    if (polylinePoints.length < 2) return false;

    const lastPoint: Point2D = polylinePoints[polylinePoints.length - 1];
    const secondLastPoint: Point2D = polylinePoints[polylinePoints.length - 2];

    // Create a line from the last segment and check if point projects after end
    const segmentDir: Point2D = {
        x: lastPoint.x - secondLastPoint.x,
        y: lastPoint.y - secondLastPoint.y,
    };

    const toPoint: { x: number; y: number } = {
        x: point.x - lastPoint.x,
        y: point.y - lastPoint.y,
    };

    const projectionParam: number =
        (toPoint.x * segmentDir.x + toPoint.y * segmentDir.y) /
        (segmentDir.x * segmentDir.x + segmentDir.y * segmentDir.y);

    return projectionParam > 0;
}

/**
 * Calculate polyline extension parameters
 */
export function calculatePolylineExtension(
    polyline: Polyline,
    intersectionPoint: Point2D,
    direction: 'start' | 'end',
    _options: PolylineExtensionOptions
): PolylineExtensionResult {
    const polylinePoints: Point2D[] = polylineToPoints(polyline);

    if (direction === 'start') {
        // Extension from start
        const firstPoint: Point2D = polylinePoints[0];
        const extensionDistance: number = pointDistance(
            firstPoint,
            intersectionPoint
        );

        return { success: true, extensionDistance, direction };
    } else {
        // Extension from end
        const lastPoint: Point2D = polylinePoints[polylinePoints.length - 1];
        const extensionDistance: number = pointDistance(
            lastPoint,
            intersectionPoint
        );

        return { success: true, extensionDistance, direction };
    }
}

/**
 * Create the extended polyline geometry to reach a specific point
 */
function createExtendedPolylineToPoint(
    originalPolyline: Polyline,
    intersectionPoint: Point2D,
    direction: 'start' | 'end',
    _extensionInfo: PolylineExtensionResult
): Polyline {
    const originalPoints: Point2D[] = polylineToPoints(originalPolyline);

    if (direction === 'start') {
        // Add intersection point at the beginning
        const newPoints: Point2D[] = [intersectionPoint, ...originalPoints];
        const extendedShape: Shape = createPolylineFromVertices(
            newPoints,
            originalPolyline.closed
        );
        return extendedShape.geometry as Polyline;
    } else {
        // Add intersection point at the end
        const newPoints: Point2D[] = [...originalPoints, intersectionPoint];
        const extendedShape: Shape = createPolylineFromVertices(
            newPoints,
            originalPolyline.closed
        );
        return extendedShape.geometry as Polyline;
    }
}
