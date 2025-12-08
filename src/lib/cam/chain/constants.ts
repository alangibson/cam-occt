/**
 * Chain and polygon-specific constants
 */

/**
 * Minimum number of points required to form a valid polygon
 */
export const POLYGON_POINTS_MIN = 3;

/**
 * Default tolerance for determining if chain endpoints form a closed loop.
 * This is the primary tolerance used for chain closure detection.
 */
export const CHAIN_CLOSURE_TOLERANCE = 0.01;

/**
 * Area ratio threshold for geometric containment fallback (5%)
 */
export const AREA_RATIO_THRESHOLD: number = 0.05;

// Minimum number of points required to define a circle
export const MIN_CIRCLE_POINTS = 3;

// Tolerance for matrix determinant in circle fitting
export const CIRCLE_FIT_EPSILON = 1e-10;

// Tolerance for checking if points lie on a circle (in drawing units)
// More relaxed than CONTAINMENT_AREA_TOLERANCE to account for numerical precision
export const CYCLIC_CHECK_TOLERANCE = 0.01;

export const CONTAINMENT_AREA_RATIO_THRESHOLD = 0.9;
