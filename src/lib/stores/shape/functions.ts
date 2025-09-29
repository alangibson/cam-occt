import type { Circle, Ellipse, Line, Polyline } from '$lib/types/geometry';
import type { Point2D, Shape } from '$lib/types';
import type { Arc } from '$lib/geometry/arc';
import {
    getShapeEndPoint,
    getShapeStartPoint,
} from '$lib/geometry/shape/functions';
import { polylineToPoints } from '$lib/geometry/polyline';
import type { ShapePoint } from '$lib/stores/overlay/interfaces';

// Helper functions to generate shape overlay data
export function generateShapePoints(
    shapes: Shape[],
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

// Helper function to get the origin point of a shape
function getShapeOrigin(shape: Shape): Point2D | null {
    switch (shape.type) {
        case 'line':
            const line: Line = shape.geometry as Line;
            return line.start;
        case 'circle':
        case 'arc':
            const circle: Circle = shape.geometry as Circle | Arc;
            return circle.center;
        case 'polyline':
            const polyline: Polyline = shape.geometry as Polyline;
            const points: Point2D[] = polylineToPoints(polyline);
            return points.length > 0 ? points[0] : null;
        case 'ellipse':
            const ellipse: Ellipse = shape.geometry as Ellipse;
            return ellipse.center;
        default:
            return null;
    }
}
