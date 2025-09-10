import type {
    Shape,
    Point2D,
    Line,
    Polyline,
    Spline,
    Ellipse,
} from '$lib/types/geometry';
import type { Arc } from '$lib/geometry/arc';
import type { Circle } from '$lib/geometry/circle';
import {
    getLineStartPoint,
    getLineEndPoint,
    reverseLine,
    getLinePointAt,
} from './line';
import {
    getCircleStartPoint,
    getCircleEndPoint,
    reverseCircle,
    getCirclePointAt,
} from '$lib/geometry/circle';
import {
    getArcStartPoint,
    getArcEndPoint,
    reverseArc,
    getArcPointAt,
} from '$lib/geometry/arc';
import {
    getPolylineStartPoint,
    getPolylineEndPoint,
    reversePolyline,
    getPolylinePointAt,
} from './polyline';
import {
    getSplineStartPoint,
    getSplineEndPoint,
    reverseSpline,
    getSplinePointAt,
} from './spline';
import {
    getEllipseStartPoint,
    getEllipseEndPoint,
    reverseEllipse,
    getEllipsePointAt,
} from './ellipse';
import { sampleNURBS } from './nurbs';
import { MAX_ITERATIONS } from '../constants';
/**
 * Parametric t value for midpoint (0.5)
 */
const MIDPOINT_T = 0.5;

/**
 * Get the starting point of a shape
 */
export function getShapeStartPoint(shape: Shape): Point2D {
    switch (shape.type) {
        case 'line':
            return getLineStartPoint(shape.geometry as Line);
        case 'circle':
            return getCircleStartPoint(shape.geometry as Circle);
        case 'arc':
            return getArcStartPoint(shape.geometry as Arc);
        case 'polyline':
            return getPolylineStartPoint(shape.geometry as Polyline);
        case 'spline':
            return getSplineStartPoint(shape.geometry as Spline);
        case 'ellipse':
            return getEllipseStartPoint(shape.geometry as Ellipse);
        default:
            throw new Error(`Unknown shape type: ${shape.type}`);
    }
}

/**
 * Get the ending point of a shape
 */
export function getShapeEndPoint(shape: Shape): Point2D {
    switch (shape.type) {
        case 'line':
            return getLineEndPoint(shape.geometry as Line);
        case 'circle':
            return getCircleEndPoint(shape.geometry as Circle);
        case 'arc':
            return getArcEndPoint(shape.geometry as Arc);
        case 'polyline':
            return getPolylineEndPoint(shape.geometry as Polyline);
        case 'spline':
            return getSplineEndPoint(shape.geometry as Spline);
        case 'ellipse':
            return getEllipseEndPoint(shape.geometry as Ellipse);
        default:
            throw new Error(`Unknown shape type: ${shape.type}`);
    }
}
/**
 * Reverses a shape (swaps start and end points)
 */
export function reverseShape(shape: Shape): Shape {
    const reversed: Shape = { ...shape };
    switch (shape.type) {
        case 'line':
            reversed.geometry = reverseLine(shape.geometry as Line);
            break;
        case 'arc':
            reversed.geometry = reverseArc(shape.geometry as Arc);
            break;
        case 'polyline':
            reversed.geometry = reversePolyline(shape.geometry as Polyline);
            break;
        case 'circle':
            reversed.geometry = reverseCircle(shape.geometry as Circle);
            break;
        case 'ellipse':
            reversed.geometry = reverseEllipse(shape.geometry as Ellipse);
            break;
        case 'spline':
            reversed.geometry = reverseSpline(shape.geometry as Spline);
            break;
    }
    return reversed;
}
/**
 * Get a point on a shape at parameter t (0-1)
 */
export function getShapePointAt(shape: Shape, t: number): Point2D {
    switch (shape.type) {
        case 'line':
            return getLinePointAt(shape.geometry as Line, t);
        case 'arc':
            return getArcPointAt(shape.geometry as Arc, t);
        case 'circle':
            return getCirclePointAt(shape.geometry as Circle, t);
        case 'polyline':
            return getPolylinePointAt(shape.geometry as Polyline, t);
        case 'spline':
            return getSplinePointAt(shape.geometry as Spline, t);
        case 'ellipse':
            return getEllipsePointAt(shape.geometry as Ellipse, t);
        default:
            throw new Error(`Unknown shape type: ${shape.type}`);
    }
}

/**
 * Calculate total length of a polyline from its points
 * @param points - Array of 2D points
 * @returns Total length of the polyline
 */
function calculatePolylineLength(points: Point2D[]): number {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
}

/**
 * Calculate the total length of a shape
 */
