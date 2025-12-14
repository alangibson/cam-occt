import type { BoundingBoxData } from '$lib/geometry/bounding-box/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';

export interface Geometric {
    tessellated: Point2D[];
    startPoint: Point2D;
    endPoint: Point2D;
    midPoint: Point2D;
    tangent: Point2D;
    normal: Point2D;
    boundary: BoundingBoxData;
    pointAt(t: number): Point2D;
}
