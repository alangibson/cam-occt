import type { Unit } from '$lib/config/units/units';
import type { ShapeData } from '$lib/cam/shape/interfaces';

export interface DrawingData {
    shapes: ShapeData[];
    units: Unit;
    fileName: string; // File name for the drawing
}