export function getShapeLength(shape: Shape): number {
    switch (shape.type) {
        case 'line':
            const line = shape.geometry as Line;
            const dx = line.end.x - line.start.x;
            const dy = line.end.y - line.start.y;
            return Math.sqrt(dx * dx + dy * dy);

        case 'arc':
            const arc = shape.geometry as Arc;
            let angularSpan = Math.abs(arc.endAngle - arc.startAngle);
            if (angularSpan > Math.PI) angularSpan = 2 * Math.PI - angularSpan;
            return arc.radius * angularSpan;

        case 'circle':
            const circle = shape.geometry as Circle;
            return 2 * Math.PI * circle.radius;

        case 'polyline':
            const polyline = shape.geometry as Polyline;
            if (!polyline.shapes || polyline.shapes.length === 0) return 0;
            return polyline.shapes.reduce(
                (total, shape) => total + getShapeLength(shape),
                0
            );

        case 'spline':
            // For splines, approximate length by sampling points
            const spline = shape.geometry as Spline;
            try {
                const points = sampleNURBS(spline, MAX_ITERATIONS);
                if (points.length < 2) return 0;
                return calculatePolylineLength(points);
            } catch {
                return 0;
            }

        case 'ellipse':
            // For ellipses, approximate length using Ramanujan's approximation
            const ellipse = shape.geometry as Ellipse;
            const a = Math.sqrt(
                ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
                    ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
            );
            const b = a * ellipse.minorToMajorRatio;

            if (
                typeof ellipse.startParam === 'number' &&
                typeof ellipse.endParam === 'number'
            ) {
                // Ellipse arc - approximate by sampling points
                const points: Point2D[] = [];
                const numSamples = 50;
                for (let i = 0; i <= numSamples; i++) {
                    const t = i / numSamples;
                    points.push(getEllipsePointAt(ellipse, t));
                }
                return calculatePolylineLength(points);
            } else {
                // Full ellipse - use Ramanujan's approximation
                const h = Math.pow((a - b) / (a + b), 2);
                return (
                    Math.PI *
                    (a + b) *
                    // eslint-disable-next-line no-magic-numbers
                    (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))
                );
            }

        default:
            return 0;
    }
}

/**
 * Sample points along a path of shapes at regular distance intervals
 */
export function samplePathAtDistanceIntervals(
    shapes: Shape[],
    intervalDistance: number
): { point: Point2D; direction: Point2D }[] {
    if (shapes.length === 0 || intervalDistance <= 0) return [];

    const samples: { point: Point2D; direction: Point2D }[] = [];

    // Calculate cumulative distances and sample points
    let currentDistance = 0;
    let nextSampleDistance = intervalDistance;

    for (const shape of shapes) {
        const shapeLength = getShapeLength(shape);
        if (shapeLength === 0) continue;

        const shapeEndDistance = currentDistance + shapeLength;

        // Sample points within this shape
        while (nextSampleDistance <= shapeEndDistance) {
            const distanceIntoShape = nextSampleDistance - currentDistance;
            const t = distanceIntoShape / shapeLength;

            // Get point at this parameter
            const point = getShapePointAt(shape, t);

            // Get direction by sampling nearby points
            const epsilon = 0.001;
            const t1 = Math.max(0, t - epsilon);
            const t2 = Math.min(1, t + epsilon);
            const p1 = getShapePointAt(shape, t1);
            const p2 = getShapePointAt(shape, t2);

            // Calculate direction vector
            const direction = normalizeVector({
                x: p2.x - p1.x,
                y: p2.y - p1.y,
            });

            samples.push({ point, direction });
            nextSampleDistance += intervalDistance;
        }

        currentDistance = shapeEndDistance;
    }

    return samples;
}

/**
 * Gets the normal vector at a point on a shape
 *
 * @param shape - Shape to get normal from
 * @param t - Parameter value (0-1) where to get the normal
 * @returns Normalized normal vector pointing outward/rightward
 */
export function getShapeNormal(shape: Shape, t: number): Point2D {
    // Get two nearby points to calculate tangent
    const delta: number = 0.001;
    const t1: number = Math.max(0, t - delta);
    const t2: number = Math.min(1, t + delta);

    const p1: Point2D = getShapePointAt(shape, t1);
    const p2: Point2D = getShapePointAt(shape, t2);

    // Calculate tangent vector
    const tangent: Point2D = {
        x: p2.x - p1.x,
        y: p2.y - p1.y,
    };

    // Normalize tangent
    const normalizedTangent: Point2D = normalizeVector(tangent);

    // Rotate 90 degrees counterclockwise to get normal (right-hand rule)
    const normal: Point2D = {
        x: -normalizedTangent.y,
        y: normalizedTangent.x,
    };

    return normal;
}

