import type { Point2D } from '$lib/geometry/point';

export interface BoundingBox {
    min: Point2D;
    max: Point2D;
}
