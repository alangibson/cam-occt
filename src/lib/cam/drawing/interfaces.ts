import type { Unit } from '$lib/config/units/units';
import type { BoundingBox } from '$lib/geometry/bounding-box/interfaces';
import type { Shape } from '$lib/geometry/shape/interfaces';

export interface DrawingData {
    shapes: Shape[];
    bounds: BoundingBox;
    units: Unit;
    rawInsUnits?: number; // Raw DXF $INSUNITS value for display purposes
    fileName?: string; // File name for the drawing
}