/**
 * Gets the midpoint of a shape at a given parameter
 *
 * @param shape - Shape to get midpoint from
 * @param t - Parameter value (0-1), defaults to 0.5
 * @returns Point at the given parameter
 */
export function getShapeMidpoint(
    shape: Shape,
    t: number = MIDPOINT_T
): Point2D {
    return getShapePointAt(shape, t);
}
/**
 * Gets a point at a parameter t using arc-length parameterization for better accuracy
 *
 * @param points - Array of tessellated points
 * @param t - Parameter value (0-1)
 * @returns Point at the given arc-length parameter
 */

// Helper functions for vector operations
export function normalizeVector(v: Point2D): Point2D {
    const length: number = Math.sqrt(v.x * v.x + v.y * v.y);
    if (length === 0) return { x: 0, y: 0 };
    return { x: v.x / length, y: v.y / length };
}

export function scaleShape(
    shape: Shape,
    scaleFactor: number,
    origin: Point2D
): Shape {
    const scaled: Shape = { ...shape };

    const scalePoint: (p: Point2D) => Point2D = (p: Point2D): Point2D => ({
        x: origin.x + (p.x - origin.x) * scaleFactor,
        y: origin.y + (p.y - origin.y) * scaleFactor,
    });

    switch (shape.type) {
        case 'line':
            const line: import('$lib/types/geometry').Line =
                shape.geometry as Line;
            scaled.geometry = {
                start: scalePoint(line.start),
                end: scalePoint(line.end),
            };
            break;

        case 'circle':
        case 'arc':
            const circle: import('$lib/types/geometry').Circle =
                shape.geometry as Circle | Arc;
            scaled.geometry = {
                ...circle,
                center: scalePoint(circle.center),
                radius: circle.radius * scaleFactor,
            };
            break;

        case 'polyline':
            const polyline: import('$lib/types/geometry').Polyline =
                shape.geometry as Polyline;
            scaled.geometry = {
                ...polyline,
                shapes: polyline.shapes.map((shape) => {
                    const segment = shape.geometry;
                    if ('start' in segment && 'end' in segment) {
                        // Line segment
                        return {
                            ...shape,
                            geometry: {
                                start: scalePoint(segment.start),
                                end: scalePoint(segment.end),
                            },
                        };
                    } else if ('center' in segment && 'radius' in segment) {
                        // Arc segment
                        return {
                            ...shape,
                            geometry: {
                                ...segment,
                                center: scalePoint(segment.center),
                                radius: segment.radius * scaleFactor,
                            },
                        };
                    }
                    return shape;
                }),
            };
            break;

        case 'ellipse':
            const ellipse: import('$lib/types/geometry').Ellipse =
                shape.geometry as Ellipse;
            const scaledCenter: Point2D = scalePoint(ellipse.center);
            const majorAxisEnd: Point2D = {
                x: ellipse.center.x + ellipse.majorAxisEndpoint.x,
                y: ellipse.center.y + ellipse.majorAxisEndpoint.y,
            };
            const scaledMajorAxisEnd: Point2D = scalePoint(majorAxisEnd);

            scaled.geometry = {
                ...ellipse,
                center: scaledCenter,
                majorAxisEndpoint: {
                    x: scaledMajorAxisEnd.x - scaledCenter.x,
                    y: scaledMajorAxisEnd.y - scaledCenter.y,
                },
            };
            break;

        case 'spline':
            const spline: import('$lib/types/geometry').Spline =
                shape.geometry as Spline;
            scaled.geometry = {
                ...spline,
                controlPoints: spline.controlPoints.map(scalePoint),
                fitPoints: spline.fitPoints.map(scalePoint),
            };
            break;
    }

    return scaled;
}

