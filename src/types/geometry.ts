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
  points: Point2D[];
  closed: boolean;
  vertices?: PolylineVertex[]; // Optional bulge-aware vertices for DXF polylines
}

export interface Ellipse {
  center: Point2D;
  majorAxisEndpoint: Point2D; // Vector from center to end of major axis
  minorToMajorRatio: number; // Ratio of minor axis to major axis
  startParam?: number; // Start parameter for ellipse arcs (optional)
  endParam?: number; // End parameter for ellipse arcs (optional)
}

export type GeometryType = 'line' | 'arc' | 'circle' | 'polyline' | 'spline' | 'ellipse';

export interface SplineData {
  controlPoints: Point2D[];
  knots: number[];
  weights: number[];
  degree: number;
  fitPoints: Point2D[];
}

export interface Shape {
  id: string;
  type: GeometryType;
  geometry: Line | Arc | Circle | Polyline | Ellipse;
  layer?: string;
  color?: string;
  selected?: boolean;
  originalType?: string; // Track original DXF entity type for converted shapes
  splineData?: SplineData; // Original spline data for converted spline shapes
  metadata?: Record<string, any>; // Metadata for additional shape information (e.g., originalLayer)
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