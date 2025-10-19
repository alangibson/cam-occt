import type { Point2D } from '$lib/geometry/point/interfaces';

export interface BoundingBox {
    min: Point2D;
    max: Point2D;
}
