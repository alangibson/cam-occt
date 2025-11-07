/**
 * Number of quadrants in a quarter circle for arc/lead calculations
 */
export const QUARTER_CIRCLE_QUADRANTS = 4;

/**
 * Numeric representation for counterclockwise direction in arc calculations
 */
export const DIRECTION_COUNTERCLOCKWISE = 1;

/**
 * Numeric representation for clockwise direction in arc calculations
 */
export const DIRECTION_CLOCKWISE = -1;

export const PERPENDICULAR_TOLERANCE = 0.01;

/**
 * Maximum tolerance ratio to prevent numerical issues with acos
 * When tolerance/radius approaches 1, acos(1 - ratio) approaches 0
 */
export const MAX_TOLERANCE_RATIO = 0.9999;
