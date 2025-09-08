import type { Arc, Point2D } from '../types/geometry';
import {
    determineArcExtensionDirection as _determineArcExtensionDirection,
    type ArcExtensionOptions,
} from './offset-calculation/extend/arc';
import type { FillOptions } from './offset-calculation/fill/types';

/**
 * Arc Operations Utilities Library
 *
 * This module consolidates common arc operation functions that were duplicated
 * across the offset calculation modules. It provides utilities for:
 * - Intersection angle calculations
 * - Arc extension direction determination
 * - Arc extension validation
 */

/**
 * Extension direction options for arcs
 */
export type ExtensionDirection = 'start' | 'end' | 'both' | 'auto';

/**
 * Extension options for arc operations
 */
export interface ExtensionOptions {
    /** Maximum distance to extend */
    maxExtension?: number;
    /** Geometric tolerance */
    tolerance?: number;
    /** Which end to extend */
    direction?: ExtensionDirection;
}

/**
 * Calculate the intersection angle for a point on an arc
 *
 * This function calculates the angle from the arc's center to the intersection point.
 * The angle is measured from the positive x-axis in radians.
 *
 * @param point - The intersection point on the arc
 * @param arc - The arc geometry
 * @returns The angle in radians from the arc center to the point
 */
export function calculateIntersectionAngle(point: Point2D, arc: Arc): number {
    return Math.atan2(point.y - arc.center.y, point.x - arc.center.x);
}

/**
 * Determine which end of the arc should be extended to reach an intersection angle
 *
 * This function analyzes the arc geometry and intersection angle to determine
 * the optimal extension direction based on the provided options.
 *
 * @param arc - The arc geometry
 * @param intersectionAngle - The target angle to extend to
 * @param options - Extension options including preferred direction
 * @returns The extension direction or null if extension is not possible
 */
export function determineArcExtensionDirection(
    arc: Arc,
    intersectionAngle: number,
    options: ExtensionOptions
): 'start' | 'end' | null {
    // Convert ExtensionOptions to ArcExtensionOptions
    const arcOptions: ArcExtensionOptions = {
        maxExtension: options.maxExtension,
        tolerance: options.tolerance,
        direction: options.direction,
    };

    // Delegate to the existing implementation
    return _determineArcExtensionDirection(arc, intersectionAngle, arcOptions);
}

/**
 * Create extension configuration for arc extension from FillOptions
 *
 * This function converts FillOptions to the appropriate parameters for
 * determineArcExtensionDirection, providing a convenient interface for
 * fill operations.
 *
 * @param arc - The arc geometry
 * @param intersectionAngle - The target angle to extend to
 * @param options - Fill options
 * @returns The extension direction or null if extension is not possible
 */
export function createArcExtensionConfig(
    arc: Arc,
    intersectionAngle: number,
    options: FillOptions
): 'start' | 'end' | null {
    return determineArcExtensionDirection(arc, intersectionAngle, {
        maxExtension: options.maxExtension,
        tolerance: options.tolerance,
        direction:
            options.extendDirection === 'start'
                ? 'start'
                : options.extendDirection === 'end'
                  ? 'end'
                  : 'auto',
    });
}

/**
 * Create ArcExtensionOptions from FillOptions
 *
 * This function converts FillOptions to ArcExtensionOptions for use with
 * the arc extension functions in the extend module.
 *
 * @param options - Fill options
 * @returns Arc extension options
 */
export function createArcExtensionOptions(
    options: FillOptions
): ArcExtensionOptions {
    return {
        maxExtension: options.maxExtension,
        tolerance: options.tolerance,
        direction:
            options.extendDirection === 'start'
                ? 'start'
                : options.extendDirection === 'end'
                  ? 'end'
                  : 'auto',
    };
}

/**
 * Validate arc extension direction parameters
 *
 * This function validates that the extension direction is valid for the given
 * arc and intersection parameters.
 *
 * @param direction - The proposed extension direction
 * @returns True if the extension direction is valid
 */
export function validateArcExtensionDirection(
    direction: ExtensionDirection
): boolean {
    const validDirections: ExtensionDirection[] = [
        'start',
        'end',
        'both',
        'auto',
    ];
    return validDirections.includes(direction);
}
