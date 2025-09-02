declare module 'dxf' {
  export interface DXFEntity {
    type?: string;
    layer?: string;
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    r?: number;
    startAngle?: number;
    endAngle?: number;
    vertices?: Array<{ x: number; y: number; bulge?: number }>;
    controlPoints?: Array<{ x: number; y: number }>;
    knots?: number[];
    degree?: number;
    weights?: number[];
    fitPoints?: Array<{ x: number; y: number }>;
    closed?: boolean;
    majorAxisEndPoint?: { x: number; y: number };
    axisRatio?: number;
    startParam?: number;
    endParam?: number;
    name?: string;
    entities?: DXFEntity[];
    // Insert properties
    blockName?: string;
    block?: string; // Alternative block name property
    xScale?: number;
    yScale?: number;
    scaleX?: number; // Alternative scale property names
    scaleY?: number; // Alternative scale property names
    rotation?: number;
    columnCount?: number;
    rowCount?: number;
    columnSpacing?: number;
    rowSpacing?: number;
    // Line alternative format properties
    start?: { x: number; y: number };
    end?: { x: number; y: number };
    // Polyline properties
    shape?: boolean; // Alternative to closed property
    // Ellipse alternative property names
    majorX?: number; // Alternative to majorAxisEndPoint.x
    majorY?: number; // Alternative to majorAxisEndPoint.y
  }

  export interface DXFBlock {
    name?: string;
    entities?: DXFEntity[];
    x?: number;
    y?: number;
  }

  export interface DXFParsed {
    header?: {
      $INSUNITS?: number;
      insUnits?: number;
    };
    blocks?: Record<string, DXFBlock>;
    entities?: DXFEntity[];
  }

  export function parseString(dxfString: string): DXFParsed;
}