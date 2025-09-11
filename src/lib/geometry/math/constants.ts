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
export const TOLERANCE: number = 0.05;

/**
 * Intersection tolerance for precise geometric intersections and mathematical operations
 */
export const INTERSECTION_TOLERANCE: number = 1e-6;

/**
 * Geometric precision tolerance for shape matching and distance calculations
 */
export const GEOMETRIC_PRECISION_TOLERANCE: number = 0.001;

/**
 * Standard tessellation count for smooth curves
 */
export const STANDARD_TESSELLATION_COUNT: number = 20;

/**
 * Half percentage value for ratios and fractions
 */
export const HALF_PERCENT: number = 0.5;

/**
 * Three quarters percentage value for ratios and fractions
 */
export const THREE_QUARTERS_PERCENT: number = 0.75;

/**
 * Quarter percentage value for ratios and fractions
 */
export const QUARTER_PERCENT: number = 0.25;
