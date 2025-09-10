/**
 * Correct tessellation implementation for shapes
 * Based on MetalHeadCAM reference implementation
 */

import type { Shape, Point2D, Spline } from '../../lib/types';
import type { Arc } from '$lib/geometry/arc';
import { GeometryType } from '../../lib/types/geometry';
import type { PartDetectionParameters } from '../../lib/types/part-detection';
import { sampleNURBS } from '../geometry/nurbs';
import {
    polylineToVertices,
    polylineToPoints,
    type Polyline,
} from '$lib/geometry/polyline';
import {
    calculateEllipsePoint,
    type Ellipse,
} from '$lib/geometry/ellipse/index';
import {
    OCTAGON_SIDES,
    DEFAULT_TESSELLATION_SEGMENTS,
    HIGH_TESSELLATION_SEGMENTS,
} from '$lib/geometry/constants';
import type { Line } from '$lib/geometry/line';
import type { Circle } from '$lib/geometry/circle';

export function tessellateShape(
    shape: Shape,
    params: PartDetectionParameters
): Point2D[] {
    const points: Point2D[] = [];

    switch (shape.type) {
        case GeometryType.LINE:
            const line: Line = shape.geometry as Line;
            points.push(line.start, line.end);
            break;

        case GeometryType.CIRCLE:
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

        case GeometryType.ARC:
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

        case GeometryType.POLYLINE:
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

        case GeometryType.ELLIPSE:
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
                    OCTAGON_SIDES,
                    Math.round(
                        paramSpan / (Math.PI / DEFAULT_TESSELLATION_SEGMENTS)
                    )
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

        case GeometryType.SPLINE:
            const spline: Spline = shape.geometry as Spline;
            try {
                // Use NURBS sampling for accurate tessellation
                // Use more points for better accuracy in part detection
                const sampledPoints: Point2D[] = sampleNURBS(
                    spline,
                    HIGH_TESSELLATION_SEGMENTS
                );
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
