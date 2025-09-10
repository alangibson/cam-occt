import type {
    Shape,
    Point2D,
    Line,
    Circle,
    Polyline,
    Ellipse,
    Spline,
} from '../types';
import type { Arc } from '$lib/geometry/arc';
import { GeometryType } from '../types/geometry';
import { sampleNURBS } from './nurbs';
import { tessellateEllipse } from './ellipse-tessellation';
import { polylineToPoints } from './polyline';
import { generateArcPoints } from '$lib/geometry/arc';
import { ELLIPSE_TESSELLATION_POINTS } from '../constants';
import { generateCirclePoints } from './circle';

/**
 * Extract points from a shape for path generation
 * @param shape - The shape to extract points from
 * @param forNativeShapes - If true, avoid tessellation for shapes that support native G-code commands
 */
export function getShapePoints(
    shape: Shape,
    forNativeShapes: boolean = false
): Point2D[] {
    switch (shape.type) {
        case GeometryType.LINE:
            const line: Line = shape.geometry as Line;
            return [line.start, line.end];

        case GeometryType.CIRCLE:
            const circle: Circle = shape.geometry as Circle;
            if (forNativeShapes) {
                // For native G-code generation, return just the start point
                // The native command generation will handle the full circle
                return [
                    { x: circle.center.x + circle.radius, y: circle.center.y },
                ];
            }
            return generateCirclePoints(circle.center, circle.radius);

        case GeometryType.ARC:
            const arc: Arc = shape.geometry as Arc;
            if (forNativeShapes) {
                // For native G-code generation, return start and end points only
                // The native command generation will handle the arc interpolation
                const startX =
                    arc.center.x + arc.radius * Math.cos(arc.startAngle);
                const startY =
                    arc.center.y + arc.radius * Math.sin(arc.startAngle);
                const endX = arc.center.x + arc.radius * Math.cos(arc.endAngle);
                const endY = arc.center.y + arc.radius * Math.sin(arc.endAngle);
                return [
                    { x: startX, y: startY },
                    { x: endX, y: endY },
                ];
            }
            return generateArcPoints(arc);

        case GeometryType.POLYLINE:
            const polyline: Polyline = shape.geometry as Polyline;
            return polylineToPoints(polyline);

        case GeometryType.ELLIPSE:
            const ellipse: Ellipse = shape.geometry as Ellipse;
            return tessellateEllipse(ellipse, {
                numPoints: ELLIPSE_TESSELLATION_POINTS,
            });

        case GeometryType.SPLINE:
            const spline: Spline = shape.geometry as Spline;
            try {
                // Use NURBS sampling for tool path generation
                return sampleNURBS(spline, ELLIPSE_TESSELLATION_POINTS); // Use good resolution for tool paths
            } catch {
                // Fallback to fit points or control points if NURBS evaluation fails
                if (spline.fitPoints && spline.fitPoints.length > 0) {
                    return spline.fitPoints;
                } else if (
                    spline.controlPoints &&
                    spline.controlPoints.length > 0
                ) {
                    return spline.controlPoints;
                }
                return [];
            }

        default:
            return [];
    }
}
