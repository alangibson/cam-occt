import type { Point2D } from '$lib/geometry/point/interfaces';
import type { ShapeData } from '$lib/geometry/shape/interfaces';
import {
    getShapeEndPoint,
    getShapeOrigin,
    getShapeStartPoint,
} from '$lib/geometry/shape/functions';
import type { ShapePoint } from '$lib/stores/overlay/interfaces';

// Helper functions to generate shape overlay data
export function generateShapePoints(
    shapes: ShapeData[],
    selectedShapeIds: Set<string>
): ShapePoint[] {
    const points: ShapePoint[] = [];

    shapes.forEach((shape) => {
        if (selectedShapeIds.has(shape.id)) {
            // Generate origin, start, and end points for selected shapes
            const origin: Point2D | null = getShapeOrigin(shape);
            const start: Point2D = getShapeStartPoint(shape);
            const end: Point2D = getShapeEndPoint(shape);

            if (origin) {
                points.push({ ...origin, type: 'origin', shapeId: shape.id });
            }
            points.push({ ...start, type: 'start', shapeId: shape.id });
            points.push({ ...end, type: 'end', shapeId: shape.id });
        }
    });

    return points;
}
