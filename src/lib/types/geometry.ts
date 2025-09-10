// GeometryType enum has been moved to geometry/shape module - import from $lib/geometry/shape
export { GeometryType } from '$lib/geometry/shape';

// Arc interface has been moved to geometry/arc module - import from $lib/geometry/arc
// Circle interface has been moved to geometry/circle module - import from $lib/geometry/circle
// Line interface has been moved to geometry/line module - import from $lib/geometry/line
// Ellipse interface has been moved to geometry/ellipse module - import from $lib/geometry/ellipse

// Re-export geometry types from their respective modules
export type { Arc } from '$lib/geometry/arc';
export type { Circle } from '$lib/geometry/circle';
export type { Line } from '$lib/geometry/line';
export type { Ellipse } from '$lib/geometry/ellipse';
export type { Polyline } from '$lib/geometry/polyline';

// Spline type will be imported directly from geometry/spline where needed
// to avoid circular dependency with Point2D

// Geometry type has been moved to geometry/shape module - import from $lib/geometry/shape

export interface Point2D {
    x: number;
    y: number;
}

export interface Point3D extends Point2D {
    z: number;
}

// BoundingBox interface has been moved to geometry/bounding-box module - import from $lib/geometry/bounding-box

// Polyline interfaces have been moved to geometry/polyline module - import from $lib/geometry/polyline
// Spline interface has been moved to geometry/spline module - import from $lib/geometry/spline

// Shape system interfaces have been moved to geometry/shape module - import from $lib/geometry/shape
export type { Shape, Layer, Drawing, Geometry } from '$lib/geometry/shape';
