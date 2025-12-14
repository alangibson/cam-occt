/**
 * Algorithm version for kerf generation
 * Increment when algorithm changes to invalidate old cached kerfs
 */
export const KERF_VERSION = '1.0.0';

/**
 * Default tolerance for chain closure detection
 */
export const DEFAULT_TOLERANCE = 0.001;

/**
 * Tolerance for validating chain closure (stricter than DEFAULT_TOLERANCE)
 */
export const CLOSURE_VALIDATION_TOLERANCE = 0.01;

/**
 * Number of decimal places for displaying coordinates in error messages
 */
export const DECIMAL_PLACES = 3;

/**
 * Default step size for adjusting cut start point (10% increments)
 */
export const DEFAULT_STEP_SIZE = 0.1;

/**
 * Default maximum number of attempts when adjusting cut start point
 */
export const DEFAULT_MAX_ATTEMPTS = 10;

export const CIRCLE_POINTS = 32;

export const DECIMAL_PRECISION = 3;
