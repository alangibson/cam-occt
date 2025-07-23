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

export type GeometryType = 'line' | 'arc' | 'circle' | 'polyline' | 'spline';

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
  geometry: Line | Arc | Circle | Polyline;
  layer?: string;
  color?: string;
  selected?: boolean;
  originalType?: string; // Track original DXF entity type for converted shapes
  splineData?: SplineData; // Original spline data for converted spline shapes
}

export interface Drawing {
  shapes: Shape[];
  bounds: BoundingBox;
  units: 'mm' | 'inch';
}