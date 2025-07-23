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

export interface Polyline {
  points: Point2D[];
  closed: boolean;
}

export type GeometryType = 'line' | 'arc' | 'circle' | 'polyline' | 'spline';

export interface Shape {
  id: string;
  type: GeometryType;
  geometry: Line | Arc | Circle | Polyline;
  layer?: string;
  color?: string;
  selected?: boolean;
}

export interface Drawing {
  shapes: Shape[];
  bounds: BoundingBox;
  units: 'mm' | 'inch';
}