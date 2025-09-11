import { GeometryType } from '$lib/types/geometry';
import type {
    Shape,
    Point2D,
    Line,
    Circle,
    Polyline,
    Ellipse,
} from '$lib/types';
import type { Spline } from '$lib/geometry/spline';
import type { Arc } from '$lib/geometry/arc';
import { getShapePointsForBounds } from '$lib/geometry/bounding-box/functions';

/**
 * Translate all shapes to ensure they are in the positive quadrant
 *
 * This algorithm calculates the bounding box of all shapes and translates them
 * so that the minimum coordinates are at (0, 0), ensuring all geometry is in
 * the positive quadrant for consistent CAM processing.
 */
export function translateToPositiveQuadrant(shapes: Shape[]): Shape[] {
    if (shapes.length === 0) return shapes;

    // Calculate bounding box
    let minX: number = Infinity;
    let minY: number = Infinity;

    shapes.forEach((shape) => {
        const points: Point2D[] = getShapePointsForBounds(shape);
        points.forEach((point) => {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
        });
    });

    // Only translate if there are negative coordinates
    if (minX >= 0 && minY >= 0) return shapes;

    const translateX: number = minX < 0 ? -minX : 0;
    const translateY: number = minY < 0 ? -minY : 0;

    // Translate all shapes
    return shapes.map((shape) => {
        return translateShape(shape, translateX, translateY);
    });
}

/**
 * Translate a single shape by the given offsets
 */
function translateShape(shape: Shape, dx: number, dy: number): Shape {
    const translated: Shape = { ...shape };

    switch (shape.type) {
        case GeometryType.LINE:
            const line: Line = shape.geometry as Line;
            translated.geometry = {
                start: { x: line.start.x + dx, y: line.start.y + dy },
                end: { x: line.end.x + dx, y: line.end.y + dy },
            };
            break;
        case GeometryType.CIRCLE:
            const circle: Circle = shape.geometry as Circle;
            translated.geometry = {
                center: { x: circle.center.x + dx, y: circle.center.y + dy },
                radius: circle.radius,
            };
            break;
        case GeometryType.ARC:
            const arc: Arc = shape.geometry as Arc;
            translated.geometry = {
                center: { x: arc.center.x + dx, y: arc.center.y + dy },
                radius: arc.radius,
                startAngle: arc.startAngle,
                endAngle: arc.endAngle,
                clockwise: arc.clockwise,
            };
            break;
        case GeometryType.POLYLINE:
            const polyline: Polyline = shape.geometry as Polyline;
            // Translate shapes instead of points/vertices (new polyline structure)
            const translatedShapes: Shape[] = polyline.shapes.map(
                (polylineShape) => {
                    const segment: Line | Arc = polylineShape.geometry as
                        | Line
                        | Arc;
                    if ('start' in segment && 'end' in segment) {
                        // Line segment
                        return {
                            ...polylineShape,
                            geometry: {
                                start: {
                                    x: segment.start.x + dx,
                                    y: segment.start.y + dy,
                                },
                                end: {
                                    x: segment.end.x + dx,
                                    y: segment.end.y + dy,
                                },
                            },
                        };
                    } else if ('center' in segment && 'radius' in segment) {
                        // Arc segment
                        return {
                            ...polylineShape,
                            geometry: {
                                ...segment,
                                center: {
                                    x: segment.center.x + dx,
                                    y: segment.center.y + dy,
                                },
                            },
                        };
                    }
                    return polylineShape; // Unknown segment type, return as-is
                }
            );

            translated.geometry = {
                ...polyline,
                shapes: translatedShapes,
            };
            break;
        case GeometryType.ELLIPSE:
            const ellipse: Ellipse = shape.geometry as Ellipse;
            translated.geometry = {
                center: { x: ellipse.center.x + dx, y: ellipse.center.y + dy },
                majorAxisEndpoint: ellipse.majorAxisEndpoint, // This is a vector, not translated
                minorToMajorRatio: ellipse.minorToMajorRatio,
                startParam: ellipse.startParam,
                endParam: ellipse.endParam,
            };
            break;
        case GeometryType.SPLINE:
            const spline: Spline = shape.geometry as Spline;
            translated.geometry = {
                ...spline,
                controlPoints: spline.controlPoints.map((p: Point2D) => ({
                    x: p.x + dx,
                    y: p.y + dy,
                })),
                fitPoints: spline.fitPoints
                    ? spline.fitPoints.map((p: Point2D) => ({
                          x: p.x + dx,
                          y: p.y + dy,
                      }))
                    : [],
            };
            break;
        default:
            // No translation needed for unknown types
            break;
    }

    return translated;
}
