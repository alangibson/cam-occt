import type { DrawingData } from '$lib/cam/drawing/interfaces';
import type { BoundingBox } from '$lib/geometry/bounding-box/interfaces';
import { getBoundingBoxForShapes } from '$lib/geometry/bounding-box/functions';

export interface DrawingSize {
    width: number;
    height: number;
    units: string;
    source: 'dxf' | 'calculated';
}

export function calculateDrawingSize(
    drawing: DrawingData | null
): DrawingSize | null {
    if (!drawing || drawing.shapes.length === 0) {
        return null;
    }

    try {
        const bounds: BoundingBox = getBoundingBoxForShapes(drawing.shapes);
        return {
            width: Math.abs(bounds.max.x - bounds.min.x),
            height: Math.abs(bounds.max.y - bounds.min.y),
            units: drawing.units,
            source: 'calculated',
        };
    } catch (error) {
        const errorMessage: string =
            error instanceof Error ? (error as Error).message : String(error);
        throw new Error(
            `Failed to calculate bounding box from shapes: ${errorMessage}`
        );
    }
}
