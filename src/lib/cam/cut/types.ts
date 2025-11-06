import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Shape } from '$lib/geometry/shape/interfaces';

/**
 * Methods used for filling gaps between shapes
 */

type GapFillingMethod =
    | 'snap' // Endpoints snapped together (very small gaps)
    | 'extend' // Shape extended to meet (lines, arcs)
    | 'fillet' // Arc inserted to connect endpoints
    | 'line' // Straight line inserted
    | 'none'; // No fill needed

/**
 * Result of gap filling operation
 */
export interface GapFillingResult {
    /** Method used to fill the gap */
    method: GapFillingMethod;

    /** New shape created to fill the gap (if any) */
    fillerShape?: Shape;

    /** Shapes that were modified during gap filling */
    modifiedShapes: {
        original: Shape;
        modified: Shape;
    }[];

    /** Size of the gap that was filled */
    gapSize: number;

    /** Location of the gap */
    gapLocation: {
        shape1Index: number;
        shape2Index: number;
        point: Point2D;
    };
}
