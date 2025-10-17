import type { Point2D } from '$lib/geometry/point';
import type { Shape } from '$lib/geometry/shape';

export interface PolylineVertex extends Point2D {
    bulge?: number;
}

export interface Polyline {
    closed: boolean;
    shapes: Shape[]; // Primary structured representation using Shape objects containing Line and Arc geometries
}
