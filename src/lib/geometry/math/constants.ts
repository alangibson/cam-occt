/**
 * Mathematical constants used throughout the application
 */

/**
 * Small epsilon value for floating point comparisons.
 * Two numbers with difference <= EPSILON are considered equal.
 */
export const EPSILON: number = 1e-10;

/**
 * Machining tolerance
 * TODO this is actually a property of the machine, so it should not be constant.
 */
export const MACHINE_TOLERANCE: number = 0.05;

/**
 * Intersection tolerance for precise geometric intersections and
 * mathematical operations
 */
export const INTERSECTION_TOLERANCE: number = 1e-6;

/**
 * Standard tessellation count for smooth curves
 */
export const STANDARD_TESSELLATION_COUNT: number = 20;
