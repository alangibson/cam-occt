export enum GeometryType {
    LINE = 'line',
    ARC = 'arc',
    CIRCLE = 'circle',
    POLYLINE = 'polyline',
    SPLINE = 'spline',
    ELLIPSE = 'ellipse',
}

// Arc interface has been moved to geometry/arc module - import from $lib/geometry/arc
import type { Arc } from '$lib/geometry/arc';
// Circle interface has been moved to geometry/circle module - import from $lib/geometry/circle
import type { Circle } from '$lib/geometry/circle';
// Line interface has been moved to geometry/line module - import from $lib/geometry/line
import type { Line } from '$lib/geometry/line';

// Re-export for backwards compatibility
export type { Arc, Circle, Line };

// Ellipse interface has been moved to geometry/ellipse module - import from $lib/geometry/ellipse
import type { Ellipse } from '$lib/geometry/ellipse/index';

// Re-export for backwards compatibility
export type { Ellipse };

export type Geometry = Arc | Line | Circle | Ellipse | Polyline | Spline;

export interface Point2D {
    x: number;
    y: number;
}

export interface Point3D extends Point2D {
    z: number;
}

export interface BoundingBox {
    min: Point2D;
    max: Point2D;
}

export interface PolylineVertex extends Point2D {
    bulge?: number;
}

export interface Polyline {
    closed: boolean;
    shapes: Shape[]; // Primary structured representation using Shape objects containing Line and Arc geometries
}

export interface Spline {
    controlPoints: Point2D[];
    knots: number[];
    weights: number[];
    degree: number;
    fitPoints: Point2D[];
    closed: boolean;
}

export interface Shape {
    id: string;
    type: GeometryType;
    geometry: Line | Arc | Circle | Polyline | Ellipse | Spline;
    layer?: string;
    originalType?: string; // Track original DXF entity type for converted shapes
    metadata?: Record<string, unknown>; // Metadata for additional shape information (e.g., originalLayer)
}

export interface Layer {
    shapes: Shape[];
    name?: string;
    visible?: boolean;
    color?: string;
}

import { Unit } from '../utils/units';

export interface Drawing {
    shapes: Shape[];
    bounds: BoundingBox;
    units: Unit;
    layers?: Record<string, Layer>; // Optional layer-based shape organization
}
