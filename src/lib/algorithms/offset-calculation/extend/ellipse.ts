import type { Point2D } from '../../../types/geometry';
import type { OperationParams } from '../shared/fill-extend-ops';
import { MAX_EXTENSION } from '../../../constants';
import {
    processEllipseOperation,
    validateEllipseIntersectionPoint,
    calculateEllipseAngle,
    determineEllipseExtension,
    createEllipticalArcFromEllipse,
    getEllipsePoint,
} from '../shared/fill-extend-ops';

/**
 * Ellipse Extension Module
 *
 * This module provides ellipse extension functionality by converting ellipses to
 * elliptical arcs with expanded angular coverage. Since ellipses are closed shapes,
 * extension creates an elliptical arc that reaches the target intersection point.
 */

/**
 * Extension direction options for ellipses
 */
export type EllipseExtensionDirection = 'start' | 'end' | 'auto';

/**
 * Extension options for ellipse operations
 */
export interface EllipseExtensionOptions {
    /** Maximum distance to extend */
    maxExtension?: number;
    /** Geometric tolerance */
    tolerance?: number;
    /** Which end to extend */
    direction?: EllipseExtensionDirection;
}

/**
 * Operation options type (internal use for default options)
 */
interface OperationOptions {
    maxExtension: number;
    tolerance: number;
    direction: EllipseExtensionDirection;
}

/**
 * Ellipse geometry (simplified)
 */
export interface EllipseGeometry {
    center: Point2D;
    radiusX: number;
    radiusY: number;
    rotation?: number;
}

/**
 * Elliptical arc geometry (result of ellipse extension)
 */
export interface EllipticalArcGeometry extends EllipseGeometry {
    startAngle: number;
    endAngle: number;
    clockwise: boolean;
}

/**
 * Result of ellipse extension calculation
 */
export interface EllipseExtensionResult {
    /** Whether the extension calculation succeeded */
    success: boolean;
    /** Angular extension in radians */
    angularExtension: number;
    /** Direction of extension */
    direction: 'start' | 'end';
    /** Original start angle for the arc */
    originalStartAngle: number;
    /** Error message if failed */
    error?: string;
}

/**
 * Extend an ellipse to reach a specific intersection point
 *
 * @param ellipse - The ellipse geometry to extend
 * @param intersectionPoint - Target point to extend to
 * @param options - Extension options
 * @returns Extended elliptical arc or null if extension failed
 */
export function extendEllipseToPoint(
    ellipse: EllipseGeometry,
    intersectionPoint: Point2D,
    options: EllipseExtensionOptions = {}
): EllipticalArcGeometry | null {
    const defaultOptions: OperationOptions = {
        maxExtension: MAX_EXTENSION,
        tolerance: 1e-6,
        direction: 'auto' as EllipseExtensionDirection,
    };
    const opts = { ...defaultOptions, ...options };

    // Convert to OperationParams for shared library
    const params: OperationParams = {
        tolerance: opts.tolerance!,
        maxExtension: opts.maxExtension!,
        extendDirection: opts.direction,
    };

    try {
        // Use shared processing logic
        const result = processEllipseOperation(
            ellipse,
            intersectionPoint,
            'extend',
            params
        );

        if (!result.success) {
            return null;
        }

        return result.resultGeometry as EllipticalArcGeometry;
    } catch {
        return null;
    }
}

/**
 * Check if a point is on the ellipse within tolerance
 */
export function isPointOnEllipse(
    point: Point2D,
    ellipse: EllipseGeometry,
    tolerance: number
): { onEllipse: boolean; distance: number } {
    const validation = validateEllipseIntersectionPoint(
        point,
        ellipse,
        tolerance
    );

    return {
        onEllipse: validation.isValid,
        distance: validation.distance || 0,
    };
}

// Re-export shared functions for backward compatibility
export {
    calculateEllipseAngle,
    determineEllipseExtension,
    createEllipticalArcFromEllipse,
    getEllipsePoint,
};
