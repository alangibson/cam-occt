import type { Point2D } from '$lib/types/geometry';

export interface BoundingBox {
    min: Point2D;
    max: Point2D;
}