export function rotateShape(
    shape: Shape,
    angle: number,
    origin: Point2D
): Shape {
    const rotated: Shape = { ...shape };

    const rotatePoint: (p: Point2D) => Point2D = (p: Point2D): Point2D => {
        const cos: number = Math.cos(angle);
        const sin: number = Math.sin(angle);
        const dx: number = p.x - origin.x;
        const dy: number = p.y - origin.y;

        return {
            x: origin.x + dx * cos - dy * sin,
            y: origin.y + dx * sin + dy * cos,
        };
    };

    switch (shape.type) {
        case 'line':
            const line: import('$lib/types/geometry').Line =
                shape.geometry as Line;
            rotated.geometry = {
                start: rotatePoint(line.start),
                end: rotatePoint(line.end),
            };
            break;

        case 'circle':
            const circle: import('$lib/types/geometry').Circle =
                shape.geometry as Circle;
            rotated.geometry = {
                ...circle,
                center: rotatePoint(circle.center),
            };
            break;

        case 'arc':
            const arc: Arc = shape.geometry as Arc;
            rotated.geometry = {
                ...arc,
                center: rotatePoint(arc.center),
                startAngle: arc.startAngle + angle,
                endAngle: arc.endAngle + angle,
            };
            break;

        case 'polyline':
            const polyline: import('$lib/types/geometry').Polyline =
                shape.geometry as Polyline;
            rotated.geometry = {
                ...polyline,
                shapes: polyline.shapes.map((shape) => {
                    const segment = shape.geometry;
                    if ('start' in segment && 'end' in segment) {
                        // Line segment
                        return {
                            ...shape,
                            geometry: {
                                start: rotatePoint(segment.start),
                                end: rotatePoint(segment.end),
                            },
                        };
                    } else if ('center' in segment && 'radius' in segment) {
                        // Arc or Circle segment
                        if ('startAngle' in segment && 'endAngle' in segment) {
                            // Arc segment
                            return {
                                ...shape,
                                geometry: {
                                    ...segment,
                                    center: rotatePoint(segment.center),
                                    startAngle: segment.startAngle + angle,
                                    endAngle: segment.endAngle + angle,
                                },
                            };
                        } else {
                            // Circle segment
                            return {
                                ...shape,
                                geometry: {
                                    ...segment,
                                    center: rotatePoint(segment.center),
                                },
                            };
                        }
                    }
                    return shape;
                }),
            };
            break;

        case 'ellipse':
            const ellipse: import('$lib/types/geometry').Ellipse =
                shape.geometry as Ellipse;
            const rotatedCenter: Point2D = rotatePoint(ellipse.center);
            const majorAxisEnd: Point2D = {
                x: ellipse.center.x + ellipse.majorAxisEndpoint.x,
                y: ellipse.center.y + ellipse.majorAxisEndpoint.y,
            };
            const rotatedMajorAxisEnd: Point2D = rotatePoint(majorAxisEnd);

            rotated.geometry = {
                ...ellipse,
                center: rotatedCenter,
                majorAxisEndpoint: {
                    x: rotatedMajorAxisEnd.x - rotatedCenter.x,
                    y: rotatedMajorAxisEnd.y - rotatedCenter.y,
                },
            };
            break;
    }

    return rotated;
}

export function moveShape(shape: Shape, delta: Point2D): Shape {
    const moved: Shape = { ...shape };

    switch (shape.type) {
        case 'line':
            const line: import('$lib/types/geometry').Line =
                shape.geometry as Line;
            moved.geometry = {
                start: { x: line.start.x + delta.x, y: line.start.y + delta.y },
                end: { x: line.end.x + delta.x, y: line.end.y + delta.y },
            };
            break;

        case 'circle':
        case 'arc':
            const circle: import('$lib/types/geometry').Circle =
                shape.geometry as Circle | Arc;
            moved.geometry = {
                ...circle,
                center: {
                    x: circle.center.x + delta.x,
                    y: circle.center.y + delta.y,
                },
            };
            break;

        case 'polyline':
            const polyline: import('$lib/types/geometry').Polyline =
                shape.geometry as Polyline;
            moved.geometry = {
                ...polyline,
                shapes: polyline.shapes.map((shape) => {
                    const segment = shape.geometry;
                    if ('start' in segment && 'end' in segment) {
                        // Line segment
                        return {
                            ...shape,
                            geometry: {
                                start: {
                                    x: segment.start.x + delta.x,
                                    y: segment.start.y + delta.y,
                                },
                                end: {
                                    x: segment.end.x + delta.x,
                                    y: segment.end.y + delta.y,
                                },
                            },
                        };
                    } else if ('center' in segment && 'radius' in segment) {
                        // Arc segment
                        return {
                            ...shape,
                            geometry: {
                                ...segment,
                                center: {
                                    x: segment.center.x + delta.x,
                                    y: segment.center.y + delta.y,
                                },
                            },
                        };
                    }
                    return shape;
                }),
            };
            break;

        case 'ellipse':
            const ellipse: import('$lib/types/geometry').Ellipse =
                shape.geometry as Ellipse;
            moved.geometry = {
                ...ellipse,
                center: {
                    x: ellipse.center.x + delta.x,
                    y: ellipse.center.y + delta.y,
                },
            };
            break;
    }

    return moved;
}
