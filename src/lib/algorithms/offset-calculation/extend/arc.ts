import type { Point2D } from '../../../types/geometry';
import type { Arc } from '$lib/geometry/arc';
import { MAX_EXTENSION } from '../../../constants';
import {
    HIGH_PRECISION_TOLERANCE,
    DECIMAL_PRECISION,
} from '../../../geometry/constants';
import { pointDistance } from '../shared/trim-extend-utils';
import {
    normalizeAngle,
    isAngleInArcRange,
} from '../../intersection-arc-utils';
import { calculateIntersectionAngle } from '../../arc-operations-utils';

/**
 * Arc Extension Module
 *
 * This module provides comprehensive arc extension functionality including:
 * - Simple bilateral extension (original functionality)
 * - Intelligent directional extension
 * - Extension to specific target points
 * - Angular extension calculation
 */

/**
 * Extension direction options for arcs
 */
export type ArcExtensionDirection = 'start' | 'end' | 'both' | 'auto';

/**
 * Extension options for arc operations
 */
export interface ArcExtensionOptions {
    /** Maximum distance to extend */
    maxExtension?: number;
    /** Geometric tolerance */
    tolerance?: number;
    /** Which end to extend */
    direction?: ArcExtensionDirection;
}

/**
 * Result of arc extension calculation
 */
export interface ArcExtensionResult {
    /** Whether the extension calculation succeeded */
    success: boolean;
    /** Angular extension in radians */
    angularExtension: number;
    /** Direction of extension */
    direction: 'start' | 'end';
    /** Error message if failed */
    error?: string;
}

/**
 * Create an extended arc by extending the start and end angles
 * (Original simple extension function)
 */
export function createExtendedArc(arc: Arc, extensionLength: number): Arc {
    const { center, radius, startAngle, endAngle, clockwise } = arc;

    // Calculate angular extension based on extension length and radius
    // extensionAngle = extensionLength / radius (in radians)
    const desiredExtensionAngle: number = extensionLength / radius;

    // Calculate current arc span and ensure total span never exceeds 2π (full circle)
    const currentSpan = Math.abs(endAngle - startAngle);
    const totalSpanAfterExtension = currentSpan + 2 * desiredExtensionAngle;

    let extensionAngle: number;
    if (totalSpanAfterExtension > 2 * Math.PI) {
        // Cap at full circle: total span = 2π, so extension per end = (2π - currentSpan) / 2
        extensionAngle = (2 * Math.PI - currentSpan) / 2;
    } else {
        // Use desired extension
        extensionAngle = desiredExtensionAngle;
    }

    let newStartAngle: number;
    let newEndAngle: number;

    if (clockwise) {
        // For clockwise arcs, extend start backward (counter-clockwise) and end forward (clockwise)
        newStartAngle = startAngle + extensionAngle; // extend start backward (against clockwise direction)
        newEndAngle = endAngle - extensionAngle; // extend end forward (along clockwise direction)
    } else {
        // For counter-clockwise arcs, extend start backward (clockwise) and end forward (counter-clockwise)
        newStartAngle = startAngle - extensionAngle; // extend start backward (against counter-clockwise direction)
        newEndAngle = endAngle + extensionAngle; // extend end forward (along counter-clockwise direction)
    }

    return {
        center: { ...center },
        radius,
        startAngle: newStartAngle,
        endAngle: newEndAngle,
        clockwise,
    };
}

/**
 * Extend an arc to reach a specific intersection point
 *
 * @param arc - The arc to extend
 * @param intersectionPoint - Target point to extend to
 * @param options - Extension options
 * @returns Extended arc or null if extension failed
 */
export function extendArcToPoint(
    arc: Arc,
    intersectionPoint: Point2D,
    options: ArcExtensionOptions = {}
): Arc | null {
    const defaultOptions: ArcExtensionOptions = {
        maxExtension: MAX_EXTENSION,
        tolerance: 1e-6,
        direction: 'auto' as ArcExtensionDirection,
    };
    const opts: ArcExtensionOptions = { ...defaultOptions, ...options };

    try {
        // Validate arc geometry
        if (arc.radius <= 0) {
            return null;
        }

        // Check if intersection point is on the arc's circle
        const distanceFromCenter: number = pointDistance(
            intersectionPoint,
            arc.center
        );
        const radiusTolerance: number = Math.max(
            opts.tolerance!,
            arc.radius * HIGH_PRECISION_TOLERANCE
        );

        if (Math.abs(distanceFromCenter - arc.radius) > radiusTolerance) {
            return null;
        }

        // Calculate angle of intersection point
        const intersectionAngle = calculateIntersectionAngle(
            intersectionPoint,
            arc
        );

        // Determine which end to extend
        const extendDirection: 'start' | 'end' | null =
            determineArcExtensionDirection(arc, intersectionAngle, opts);
        if (!extendDirection) {
            return null;
        }

        // Calculate extension parameters
        const extensionInfo: ArcExtensionResult = calculateArcExtension(
            arc,
            intersectionAngle,
            extendDirection
        );
        if (!extensionInfo.success) {
            return null;
        }

        // Validate extension amount
        const maxAngularExtension: number = opts.maxExtension! / arc.radius;
        if (extensionInfo.angularExtension > maxAngularExtension) {
            return null;
        }

        // Create extended arc
        return createExtendedArcToPoint(
            arc,
            intersectionAngle,
            extendDirection
        );
    } catch {
        return null;
    }
}

/**
 * Determine which end of the arc should be extended
 */
