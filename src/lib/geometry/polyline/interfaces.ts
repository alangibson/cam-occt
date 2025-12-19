import type { Point2D } from '$lib/geometry/point/interfaces';

/**
 * Represents a polyline as an ordered collection of points
 */
export interface Polyline {
    points: Point2D[];
}
