import { isPointInPolygon as isPointInPolygonShared } from '$lib/geometry/polygon/functions';

/**
 * Geometric containment constants
 */
export const GEOMETRIC_CONTAINMENT_AREA_RATIO_THRESHOLD = 0.2;
export const MAX_CONTAINMENT_NESTING_LEVEL = 100;
export const BOUNDING_BOX_CONTAINMENT_MARGIN = 10;
/**
 * JSTS library coordinate validation - minimum required coordinates
 */

export const JSTS_MIN_LINEAR_RING_COORDINATES = 4;
/**
 * Rounded rectangle shape count (4 shapes: line, arc, line, arc)
 */
export const ROUNDED_RECTANGLE_SHAPE_COUNT = 4;
/**
 * Classic point-in-polygon test using ray casting algorithm
 * Re-exported from polygon-geometry-shared for backward compatibility
 */

export const isPointInPolygon = isPointInPolygonShared;
