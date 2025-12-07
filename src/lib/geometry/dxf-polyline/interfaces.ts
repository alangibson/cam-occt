import type { Point2D } from '$lib/geometry/point/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';

export interface DxfPolylineVertex extends Point2D {
    bulge?: number;
}

export interface DxfPolyline {
    closed: boolean;
    shapes: ShapeData[]; // Primary structured representation using Shape objects containing Line and Arc geometries
}
