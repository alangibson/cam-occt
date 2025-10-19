import type { Drawing } from '$lib/cam/drawing/interfaces';
import type { BoundingBox } from '$lib/geometry/bounding-box/interfaces';
import { getBoundingBoxForShapes } from '$lib/geometry/bounding-box/functions';

export interface DrawingSize {
    width: number;
    height: number;
    units: string;
    source: 'dxf' | 'calculated';
}

export function calculateDrawingSize(
    drawing: Drawing | null
): DrawingSize | null {
    if (!drawing || drawing.shapes.length === 0) {
        return null;
    }

    // First, check if DXF has explicit size information
    // TODO: Parse DXF header for explicit dimensions in future

    // Check if the bounds from DXF parser are valid
    const bounds: BoundingBox | undefined = drawing.bounds;
    const isValidBounds: boolean =
        bounds !== undefined &&
        isFinite(bounds.min.x) &&
        isFinite(bounds.min.y) &&
        isFinite(bounds.max.x) &&
        isFinite(bounds.max.y) &&
        bounds.min.x !== bounds.max.x &&
        bounds.min.y !== bounds.max.y;

    if (isValidBounds && bounds) {
        // Use the bounding box that was already calculated by the DXF parser
        return {
            width: Math.abs(bounds.max.x - bounds.min.x),
            height: Math.abs(bounds.max.y - bounds.min.y),
            units: drawing.units,
            source: 'calculated',
        };
    }

    // If DXF bounds are invalid, calculate using geometry functions
    console.warn(
        'DXF bounds are invalid, falling back to custom bounding box calculation'
    );

    try {
        const calculatedBounds: BoundingBox = getBoundingBoxForShapes(
            drawing.shapes
        );
        return {
            width: Math.abs(calculatedBounds.max.x - calculatedBounds.min.x),
            height: Math.abs(calculatedBounds.max.y - calculatedBounds.min.y),
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
