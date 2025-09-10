import type { Point2D, Shape } from '$lib/types/geometry';

export interface PolylineVertex extends Point2D {
    bulge?: number;
}

export interface Polyline {
    closed: boolean;
    shapes: Shape[]; // Primary structured representation using Shape objects containing Line and Arc geometries
}
