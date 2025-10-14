import type { Shape } from './interfaces';
import type {
    Circle,
    Ellipse,
    Line,
    Point2D,
    Polyline,
} from '$lib/types/geometry';
import type { Spline } from '$lib/geometry/spline';
import {
    generateCirclePoints,
    getCircleEndPoint,
    getCirclePointAt,
    getCircleStartPoint,
    reverseCircle,
} from '$lib/geometry/circle';
import {
    type Arc,
    generateArcPoints,
    getArcEndPoint,
    getArcPointAt,
    getArcStartPoint,
    reverseArc,
} from '$lib/geometry/arc';
import {
    getLineEndPoint,
    getLinePointAt,
    getLineStartPoint,
    reverseLine,
} from '$lib/geometry/line';
import { GeometryType } from './enums';
import {
    getSplineEndPoint,
    getSplinePointAt,
    getSplineStartPoint,
    reverseSpline,
    tessellateSpline,
} from '$lib/geometry/spline';
import {
    ELLIPSE_TESSELLATION_POINTS,
    generateEllipsePoints,
    getEllipseEndPoint,
    getEllipsePointAt,
    getEllipseStartPoint,
    isEllipseClosed,
    reverseEllipse,
    tessellateEllipse,
    calculateEllipsePoint,
} from '$lib/geometry/ellipse/index';
import {
    DEFAULT_PART_DETECTION_PARAMETERS,
    type PartDetectionParameters,
} from '$lib/types/part-detection';
import {
    getPolylineEndPoint,
    getPolylinePointAt,
    getPolylineStartPoint,
    polylineToPoints,
    polylineToVertices,
    reversePolyline,
} from '$lib/geometry/polyline';
import {
    DEFAULT_TESSELLATION_SEGMENTS,
    HIGH_TESSELLATION_SEGMENTS,
    MIDPOINT_T,
    OCTAGON_SIDES,
    QUARTER_CIRCLE_QUADRANTS,
    TESSELLATION_SAMPLE_MULTIPLIER,
} from '$lib/geometry/constants';
import {
    normalizeVector,
    roundToDecimalPlaces,
} from '$lib/geometry/math/functions';
import { calculatePolylineLength } from '$lib/geometry/polyline/functions';
import { Coordinate, GeometryFactory } from 'jsts/org/locationtech/jts/geom';
import { RelateOp } from 'jsts/org/locationtech/jts/operation/relate';
import {
    CHAIN_CLOSURE_TOLERANCE,
    POLYGON_POINTS_MIN,
} from '$lib/geometry/chain';
import { JSTS_MIN_LINEAR_RING_COORDINATES } from '$lib/algorithms/part-detection/geometric-containment';
import { LEAD_SEGMENT_COUNT } from '$lib/geometry/line/constants';
import { GEOMETRIC_PRECISION_TOLERANCE } from '$lib/geometry/math';
import { STANDARD_GRID_SPACING } from '$lib/constants';
import { calculateEllipsePoint2 } from '$lib/geometry/ellipse/functions';
import { getBoundingBoxForArc } from '$lib/geometry/bounding-box/functions';
import {
    splitArcAtMidpoint,
    splitLineAtMidpoint,
} from '$lib/algorithms/optimize-start-points/cut-optimization-utils';
import { generateId } from '$lib/domain/id';
import { SCALING_AVERAGE_DIVISOR } from '$lib/parsers/dxf/constants';

// Constants for shape point generation
const HIGH_RESOLUTION_CIRCLE_SEGMENTS = 32;

/**
 * Extract points from a shape for path generation
 * @param shape - The shape to extract points from
 * @param forNativeShapes - If true, avoid tessellation for shapes that support native G-code commands
 */
export type GetShapePointsMode =
    | 'TESSELLATION'
    | 'BOUNDS'
    | 'CHAIN_DETECTION'
    | 'DIRECTION_ANALYSIS';
export type GetShapePointsResolution = 'LOW' | 'MEDIUM' | 'HIGH' | 'ADAPTIVE';

export interface GetShapePointsOptions {
    forNativeShapes?: boolean;
    mode?: GetShapePointsMode;
    resolution?: GetShapePointsResolution;
}