export function determineArcExtensionDirection(
    arc: Arc,
    intersectionAngle: number,
    options: ArcExtensionOptions
): 'start' | 'end' | null {
    if (options.direction === 'start' || options.direction === 'end') {
        return options.direction;
    }

    // Auto mode: determine based on angular position relative to arc
    const isAngleInArc: boolean = isAngleInArcRange(
        intersectionAngle,
        arc.startAngle,
        arc.endAngle,
        arc.clockwise
    );

    if (isAngleInArc) {
        // Intersection is within the arc - this shouldn't happen for gap filling
        // Choose the direction that requires less extension
        const startExtension: number = calculateAngularDistance(
            arc.startAngle,
            intersectionAngle,
            !arc.clockwise
        );
        const endExtension: number = calculateAngularDistance(
            intersectionAngle,
            arc.endAngle,
            arc.clockwise
        );

        return startExtension < endExtension ? 'start' : 'end';
    }

    // Intersection is outside the arc - determine which end can reach it
    // Calculate angular distances in the direction each end would extend
    const distanceFromStart: number = calculateAngularDistanceForExtension(
        arc,
        intersectionAngle,
        'start'
    );
    const distanceFromEnd: number = calculateAngularDistanceForExtension(
        arc,
        intersectionAngle,
        'end'
    );

    // Choose the direction that requires less extension
    if (distanceFromStart < distanceFromEnd) {
        return 'start';
    } else if (distanceFromEnd < distanceFromStart) {
        return 'end';
    }

    // If distances are equal, prefer extending end
    return 'end';
}

/**
 * Calculate angular distance to reach intersection point from a specific direction
 */
function calculateAngularDistanceForExtension(
    arc: Arc,
    intersectionAngle: number,
    direction: 'start' | 'end'
): number {
    if (direction === 'start') {
        // Extending start means going in the opposite direction of the arc
        if (arc.clockwise) {
            // For clockwise arcs, start extends counter-clockwise
            return calculateAngularDistance(
                arc.startAngle,
                intersectionAngle,
                false
            );
        } else {
            // For counter-clockwise arcs, start extends clockwise
            return calculateAngularDistance(
                arc.startAngle,
                intersectionAngle,
                true
            );
        }
    } else {
        // Extending end means going in the same direction as the arc
        if (arc.clockwise) {
            // For clockwise arcs, end extends clockwise
            return calculateAngularDistance(
                arc.endAngle,
                intersectionAngle,
                true
            );
        } else {
            // For counter-clockwise arcs, end extends counter-clockwise
            return calculateAngularDistance(
                arc.endAngle,
                intersectionAngle,
                false
            );
        }
    }
}

/**
 * Calculate arc extension parameters
 */
export function calculateArcExtension(
    arc: Arc,
    intersectionAngle: number,
    direction: 'start' | 'end'
): ArcExtensionResult {
    let angularExtension: number;

    if (direction === 'start') {
        // Extension from start - direct angular distance
        angularExtension = Math.abs(intersectionAngle - arc.startAngle);
    } else {
        // Extension from end - direct angular distance
        angularExtension = Math.abs(intersectionAngle - arc.endAngle);
    }

    // For very small extensions (high precision case), ensure we don't have wraparound issues
    if (angularExtension > Math.PI) {
        angularExtension = 2 * Math.PI - angularExtension;
    }

    // Ensure extension is positive and reasonable
    if (angularExtension < 0) {
        return {
            success: false,
            angularExtension: 0,
            direction,
            error: `Invalid angular extension: ${angularExtension.toFixed(DECIMAL_PRECISION)} radians`,
        };
    }

    return { success: true, angularExtension, direction };
}

/**
 * Create the extended arc geometry to reach a specific point
 */
function createExtendedArcToPoint(
    originalArc: Arc,
    intersectionAngle: number,
    direction: 'start' | 'end'
): Arc {
    if (direction === 'start') {
        // Extend start angle - the new start is at the intersection point
        return {
            ...originalArc,
            startAngle: intersectionAngle,
        };
    } else {
        // Extend end angle - the new end is at the intersection point
        return {
            ...originalArc,
            endAngle: intersectionAngle,
        };
    }
}

/**
 * Calculate angular distance between two angles in a specific direction
 */
export function calculateAngularDistance(
    fromAngle: number,
    toAngle: number,
    clockwise: boolean
): number {
    const normFrom = normalizeAngle(fromAngle);
    const normTo = normalizeAngle(toAngle);

    if (clockwise) {
        if (normTo <= normFrom) {
            return normFrom - normTo;
        } else {
            return 2 * Math.PI - (normTo - normFrom);
        }
    } else {
        if (normTo >= normFrom) {
            return normTo - normFrom;
        } else {
            return 2 * Math.PI - (normFrom - normTo);
        }
    }
}

/**
 * Get the endpoint of an arc at a specific angle
 */
export function getArcEndpoint(arc: Arc, angle: number): Point2D {
    return {
        x: arc.center.x + arc.radius * Math.cos(angle),
        y: arc.center.y + arc.radius * Math.sin(angle),
    };
}

/**
 * Check if an intersection point is on the extension of either arc
 * (Original function maintained for compatibility)
 */
export function isIntersectionOnArcExtension(
    param1: number,
    param2: number,
    originalArc1?: Arc,
    originalArc2?: Arc
): boolean {
    // If either parameter is outside [0, 1], it's on an extension
    // For arcs, parameters outside [0, 1] mean the point is outside the arc's angular range
    const onArc1Extension = originalArc1 && (param1 < 0 || param1 > 1);
    const onArc2Extension = originalArc2 && (param2 < 0 || param2 > 1);

    return Boolean(onArc1Extension || onArc2Extension);
}
