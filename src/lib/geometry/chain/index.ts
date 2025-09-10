/**
 * Chain and polygon geometry module
 *
 * This module provides functionality for working with chains (connected sequences of shapes)
 * and polygons, including winding direction calculations, area computations, and chain manipulation.
 */

// Re-export constants
export { POLYGON_POINTS_MIN, CHAIN_CLOSURE_TOLERANCE } from './constants';

// Re-export enums
export { WindingDirection } from './enums';

// Re-export functions
export {
    reverseChain,
    calculateSignedArea,
    calculatePolygonArea,
    getWindingDirection,
    isClockwise,
    isCounterClockwise,
    reverseWinding,
    ensureClockwise,
    ensureCounterClockwise,
    calculatePolygonCentroid,
    isSimplePolygon,
    calculatePolygonPerimeter,
} from './functions';
