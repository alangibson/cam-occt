import type { Point2D } from '$lib/types/geometry';

export interface Arc {
    center: Point2D;
    radius: number;
    startAngle: number;
    endAngle: number;
    clockwise: boolean;
}
