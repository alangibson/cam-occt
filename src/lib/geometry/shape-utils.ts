import type {
    Shape,
    Point2D,
    Line,
    Arc,
    Circle,
    Polyline,
    Ellipse,
    Spline,
} from '../types';
import { sampleNURBS } from './nurbs';
import { tessellateEllipse } from './ellipse-tessellation';
import { polylineToPoints } from './polyline';
import { generateArcPoints } from './arc';
import { generateCirclePoints } from './circle';

/**
 * Extract points from a shape for path generation
 */
export function getShapePoints(shape: Shape): Point2D[] {
    switch (shape.type) {
        case 'line':
            const line: Line = shape.geometry as Line;
            return [line.start, line.end];

        case 'circle':
            const circle: Circle = shape.geometry as Circle;
            return generateCirclePoints(circle.center, circle.radius);

        case 'arc':
            const arc: Arc = shape.geometry as Arc;
            return generateArcPoints(arc);

        case 'polyline':
            const polyline: Polyline = shape.geometry as Polyline;
            return polylineToPoints(polyline);

        case 'ellipse':
            const ellipse: Ellipse = shape.geometry as Ellipse;
            return tessellateEllipse(ellipse, { numPoints: 64 });

        case 'spline':
            const spline: Spline = shape.geometry as Spline;
            try {
                // Use NURBS sampling for tool path generation
                return sampleNURBS(spline, 64); // Use good resolution for tool paths
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
