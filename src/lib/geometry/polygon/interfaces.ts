import type { Point2D } from '$lib/geometry/point/interfaces';

/**
 * Represents a polygon as an ordered collection of points
 */
export interface Polygon {
    points: Point2D[];
}
