/**
 * Number of quadrants in a quarter circle for arc/lead calculations
 */
export const QUARTER_CIRCLE_QUADRANTS = 4;

/**
 * Number of decimal places for coordinate precision in chain normalization
 */
export const PRECISION_DECIMAL_PLACES = 6;

/**
 * Number of sides in an octagon for geometric calculations
 */
export const OCTAGON_SIDES = 8;

/**
 * Default number of segments for tessellating curves into line segments
 */
export const DEFAULT_TESSELLATION_SEGMENTS = 16;

/**
 * Higher quality tessellation segment count for detailed curve approximation
 */
export const HIGH_TESSELLATION_SEGMENTS = 32;

// SPLINE_SAMPLE_COUNT moved to geometry/spline module

/**
 * Standard return value for array search operations when element not found
 */
export const DEFAULT_ARRAY_NOT_FOUND_INDEX = -1;

/**
 * Multiplier for relaxing tolerance in intersection and trimming operations
 */
export const TOLERANCE_RELAXATION_MULTIPLIER = 3;

/**
 * Small angle increment in degrees for iterative angular calculations
 */
export const SMALL_ANGLE_INCREMENT_DEG = 5;

/**
 * Numeric representation for counterclockwise direction in arc calculations
 */
export const DIRECTION_COUNTERCLOCKWISE = 1;

/**
 * Numeric representation for clockwise direction in arc calculations
 */
export const DIRECTION_CLOCKWISE = -1;

/**
 * Tolerance for area-based containment calculations
 */
export const CONTAINMENT_AREA_TOLERANCE = 0.001;

/**
 * Default origin cross size for canvas background rendering (mm)
 */
export const DEFAULT_ORIGIN_CROSS_SIZE_MM = 10;
/**
 * Parametric t value for midpoint (0.5)
 */
export const MIDPOINT_T = 0.5;

// DEFAULT_RETRY_COUNT moved to geometry/spline module
