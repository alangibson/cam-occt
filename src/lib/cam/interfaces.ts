import type { BoundingBoxData } from '$lib/geometry/bounding-box/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Polyline } from '$lib/geometry/polyline/interfaces';

export interface Geometric {
    tessellated: Polyline;
    startPoint: Point2D;
    endPoint: Point2D;
    midPoint: Point2D;
    tangent: Point2D;
    normal: Point2D;
    boundary: BoundingBoxData;
    pointAt(t: number): Point2D;
}
