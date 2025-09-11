import type { Shape } from './interfaces';
import type { Point2D } from '../../types/geometry';
import type { Spline } from '$lib/geometry/spline';
import {
    generateCirclePoints,
    getCircleEndPoint,
    getCirclePointAt,
    getCircleStartPoint,
    reverseCircle,
    type Circle,
} from '$lib/geometry/circle';
import {
    generateArcPoints,
    getArcEndPoint,
    getArcPointAt,
    getArcStartPoint,
    reverseArc,
    type Arc,
} from '$lib/geometry/arc';
import {
    getLineEndPoint,
    getLinePointAt,
    getLineStartPoint,
    reverseLine,
    type Line,
} from '$lib/geometry/line';
import type { Polyline } from '$lib/geometry/polyline';
import type { Ellipse } from '$lib/geometry/ellipse';
import { GeometryType } from './enums';
import {
    getSplineEndPoint,
    getSplinePointAt,
    getSplineStartPoint,
    reverseSpline,
    sampleNURBS,
} from '$lib/geometry/spline';
import {
    tessellateEllipse,
    ELLIPSE_TESSELLATION_POINTS,
    getEllipseEndPoint,
    getEllipsePointAt,
    getEllipseStartPoint,
    reverseEllipse,
} from '$lib/geometry/ellipse/index';
import {
    DEFAULT_PART_DETECTION_PARAMETERS,
    type PartDetectionParameters,
} from '../../types/part-detection';
import {
    getPolylineEndPoint,
    getPolylinePointAt,
    getPolylineStartPoint,
    polylineToPoints,
    polylineToVertices,
    reversePolyline,
} from '$lib/geometry/polyline';
import { calculateEllipsePoint } from '$lib/geometry/ellipse/index';
import {
    OCTAGON_SIDES,
    DEFAULT_TESSELLATION_SEGMENTS,
    HIGH_TESSELLATION_SEGMENTS,
    MAX_ITERATIONS,
    MIDPOINT_T,
} from '$lib/geometry/constants';
import { normalizeVector, roundToDecimalPlaces } from '../math/functions';
import { calculatePolylineLength } from '../polyline/functions';
import { GeometryFactory, Coordinate } from 'jsts/org/locationtech/jts/geom';
import { RelateOp } from 'jsts/org/locationtech/jts/operation/relate';
import { CHAIN_CLOSURE_TOLERANCE, POLYGON_POINTS_MIN } from '../chain';
import { JSTS_MIN_LINEAR_RING_COORDINATES } from '$lib/algorithms/part-detection/geometric-containment';

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
            return tessellateEllipse(ellipse, ELLIPSE_TESSELLATION_POINTS);

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

/**
 * Correct tessellation implementation for shapes
 * Based on MetalHeadCAM reference implementation
 */
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
            const spline: Spline = shape.geometry as Spline;
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
} /**
 * Check if one shape is geometrically contained within another shape
 * @param inner The potentially contained shape
 * @param outer The potentially containing shape
 * @param tolerance Distance tolerance for closure detection
 * @param params Additional parameters for tessellation
 * @returns True if inner shape is contained within outer shape
 */

export function isShapeContainedInShape(
    inner: Shape,
    outer: Shape,
    tolerance: number = CHAIN_CLOSURE_TOLERANCE,
    params: PartDetectionParameters = DEFAULT_PART_DETECTION_PARAMETERS
): boolean {
    try {
        const geometryFactory = new GeometryFactory();

        // Tessellate both shapes
        const outerPoints = tessellateShape(outer, params);
        const innerPoints = tessellateShape(inner, params);

        if (outerPoints.length < POLYGON_POINTS_MIN || innerPoints.length < 1) {
            return false;
        }

        // Convert outer shape to JSTS polygon
        const outerCoords = outerPoints.map(
            (p) =>
                new Coordinate(
                    roundToDecimalPlaces(p.x, params.decimalPrecision),
                    roundToDecimalPlaces(p.y, params.decimalPrecision)
                )
        );

        // Clean duplicate consecutive coordinates
        const cleanOuterCoords: Coordinate[] = [];
        for (let i = 0; i < outerCoords.length; i++) {
            const current = outerCoords[i];
            const previous = cleanOuterCoords[cleanOuterCoords.length - 1];
            if (!previous || !current.equals(previous)) {
                cleanOuterCoords.push(current);
            }
        }

        // Ensure the ring is closed
        if (
            cleanOuterCoords.length > 0 &&
            !cleanOuterCoords[0].equals(
                cleanOuterCoords[cleanOuterCoords.length - 1]
            )
        ) {
            cleanOuterCoords.push(cleanOuterCoords[0]);
        }

        if (cleanOuterCoords.length < JSTS_MIN_LINEAR_RING_COORDINATES) {
            return false;
        }

        const outerLinearRing =
            geometryFactory.createLinearRing(cleanOuterCoords);
        const outerPolygon = geometryFactory.createPolygon(outerLinearRing);

        // Convert inner shape to JSTS geometry
        const innerCoords = innerPoints.map(
            (p) =>
                new Coordinate(
                    roundToDecimalPlaces(p.x, params.decimalPrecision),
                    roundToDecimalPlaces(p.y, params.decimalPrecision)
                )
        );

        // Check if inner shape forms a closed polygon
        const innerDistance = Math.sqrt(
            Math.pow(
                innerPoints[0].x - innerPoints[innerPoints.length - 1].x,
                2
            ) +
                Math.pow(
                    innerPoints[0].y - innerPoints[innerPoints.length - 1].y,
                    2
                )
        );

        if (innerDistance < tolerance) {
            // Inner shape is closed - create polygon
            const cleanInnerCoords: Coordinate[] = [];
            for (let i = 0; i < innerCoords.length; i++) {
                const current = innerCoords[i];
                const previous = cleanInnerCoords[cleanInnerCoords.length - 1];
                if (!previous || !current.equals(previous)) {
                    cleanInnerCoords.push(current);
                }
            }

            if (
                cleanInnerCoords.length > 0 &&
                !cleanInnerCoords[0].equals(
                    cleanInnerCoords[cleanInnerCoords.length - 1]
                )
            ) {
                cleanInnerCoords.push(cleanInnerCoords[0]);
            }

            if (cleanInnerCoords.length < JSTS_MIN_LINEAR_RING_COORDINATES) {
                return false;
            }

            const innerLinearRing =
                geometryFactory.createLinearRing(cleanInnerCoords);
            const innerPolygon = geometryFactory.createPolygon(innerLinearRing);

            return RelateOp.contains(outerPolygon, innerPolygon);
        } else {
            // Inner shape is open - create linestring
            const innerLineString =
                geometryFactory.createLineString(innerCoords);
            return RelateOp.contains(outerPolygon, innerLineString);
        }
    } catch (error) {
        console.warn('Error in shape containment detection:', error);
        return false;
    }
}
