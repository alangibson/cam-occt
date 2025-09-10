/**
 * Minimum number of points required to form a valid polygon
 */
export const POLYGON_POINTS_MIN = 3;

/**
 * Minimum number of vertices required to define a line segment
 */
export const MIN_VERTICES_FOR_LINE = 2;

/**
 * Minimum number of control points required to create a valid spline
 */
export const MIN_CONTROL_POINTS_FOR_SPLINE = 2;

/**
 * Default degree for spline/NURBS curves (cubic splines)
 */
export const DEFAULT_SPLINE_DEGREE = 3;

/**
 * Minimum number of vertices required to define a polyline
 */
export const MIN_VERTICES_FOR_POLYLINE = 2;

/**
 * Angular measurement for 270 degrees in radians (3π/2) - bounding box calculations
 */
// eslint-disable-next-line no-magic-numbers
export const THREE_HALVES_PI = (3 * Math.PI) / 2;

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

/**
 * Number of sample points for spline tessellation and ray intersection
 */
export const SPLINE_SAMPLE_COUNT = 100;

/**
 * Standard return value for array search operations when element not found
 */
export const DEFAULT_ARRAY_NOT_FOUND_INDEX = -1;

/**
 * Multiplier for calculating tessellation samples based on shape complexity
 */
export const TESSELLATION_SAMPLE_MULTIPLIER = 3;

/**
 * Multiplier for relaxing tolerance in intersection and trimming operations
 */
export const TOLERANCE_RELAXATION_MULTIPLIER = 3;

/**
 * Small angle increment in degrees for iterative angular calculations
 */
export const SMALL_ANGLE_INCREMENT_DEG = 5;

/**
 * Very small tolerance for high-precision geometric operations
 */
export const MICRO_TOLERANCE = 1e-6;

/**
 * Numeric representation for counterclockwise direction in arc calculations
 */
export const DIRECTION_COUNTERCLOCKWISE = 1;

/**
 * Numeric representation for clockwise direction in arc calculations
 */
export const DIRECTION_CLOCKWISE = -1;

/**
 * Standard grid spacing for tessellation minimum samples and lead validation
 */
export const STANDARD_GRID_SPACING = 10;

/**
 * Default tolerance for determining if chain endpoints form a closed loop
 */
export const CHAIN_CLOSURE_TOLERANCE = 0.1;

// Common numerical constants
/**
 * Maximum iterations for iterative algorithms to prevent infinite loops
 */
export const MAX_ITERATIONS = 1000;
/**
 * High precision tolerance for geometric calculations
 */
export const HIGH_PRECISION_TOLERANCE = 1e-6;
/**
 * Confidence threshold for algorithm validation (80%)
 */
export const CONFIDENCE_THRESHOLD = 0.8;
/**
 * High confidence threshold for critical validations (95%)
 */
export const CONFIDENCE_HIGH_THRESHOLD = 0.95;
/**
 * Number of samples for validation testing
 */
export const VALIDATION_SAMPLE_COUNT = 50;
/**
 * Decimal precision for coordinate rounding
 */
export const DECIMAL_PRECISION = 6;

// Lead calculation constants
/**
 * Multiplier for calculating reachable distance in lead calculations
 */
export const LEAD_REACHABLE_DISTANCE_MULTIPLIER = 3;

// Offset calculation constants
/**
 * Tolerance for area-based containment calculations
 */
export const CONTAINMENT_AREA_TOLERANCE = 0.001;
/**
 * Multiplier for snapping tolerance in geometric operations
 */
export const TOLERANCE_SNAP_MULTIPLIER = 10;
/**
 * Multiplier for precision tolerance adjustments
 */
export const PRECISION_TOLERANCE_MULTIPLIER = 10;

// Algorithm switching thresholds

/**
 * Default extension length for shape intersection calculations
 */
export const DEFAULT_EXTENSION_LENGTH = 1000;

/**
 * Default retry count for intersection operations
 */
export const DEFAULT_RETRY_COUNT = 3;
