/**
 * Correct tessellation implementation for shapes
 * Based on MetalHeadCAM reference implementation
 */

import type {
    Shape,
    Point2D,
    Line,
    Arc,
    Circle,
    Polyline,
    Ellipse,
    Spline,
} from '../../lib/types';
import type { PartDetectionParameters } from '../../lib/types/part-detection';
import { sampleNURBS } from '../geometry/nurbs';
import { polylineToVertices, polylineToPoints } from '../geometry/polyline';
import { calculateEllipsePoint } from './ellipse-utils';

export function tessellateShape(
    shape: Shape,
    params: PartDetectionParameters
): Point2D[] {
    const points: Point2D[] = [];

    switch (shape.type) {
        case 'line':
            const line: Line = shape.geometry as Line;
            points.push(line.start, line.end);
            break;

        case 'circle':
            const circle: Circle = shape.geometry as Circle;
            const numPoints: number = params.circleTessellationPoints;
            for (let i: number = 0; i < numPoints; i++) {
                const angle: number = (i / numPoints) * 2 * Math.PI;
                points.push({
                    x: circle.center.x + circle.radius * Math.cos(angle),
                    y: circle.center.y + circle.radius * Math.sin(angle),
                });
            }
            break;

        case 'arc':
            const arc: Arc = shape.geometry as Arc;

            // Calculate the angular difference (sweep)
            let deltaAngle: number = arc.endAngle - arc.startAngle;

            // Adjust deltaAngle based on clockwise flag
            // DXF arcs are counterclockwise by default unless clockwise flag is set
            if (arc.clockwise) {
                // For clockwise arcs, if deltaAngle > 0, we want the long way around
                if (deltaAngle > 0) {
                    deltaAngle -= 2 * Math.PI;
                }
            } else {
                // For counterclockwise arcs, if deltaAngle < 0, we want to cross zero
                if (deltaAngle < 0) {
                    deltaAngle += 2 * Math.PI;
                }
            }

            const arcSpan: number = Math.abs(deltaAngle);
            const numArcPoints: number = Math.max(
                params.minArcTessellationPoints,
                Math.round(arcSpan / params.arcTessellationDensity)
            );

            for (let i: number = 0; i <= numArcPoints; i++) {
                const t: number = i / numArcPoints;
                // Calculate angle using the corrected deltaAngle
                const theta: number = arc.startAngle + t * deltaAngle;
                points.push({
                    x: arc.center.x + arc.radius * Math.cos(theta),
                    y: arc.center.y + arc.radius * Math.sin(theta),
                });
            }
            break;

        case 'polyline':
            const polyline: Polyline = shape.geometry as Polyline;
            const vertices: { x: number; y: number }[] | null =
                polylineToVertices(polyline);
            if (vertices && vertices.length > 0) {
                vertices.forEach((vertex: { x: number; y: number }) => {
                    points.push({ x: vertex.x, y: vertex.y });
                });
            } else {
                const polylinePoints: Point2D[] = polylineToPoints(polyline);
                points.push(...polylinePoints);
            }
            break;

        case 'ellipse':
            const ellipse: Ellipse = shape.geometry as Ellipse;
            const majorAxisLength: number = Math.sqrt(
                ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
                    ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
            );
            const minorAxisLength: number =
                majorAxisLength * ellipse.minorToMajorRatio;
            const majorAxisAngle: number = Math.atan2(
                ellipse.majorAxisEndpoint.y,
                ellipse.majorAxisEndpoint.x
            );

            const isArc: boolean =
                typeof ellipse.startParam === 'number' &&
                typeof ellipse.endParam === 'number';

            if (
                isArc &&
                ellipse.startParam !== undefined &&
                ellipse.endParam !== undefined
            ) {
                // Ellipse arc - use similar logic to circular arcs
                let deltaParam: number = ellipse.endParam - ellipse.startParam;

                // For ellipses, we assume counterclockwise by default
                if (deltaParam < 0) {
                    deltaParam += 2 * Math.PI;
                }

                const paramSpan: number = Math.abs(deltaParam);
                const numEllipsePoints: number = Math.max(
                    8,
                    Math.round(paramSpan / (Math.PI / 16))
                );

                for (let i: number = 0; i <= numEllipsePoints; i++) {
                    const t: number = i / numEllipsePoints;
                    const param: number = ellipse.startParam + t * deltaParam;

                    points.push(
                        calculateEllipsePoint(
                            ellipse,
                            param,
                            majorAxisLength,
                            minorAxisLength,
                            majorAxisAngle
                        )
                    );
                }
            } else {
                // Full ellipse
                const numEllipsePoints: number = 32;
                for (let i: number = 0; i < numEllipsePoints; i++) {
                    const param: number = (i / numEllipsePoints) * 2 * Math.PI;

                    points.push(
                        calculateEllipsePoint(
                            ellipse,
                            param,
                            majorAxisLength,
                            minorAxisLength,
                            majorAxisAngle
                        )
                    );
                }
            }
            break;

        case 'spline':
            const spline: Spline = shape.geometry as Spline;
            try {
                // Use NURBS sampling for accurate tessellation
                // Use more points for better accuracy in part detection
                const sampledPoints: Point2D[] = sampleNURBS(spline, 32);
                points.push(...sampledPoints);
            } catch {
                // Fallback to fit points or control points if NURBS evaluation fails
                if (spline.fitPoints && spline.fitPoints.length > 0) {
                    points.push(...spline.fitPoints);
                } else if (
                    spline.controlPoints &&
                    spline.controlPoints.length > 0
                ) {
                    points.push(...spline.controlPoints);
                }
            }
            break;
    }

    return points;
}