export function getShapePoints(
    shape: Shape,
    optionsOrForNativeShapes: GetShapePointsOptions | boolean = {}
): Point2D[] {
    // Handle backward compatibility: if boolean is passed, convert to options
    const options: GetShapePointsOptions =
        typeof optionsOrForNativeShapes === 'boolean'
            ? { forNativeShapes: optionsOrForNativeShapes }
            : optionsOrForNativeShapes;

    const {
        forNativeShapes = false,
        mode = 'TESSELLATION',
        resolution = 'MEDIUM',
    } = options;

    switch (shape.type) {
        case GeometryType.LINE:
            const line: Line = shape.geometry as Line;
            return [line.start, line.end];

        case GeometryType.CIRCLE:
            const circle: Circle = shape.geometry as Circle;

            if (mode === 'BOUNDS') {
                // Return bounding box corners for test/analysis purposes
                return [
                    {
                        x: circle.center.x - circle.radius,
                        y: circle.center.y - circle.radius,
                    },
                    {
                        x: circle.center.x + circle.radius,
                        y: circle.center.y + circle.radius,
                    },
                ];
            }

            if (mode === 'CHAIN_DETECTION') {
                // For chain detection, use key points around circumference plus center
                return [
                    { x: circle.center.x + circle.radius, y: circle.center.y }, // Right
                    { x: circle.center.x - circle.radius, y: circle.center.y }, // Left
                    { x: circle.center.x, y: circle.center.y + circle.radius }, // Top
                    { x: circle.center.x, y: circle.center.y - circle.radius }, // Bottom
                    circle.center, // Center for connectivity analysis
                ];
            }

            if (mode === 'DIRECTION_ANALYSIS' || resolution === 'LOW') {
                // For direction analysis, return 4 compass points
                return [
                    { x: circle.center.x + circle.radius, y: circle.center.y }, // Right
                    { x: circle.center.x, y: circle.center.y + circle.radius }, // Top
                    { x: circle.center.x - circle.radius, y: circle.center.y }, // Left
                    { x: circle.center.x, y: circle.center.y - circle.radius }, // Bottom
                ];
            }

            if (forNativeShapes) {
                // For native G-code generation, return just the start point
                return [
                    { x: circle.center.x + circle.radius, y: circle.center.y },
                ];
            }

            if (resolution === 'HIGH') {
                // High resolution approximation with 32 points
                const points: Point2D[] = [];
                const segments = HIGH_RESOLUTION_CIRCLE_SEGMENTS;
                for (let i = 0; i < segments; i++) {
                    const angle = (i * 2 * Math.PI) / segments;
                    points.push({
                        x: circle.center.x + circle.radius * Math.cos(angle),
                        y: circle.center.y + circle.radius * Math.sin(angle),
                    });
                }
                return points;
            }

            // Default tessellation
            return generateCirclePoints(circle.center, circle.radius);

        case GeometryType.ARC:
            const arc: Arc = shape.geometry as Arc;

            if (mode === 'BOUNDS') {
                // Use actual arc bounds instead of full circle bounds
                const arcBounds = getBoundingBoxForArc(arc);
                return [arcBounds.min, arcBounds.max];
            }

            if (mode === 'CHAIN_DETECTION') {
                // For chain detection, return start, end, and center points
                const startX =
                    arc.center.x + arc.radius * Math.cos(arc.startAngle);
                const startY =
                    arc.center.y + arc.radius * Math.sin(arc.startAngle);
                const endX = arc.center.x + arc.radius * Math.cos(arc.endAngle);
                const endY = arc.center.y + arc.radius * Math.sin(arc.endAngle);

                return [
                    { x: startX, y: startY }, // Start point
                    { x: endX, y: endY }, // End point
                    arc.center, // Center for connectivity analysis
                ];
            }

            if (forNativeShapes) {
                // For native G-code generation, return start and end points only
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

            if (resolution === 'HIGH' || resolution === 'ADAPTIVE') {
                // High resolution or adaptive arc approximation with proper clockwise handling
                const arcPoints: Point2D[] = [];
                let startAngle = arc.startAngle;
                let endAngle = arc.endAngle;

                // Normalize angles and handle clockwise arcs
                if (arc.clockwise) {
                    [startAngle, endAngle] = [endAngle, startAngle];
                }

                // Calculate arc span
                let span = endAngle - startAngle;
                if (span <= 0) span += 2 * Math.PI;

                const arcSegments =
                    resolution === 'ADAPTIVE'
                        ? Math.max(
                              LEAD_SEGMENT_COUNT,
                              Math.ceil(span / (Math.PI / LEAD_SEGMENT_COUNT))
                          )
                        : HIGH_RESOLUTION_CIRCLE_SEGMENTS;

                for (let i = 0; i <= arcSegments; i++) {
                    const angle = startAngle + (span * i) / arcSegments;
                    arcPoints.push({
                        x: arc.center.x + arc.radius * Math.cos(angle),
                        y: arc.center.y + arc.radius * Math.sin(angle),
                    });
                }
                return arcPoints;
            }

            if (mode === 'DIRECTION_ANALYSIS' || resolution === 'LOW') {
                // Sample a few points along the arc with proper direction handling
                const points: Point2D[] = [];
                const segments = QUARTER_CIRCLE_QUADRANTS;

                for (let i = 0; i <= segments; i++) {
                    let angle: number;
                    const t = i / segments;

                    if (arc.clockwise) {
                        // For clockwise arcs, interpolate in reverse direction
                        angle =
                            arc.startAngle +
                            t * (arc.endAngle - arc.startAngle);
                    } else {
                        // For counterclockwise arcs, use normal direction
                        angle =
                            arc.startAngle +
                            t * (arc.endAngle - arc.startAngle);
                    }

                    points.push({
                        x: arc.center.x + arc.radius * Math.cos(angle),
                        y: arc.center.y + arc.radius * Math.sin(angle),
                    });
                }
                return points;
            }

            // Default to existing generateArcPoints
            return generateArcPoints(arc);

        case GeometryType.POLYLINE:
            const polyline: Polyline = shape.geometry as Polyline;
            // Always return a copy to prevent mutation
            return [...polylineToPoints(polyline)];

        case GeometryType.ELLIPSE:
            const ellipse: Ellipse = shape.geometry as Ellipse;

            if (mode === 'CHAIN_DETECTION') {
                // Calculate major and minor axis lengths
                const majorAxisLength: number = Math.sqrt(
                    ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
                        ellipse.majorAxisEndpoint.y *
                            ellipse.majorAxisEndpoint.y
                );
                const minorAxisLength: number =
                    majorAxisLength * ellipse.minorToMajorRatio;

                // Calculate rotation angle of major axis
                const majorAxisAngle: number = Math.atan2(
                    ellipse.majorAxisEndpoint.y,
                    ellipse.majorAxisEndpoint.x
                );

                if (
                    typeof ellipse.startParam === 'number' &&
                    typeof ellipse.endParam === 'number'
                ) {
                    // Ellipse arc - return start and end points
                    const startParam: number = ellipse.startParam;
                    const endParam: number = ellipse.endParam;

                    // Calculate start point
                    const startX: number =
                        majorAxisLength * Math.cos(startParam);
                    const startY: number =
                        minorAxisLength * Math.sin(startParam);
                    const rotatedStartX: number =
                        startX * Math.cos(majorAxisAngle) -
                        startY * Math.sin(majorAxisAngle);
                    const rotatedStartY: number =
                        startX * Math.sin(majorAxisAngle) +
                        startY * Math.cos(majorAxisAngle);

                    // Calculate end point
                    const endX: number = majorAxisLength * Math.cos(endParam);
                    const endY: number = minorAxisLength * Math.sin(endParam);
                    const rotatedEndX: number =
                        endX * Math.cos(majorAxisAngle) -
                        endY * Math.sin(majorAxisAngle);
                    const rotatedEndY: number =
                        endX * Math.sin(majorAxisAngle) +
                        endY * Math.cos(majorAxisAngle);

                    return [
                        {
                            x: ellipse.center.x + rotatedStartX,
                            y: ellipse.center.y + rotatedStartY,
                        }, // Start point
                        {
                            x: ellipse.center.x + rotatedEndX,
                            y: ellipse.center.y + rotatedEndY,
                        }, // End point
                        ellipse.center, // Center for connectivity analysis
                    ];
                } else {
                    // Full ellipse - return key points around the perimeter
                    const points: Point2D[] = [];

                    // Sample key points around the ellipse perimeter (0°, 90°, 180°, 270°)
                    for (
                        let angle: number = 0;
                        angle < 2 * Math.PI;
                        angle += Math.PI / 2
                    ) {
                        const x: number = majorAxisLength * Math.cos(angle);
                        const y: number = minorAxisLength * Math.sin(angle);
                        const rotatedX: number =
                            x * Math.cos(majorAxisAngle) -
                            y * Math.sin(majorAxisAngle);
                        const rotatedY: number =
                            x * Math.sin(majorAxisAngle) +
                            y * Math.cos(majorAxisAngle);

                        points.push({
                            x: ellipse.center.x + rotatedX,
                            y: ellipse.center.y + rotatedY,
                        });
                    }

                    points.push(ellipse.center); // Add center point
                    return points;
                }
            }

            return tessellateEllipse(ellipse, ELLIPSE_TESSELLATION_POINTS);

        case GeometryType.SPLINE:
            const spline: Spline = shape.geometry as Spline;

            if (mode === 'CHAIN_DETECTION') {
                // For chain detection, start with fit points or control points as fallback
                const points: Point2D[] = [];

                // Use fit points if available (most accurate representation)
                if (spline.fitPoints && spline.fitPoints.length > 0) {
                    points.push(...spline.fitPoints);
                } else if (
                    spline.controlPoints &&
                    spline.controlPoints.length > 0
                ) {
                    // Fallback to control points if no fit points
                    points.push(...spline.controlPoints);
                }

                return [...points]; // Copy to prevent mutation
            }

            try {
                const tessellationPoints: number =
                    resolution === 'HIGH'
                        ? ELLIPSE_TESSELLATION_POINTS * 2
                        : ELLIPSE_TESSELLATION_POINTS;
                return tessellateSpline(spline, {
                    numSamples: tessellationPoints,
                }).points;
            } catch {
                // Fallback to fit points or control points if NURBS evaluation fails
                if (spline.fitPoints && spline.fitPoints.length > 0) {
                    return [...spline.fitPoints]; // Copy to prevent mutation
                } else if (
                    spline.controlPoints &&
                    spline.controlPoints.length > 0
                ) {
                    return [...spline.controlPoints]; // Copy to prevent mutation
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

            // Adaptive tessellation based on chord error tolerance
            // For a circular arc with radius r and tolerance t (max deviation):
            // The sagitta (chord height) s = r - r*cos(θ/2) where θ is the segment angle
            // Setting s = t and solving for θ: θ = 2*acos(1 - t/r)
            // Number of segments = arcSpan / θ = arcSpan / (2*acos(1 - t/r))
            const tolerance = params.arcTessellationTolerance;
            const radius = arc.radius;

            // Handle edge cases
            let numArcPoints: number;
            if (tolerance >= radius) {
                // Tolerance is larger than radius - use minimal tessellation (2 points = 1 segment)
                numArcPoints = 1;
            } else {
                // Calculate optimal segment angle for the given tolerance
                const segmentAngle = 2 * Math.acos(1 - tolerance / radius);
                // Calculate number of segments needed for the arc span
                const numSegments = Math.ceil(arcSpan / segmentAngle);
                // Clamp to reasonable bounds (minimum 1 segment, maximum 1000 segments)
                numArcPoints = Math.max(1, Math.min(1000, numSegments));
            }

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
                const sampledPoints: Point2D[] = tessellateSpline(spline, {
                    numSamples: HIGH_TESSELLATION_SEGMENTS,
                }).points;

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
                const points = tessellateSpline(spline).points;
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
 * Sample points along an array of shapes at regular distance intervals
 */

export function sampleShapesAtDistanceIntervals(
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
            const line: Line = shape.geometry as Line;
            scaled.geometry = {
                start: scalePoint(line.start),
                end: scalePoint(line.end),
            };
            break;

        case 'circle':
        case 'arc':
            const circle: Circle = shape.geometry as Circle | Arc;
            scaled.geometry = {
                ...circle,
                center: scalePoint(circle.center),
                radius: circle.radius * scaleFactor,
            };
            break;

        case 'polyline':
            const polyline: Polyline = shape.geometry as Polyline;
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
            const ellipse: Ellipse = shape.geometry as Ellipse;
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
            const line: Line = shape.geometry as Line;
            rotated.geometry = {
                start: rotatePoint(line.start),
                end: rotatePoint(line.end),
            };
            break;

        case 'circle':
            const circle: Circle = shape.geometry as Circle;
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
            const polyline: Polyline = shape.geometry as Polyline;
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
            const ellipse: Ellipse = shape.geometry as Ellipse;
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
            const line: Line = shape.geometry as Line;
            moved.geometry = {
                start: { x: line.start.x + delta.x, y: line.start.y + delta.y },
                end: { x: line.end.x + delta.x, y: line.end.y + delta.y },
            };
            break;

        case 'circle':
        case 'arc':
            const circle: Circle = shape.geometry as Circle | Arc;
            moved.geometry = {
                ...circle,
                center: {
                    x: circle.center.x + delta.x,
                    y: circle.center.y + delta.y,
                },
            };
            break;

        case 'polyline':
            const polyline: Polyline = shape.geometry as Polyline;
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
            const ellipse: Ellipse = shape.geometry as Ellipse;
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

/**
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

/**
 * Gets representative points from a shape
 */
export function getShapePoints2(shape: Shape): Point2D[] {
    switch (shape.type) {
        case GeometryType.LINE:
            const line: Line = shape.geometry as Line;
            return [line.start, line.end];

        case GeometryType.CIRCLE:
            const circle: Circle = shape.geometry as Circle;
            // Create polygon approximation of circle with 32 points
            const points: Point2D[] = [];
            const segments: number = 32;
            for (let i: number = 0; i < segments; i++) {
                const angle: number = (i * 2 * Math.PI) / segments;
                points.push({
                    x: circle.center.x + circle.radius * Math.cos(angle),
                    y: circle.center.y + circle.radius * Math.sin(angle),
                });
            }
            return points;

        case GeometryType.ARC:
            const arc: Arc = shape.geometry as Arc;
            // Create polygon approximation of arc
            const arcPoints: Point2D[] = [];
            let startAngle: number = arc.startAngle;
            let endAngle: number = arc.endAngle;

            // Normalize angles and handle clockwise arcs
            if (arc.clockwise) {
                [startAngle, endAngle] = [endAngle, startAngle];
            }

            // Calculate arc span
            let span: number = endAngle - startAngle;
            if (span <= 0) span += 2 * Math.PI;

            const arcSegments: number = Math.max(
                LEAD_SEGMENT_COUNT,
                Math.ceil(span / (Math.PI / LEAD_SEGMENT_COUNT))
            ); // At least 8 segments

            for (let i: number = 0; i <= arcSegments; i++) {
                const angle: number = startAngle + (span * i) / arcSegments;
                arcPoints.push({
                    x: arc.center.x + arc.radius * Math.cos(angle),
                    y: arc.center.y + arc.radius * Math.sin(angle),
                });
            }
            return arcPoints;

        case GeometryType.POLYLINE:
            const polyline: Polyline = shape.geometry as Polyline;
            return polylineToPoints(polyline);

        case GeometryType.ELLIPSE:
            const ellipse: Ellipse = shape.geometry as Ellipse;
            // Create polygon approximation of ellipse
            const ellipsePoints: Point2D[] = [];
            const ellipseSegments: number = 64; // More segments for ellipse to capture shape accurately

            // Determine if this is an ellipse arc or full ellipse
            const isArc: boolean =
                typeof ellipse.startParam === 'number' &&
                typeof ellipse.endParam === 'number';

            if (isArc) {
                // Ellipse arc - only sample between start and end parameters
                const startParam: number = ellipse.startParam!;
                const endParam: number = ellipse.endParam!;
                let paramSpan: number = endParam - startParam;

                // Handle parameter wrapping
                if (paramSpan <= 0) paramSpan += 2 * Math.PI;

                const numSegments: number = Math.max(
                    LEAD_SEGMENT_COUNT,
                    Math.ceil((ellipseSegments * paramSpan) / (2 * Math.PI))
                );

                const arcPoints = generateEllipsePoints(
                    ellipse,
                    startParam,
                    startParam + paramSpan,
                    numSegments + 1
                );
                ellipsePoints.push(...arcPoints);
            } else {
                // Full ellipse
                const fullEllipsePoints = generateEllipsePoints(
                    ellipse,
                    0,
                    2 * Math.PI,
                    ellipseSegments
                );
                ellipsePoints.push(...fullEllipsePoints);
            }

            return ellipsePoints;

        case GeometryType.SPLINE:
            const spline: Spline = shape.geometry as Spline;
            try {
                // Use NURBS sampling for accurate polygon representation
                return tessellateSpline(spline, {
                    numSamples: ELLIPSE_TESSELLATION_POINTS,
                }).points;
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
} /**
 * Checks if a single shape forms a closed loop
 */

export function isShapeClosed(shape: Shape, tolerance: number): boolean {
    switch (shape.type) {
        case GeometryType.CIRCLE:
            // Circles are always closed
            return true;

        case GeometryType.POLYLINE:
            const polyline: Polyline = shape.geometry as Polyline;
            const points: Point2D[] = polylineToPoints(polyline);
            if (!points || points.length < POLYGON_POINTS_MIN) return false;

            // CRITICAL FIX: For polylines, first check the explicit closed flag from DXF parsing
            // This is especially important for polylines with bulges where the geometric
            // first/last points don't represent the actual curve endpoints
            if (typeof polyline.closed === 'boolean') {
                return polyline.closed;
            }

            // Fallback: geometric check for polylines without explicit closure information
            const firstPoint: Point2D = points[0];
            const lastPoint: Point2D = points[points.length - 1];

            if (!firstPoint || !lastPoint) return false;

            // Check if first and last points are within tolerance
            const distance: number = Math.sqrt(
                Math.pow(firstPoint.x - lastPoint.x, 2) +
                    Math.pow(firstPoint.y - lastPoint.y, 2)
            );

            return distance <= tolerance;

        case GeometryType.ARC:
            // Arcs are open by definition (unless they're a full circle, but that would be a circle)
            return false;

        case GeometryType.LINE:
            // Lines are open by definition
            return false;

        case GeometryType.ELLIPSE:
            const ellipse: Ellipse = shape.geometry as Ellipse;
            // Use the centralized ellipse closed detection logic
            return isEllipseClosed(ellipse, GEOMETRIC_PRECISION_TOLERANCE);

        case GeometryType.SPLINE:
            const splineGeom: Spline = shape.geometry as Spline;

            // For splines, use proper NURBS evaluation to get actual start and end points
            let splineFirstPoint: Point2D | null = null;
            let splineLastPoint: Point2D | null = null;

            try {
                // Use NURBS evaluation for accurate endpoints
                splineFirstPoint = getSplineStartPoint(splineGeom);
                splineLastPoint = getSplineEndPoint(splineGeom);
            } catch {
                // Fallback to fit points if NURBS evaluation fails
                if (splineGeom.fitPoints && splineGeom.fitPoints.length > 0) {
                    splineFirstPoint = splineGeom.fitPoints[0];
                    splineLastPoint =
                        splineGeom.fitPoints[splineGeom.fitPoints.length - 1];
                } else if (
                    splineGeom.controlPoints &&
                    splineGeom.controlPoints.length > 0
                ) {
                    // Final fallback to control points
                    splineFirstPoint = splineGeom.controlPoints[0];
                    splineLastPoint =
                        splineGeom.controlPoints[
                            splineGeom.controlPoints.length - 1
                        ];
                }
            }

            if (!splineFirstPoint || !splineLastPoint) return false;

            // Check if first and last points are within tolerance
            const splineDistance: number = Math.sqrt(
                Math.pow(splineFirstPoint.x - splineLastPoint.x, 2) +
                    Math.pow(splineFirstPoint.y - splineLastPoint.y, 2)
            );

            return splineDistance <= tolerance;

        default:
            throw new Error(`Unknown type ${shape.type}`);
    }
}

/**
 * Get points from a shape for area calculation
 */
export function getShapePoints3(shape: Shape): Point2D[] {
    switch (shape.type) {
        case GeometryType.LINE:
            const line: Line = shape.geometry as Line;
            return [line.start, line.end];

        case GeometryType.CIRCLE:
            // For circles, we don't need to sample points to calculate direction
            // Circles are inherently counterclockwise in CAD coordinate systems
            // Return a simple set of points that will give us the correct orientation
            const circle: Circle = shape.geometry as Circle;
            // Create 4 points in counterclockwise order (right, top, left, bottom)
            return [
                { x: circle.center.x + circle.radius, y: circle.center.y }, // right
                { x: circle.center.x, y: circle.center.y + circle.radius }, // top
                { x: circle.center.x - circle.radius, y: circle.center.y }, // left
                { x: circle.center.x, y: circle.center.y - circle.radius }, // bottom
            ];

        case GeometryType.ARC:
            // Sample arc with points based on angle span, respecting clockwise property
            const arc: Arc = shape.geometry as Arc;
            const arcPoints: Point2D[] = [];
            const angleSpan: number = Math.abs(arc.endAngle - arc.startAngle);
            const numArcSamples: number = Math.max(
                QUARTER_CIRCLE_QUADRANTS,
                // eslint-disable-next-line no-magic-numbers
                Math.ceil(angleSpan / (Math.PI / 8))
            ); // At least 4 points

            for (let i: number = 0; i <= numArcSamples; i++) {
                const t: number = i / numArcSamples;
                let angle: number;

                if (arc.clockwise) {
                    // For clockwise arcs, reverse the direction
                    angle =
                        arc.startAngle + t * (arc.endAngle - arc.startAngle);
                } else {
                    // For counterclockwise arcs, use normal direction
                    angle =
                        arc.startAngle + t * (arc.endAngle - arc.startAngle);
                }

                arcPoints.push({
                    x: arc.center.x + arc.radius * Math.cos(angle),
                    y: arc.center.y + arc.radius * Math.sin(angle),
                });
            }
            return arcPoints;

        case GeometryType.POLYLINE:
            const polyline: Polyline = shape.geometry as Polyline;
            return [...polylineToPoints(polyline)]; // Copy to avoid mutation

        case GeometryType.SPLINE:
            // Sample spline with multiple points for accurate area calculation
            const spline: Spline = shape.geometry as Spline;
            const splinePoints: Point2D[] = [];
            const numSplineSamples: number = Math.max(
                STANDARD_GRID_SPACING,
                spline.controlPoints.length * TESSELLATION_SAMPLE_MULTIPLIER
            );

            for (let i: number = 0; i <= numSplineSamples; i++) {
                const t: number = i / numSplineSamples;
                // Simple linear interpolation for now - could be improved with actual spline evaluation
                const segmentIndex: number = Math.min(
                    Math.floor(t * (spline.controlPoints.length - 1)),
                    spline.controlPoints.length - 2
                );
                const localT: number =
                    t * (spline.controlPoints.length - 1) - segmentIndex;

                const p1: Point2D = spline.controlPoints[segmentIndex];
                const p2: Point2D = spline.controlPoints[segmentIndex + 1];

                splinePoints.push({
                    x: p1.x + localT * (p2.x - p1.x),
                    y: p1.y + localT * (p2.y - p1.y),
                });
            }
            return splinePoints;

        case GeometryType.ELLIPSE:
            // Sample ellipse with multiple points for accurate area calculation
            const ellipse: Ellipse = shape.geometry as Ellipse;
            const ellipsePoints: Point2D[] = [];

            // Check if it's a full ellipse or elliptical arc
            if (
                ellipse.startParam !== undefined &&
                ellipse.endParam !== undefined
            ) {
                // It's an elliptical arc
                const paramSpan: number = ellipse.endParam - ellipse.startParam;
                const numEllipseSamples: number = Math.max(
                    OCTAGON_SIDES,
                    // eslint-disable-next-line no-magic-numbers
                    Math.ceil(Math.abs(paramSpan) / (Math.PI / 8))
                );

                for (let i: number = 0; i <= numEllipseSamples; i++) {
                    const t: number = i / numEllipseSamples;
                    const param: number =
                        ellipse.startParam +
                        t * (ellipse.endParam - ellipse.startParam);
                    ellipsePoints.push(calculateEllipsePoint2(ellipse, param));
                }
            } else {
                // It's a full ellipse - sample points around the complete ellipse
                const numEllipseSamples: number = DEFAULT_TESSELLATION_SEGMENTS;
                for (let i: number = 0; i < numEllipseSamples; i++) {
                    const param: number = (i / numEllipseSamples) * 2 * Math.PI;
                    ellipsePoints.push(calculateEllipsePoint2(ellipse, param));
                }
            }

            return ellipsePoints;

        default:
            return [];
    }
} /**
 * Split a shape at its midpoint, creating two shapes
 * Extracted from optimize-start-points.ts to eliminate duplication
 */

export function splitShapeAtMidpoint(shape: Shape): [Shape, Shape] | null {
    if (shape.type === GeometryType.LINE) {
        return splitLineAtMidpoint(shape);
    } else if (shape.type === GeometryType.ARC) {
        return splitArcAtMidpoint(shape);
    }

    return null;
}
export function transformShape(
    shape: Shape,
    transform: {
        insertX: number;
        insertY: number;
        scaleX: number;
        scaleY: number;
        rotationRad: number;
        blockBaseX: number;
        blockBaseY: number;
    }
): Shape | null {
    const {
        insertX,
        insertY,
        scaleX,
        scaleY,
        rotationRad,
        blockBaseX,
        blockBaseY,
    } = transform;
    const clonedShape: Shape = JSON.parse(JSON.stringify(shape));

    const transformPoint: (p: Point2D) => Point2D = (p: Point2D): Point2D => {
        // Step 1: Translate by negative block base point (block origin)
        let x: number = p.x - blockBaseX;
        let y: number = p.y - blockBaseY;

        // Step 2: Apply scaling
        x = x * scaleX;
        y = y * scaleY;

        // Step 3: Apply rotation
        if (rotationRad !== 0) {
            const cos: number = Math.cos(rotationRad);
            const sin: number = Math.sin(rotationRad);
            const newX: number = x * cos - y * sin;
            const newY: number = x * sin + y * cos;
            x = newX;
            y = newY;
        }

        // Step 4: Apply INSERT position translation
        x += insertX;
        y += insertY;

        return { x, y };
    };

    // Transform geometry based on shape type
    switch (clonedShape.type) {
        case GeometryType.LINE:
            const line: Line = clonedShape.geometry as Line;
            line.start = transformPoint(line.start);
            line.end = transformPoint(line.end);
            break;

        case GeometryType.CIRCLE:
        case GeometryType.ARC:
            const circleOrArc: Circle | Arc = clonedShape.geometry as
                | Circle
                | Arc;
            circleOrArc.center = transformPoint(circleOrArc.center);
            // Scale radius (use average of scaleX and scaleY for uniform scaling)
            circleOrArc.radius *= (scaleX + scaleY) / SCALING_AVERAGE_DIVISOR;
            // Adjust arc angles for rotation
            if (clonedShape.type === GeometryType.ARC && rotationRad !== 0) {
                const arc: Arc = circleOrArc as Arc;
                arc.startAngle += rotationRad;
                arc.endAngle += rotationRad;
            }
            break;

        case GeometryType.POLYLINE:
            const polyline: Polyline = clonedShape.geometry as Polyline;
            // Transform all shapes
            polyline.shapes = polyline.shapes.map((shape) => {
                const segment = shape.geometry;
                if ('start' in segment && 'end' in segment) {
                    // Line segment
                    return {
                        ...shape,
                        geometry: {
                            start: transformPoint(segment.start),
                            end: transformPoint(segment.end),
                        },
                    };
                } else if ('center' in segment && 'radius' in segment) {
                    // Arc segment
                    const arc: Arc = { ...segment } as Arc;
                    arc.center = transformPoint(arc.center);
                    // Scale radius (use average of scaleX and scaleY for uniform scaling)
                    arc.radius *= (scaleX + scaleY) / SCALING_AVERAGE_DIVISOR;
                    // Adjust arc angles for rotation
                    if (rotationRad !== 0) {
                        arc.startAngle += rotationRad;
                        arc.endAngle += rotationRad;
                    }
                    return {
                        ...shape,
                        geometry: arc,
                    };
                }
                return shape;
            });
            break;

        case GeometryType.ELLIPSE:
            const ellipse: Ellipse = clonedShape.geometry as Ellipse;
            ellipse.center = transformPoint(ellipse.center);
            // Transform the major axis endpoint vector
            const majorAxisEnd: Point2D = {
                x: ellipse.center.x + ellipse.majorAxisEndpoint.x,
                y: ellipse.center.y + ellipse.majorAxisEndpoint.y,
            };
            const transformedMajorAxisEnd: Point2D =
                transformPoint(majorAxisEnd);
            ellipse.majorAxisEndpoint = {
                x: transformedMajorAxisEnd.x - ellipse.center.x,
                y: transformedMajorAxisEnd.y - ellipse.center.y,
            };
            // Note: minorToMajorRatio stays the same as it's a proportion
            break;

        default:
            console.warn(
                `Unknown shape type for transformation: ${clonedShape.type}`
            );
            return null;
    }

    // Generate new ID for transformed shape
    clonedShape.id = generateId();

    return clonedShape;
}
