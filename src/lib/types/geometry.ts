export type GeometryType =
    | 'line'
    | 'arc'
    | 'circle'
    | 'polyline'
    | 'spline'
    | 'ellipse';

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

export interface Arc {
    center: Point2D;
    radius: number;
    startAngle: number;
    endAngle: number;
    clockwise: boolean;
}

export interface Line {
    start: Point2D;
    end: Point2D;
}

export interface Circle {
    center: Point2D;
    radius: number;
}

export interface PolylineVertex extends Point2D {
    bulge?: number;
}

export interface Polyline {
    closed: boolean;
    shapes: Shape[]; // Primary structured representation using Shape objects containing Line and Arc geometries
}

export interface Ellipse {
    center: Point2D;
    majorAxisEndpoint: Point2D; // Vector from center to end of major axis
    minorToMajorRatio: number; // Ratio of minor axis to major axis
    startParam?: number; // Start parameter for ellipse arcs (optional)
    endParam?: number; // End parameter for ellipse arcs (optional)
    // NOTE: DXF ellipse arcs always curve counter-clockwise from startParam to endParam
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

export interface Drawing {
    shapes: Shape[];
    bounds: BoundingBox;
    units: 'mm' | 'inch';
    layers?: Record<string, Layer>; // Optional layer-based shape organization
}
