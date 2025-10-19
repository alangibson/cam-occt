import type { Point2D } from '$lib/geometry/point/interfaces';

export interface Arc {
    center: Point2D;
    radius: number;
    startAngle: number;
    endAngle: number;
    clockwise: boolean;
}
