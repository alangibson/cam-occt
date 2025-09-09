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
 * Chain closure tolerance for chain normalization and connectivity detection
 */
export const CHAIN_CLOSURE_TOLERANCE: number = 0.01;

/**
 * Duplicate filtering tolerance for removing nearly identical intersection points
 */
export const DUPLICATE_FILTERING_TOLERANCE: number = 0.01;

/**
 * Area ratio threshold for geometric containment fallback (5%)
 */
export const AREA_RATIO_THRESHOLD: number = 0.05;

/**
 * Maximum offset gap filling extension length
 */
export const MAX_EXTENSION: number = 20;

/**
 * High-resolution tessellation for ellipse rendering (points)
 */
export const ELLIPSE_TESSELLATION_POINTS: number = 64;

/**
 * Fine tessellation tolerance for spline rendering (pixels)
 */
export const SPLINE_TESSELLATION_TOLERANCE: number = 0.1;

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

/**
 * Common timeout value in milliseconds (1 second)
 */
export const STANDARD_TIMEOUT_MS: number = 1000;

/**
 * Extended timeout value in milliseconds (1 minute)
 */
export const EXTENDED_TIMEOUT_MS: number = 60000;

/**
 * Maximum iterations for convergence algorithms
 */
export const MAX_ITERATIONS: number = 50;

/**
 * Small angle increment for subdivision (degrees)
 */
export const SMALL_ANGLE_INCREMENT: number = 5;

/**
 * Standard grid spacing for layouts
 */
export const STANDARD_GRID_SPACING: number = 10;
