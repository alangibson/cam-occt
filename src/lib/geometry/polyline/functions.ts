import type {
    Circle,
    Ellipse,
    Line,
    Point2D,
    Shape,
} from '$lib/types/geometry';
import type { Spline } from '$lib/geometry/spline';
import type { Arc } from '$lib/geometry/arc';
import { GeometryType } from '$lib/geometry/shape';
import { generateId } from '$lib/domain/id';
import {
    calculateArcPoint,
    convertBulgeToArc,
    getArcTangent,
} from '$lib/geometry/arc/functions';
import { getLineTangent } from '$lib/geometry/line/functions';
import { EPSILON } from '$lib/geometry/math';
import {
    DIRECTION_CLOCKWISE,
    DIRECTION_COUNTERCLOCKWISE,
} from '$lib/geometry/constants';
import type { Polyline, PolylineVertex } from './interfaces';

function createBulgeOrLineShape(
    start: PolylineVertex,
    end: Point2D,
    bulge?: number
): Shape {
    if (bulge !== undefined && bulge !== 0) {
        const arc: Arc | null = convertBulgeToArc(bulge, start, end);
        if (arc) {
            return {
                id: generateId(),
                type: GeometryType.ARC,
                geometry: arc,
            };
        }
    }

    // Fallback to line if no bulge or arc conversion fails
    return {
        id: generateId(),
        type: GeometryType.LINE,
        geometry: {
            start: { x: start.x, y: start.y },
            end: { x: end.x, y: end.y },
        } as Line,
    };
}

export function createPolylineFromVertices(
    vertices: PolylineVertex[],
    closed: boolean,
    options: {
        id?: string;
        layer?: string;
        originalType?: string;
        metadata?: Record<string, string | number | boolean>;
    } = {}
): Shape {
    if (!vertices || vertices.length === 0) {
        throw new Error('Polyline must have at least one vertex');
    }

    // Validate vertices
    const validVertices: PolylineVertex[] = vertices.filter(
        (v) =>
            v &&
            typeof v.x === 'number' &&
            typeof v.y === 'number' &&
            !isNaN(v.x) &&
            !isNaN(v.y)
    );

    if (validVertices.length === 0) {
        throw new Error('Polyline must have at least one valid vertex');
    }

    // Create a copy of vertices to avoid mutation and ensure bulge defaults to 0
    const polylineVertices: PolylineVertex[] = validVertices.map((v) => ({
        x: v.x,
        y: v.y,
        bulge: v.bulge ?? 0,
    }));

    // For closed polylines, ensure start and end points are coincident
    if (closed && polylineVertices.length > 1) {
        const firstVertex: PolylineVertex = polylineVertices[0];
        const lastVertex: PolylineVertex =
            polylineVertices[polylineVertices.length - 1];

        // If not already coincident, duplicate the first vertex at the end
        if (firstVertex.x !== lastVertex.x || firstVertex.y !== lastVertex.y) {
            polylineVertices.push({
                x: firstVertex.x,
                y: firstVertex.y,
                bulge: 0,
            });
        }
    }

    // Generate shapes array from vertices
    const shapes: Shape[] = generateSegments(polylineVertices, closed);

    const geometry: Polyline = {
        closed,
        shapes,
    };

    return {
        id: options.id || generateId(),
        type: GeometryType.POLYLINE,
        geometry,
        ...(options.layer && { layer: options.layer }),
        ...(options.originalType && { originalType: options.originalType }),
        ...(options.metadata && { metadata: options.metadata }),
    };
}

export function getPolylineStartPoint(polyline: Polyline): Point2D {
    const points: Point2D[] = polylineToPoints(polyline);
    return points[0];
}

export function getPolylineEndPoint(polyline: Polyline): Point2D {
    const points: Point2D[] = polylineToPoints(polyline);
    return points[points.length - 1];
}

/**
 * Generate segments array from vertices (with bulge data)
 */
export function generateSegments(
    vertices: PolylineVertex[],
    closed: boolean = false
): Shape[] {
    const segments: Shape[] = [];
    const sourcePoints: PolylineVertex[] = vertices;

    if (sourcePoints.length < 2) {
        return segments;
    }

    // Create segments between consecutive points
    for (let i: number = 0; i < sourcePoints.length - 1; i++) {
        const start: PolylineVertex = sourcePoints[i];
        const end: PolylineVertex = sourcePoints[i + 1];

        // Check if start point has bulge data (for vertices array)
        const bulge: number | undefined =
            'bulge' in start && typeof start.bulge === 'number'
                ? start.bulge
                : undefined;

        segments.push(createBulgeOrLineShape(start, end, bulge));
    }

    // Handle closed polylines - create segment from last point back to first
    // Only if the points don't already form a closed loop
    if (closed && sourcePoints.length > 2) {
        const start: PolylineVertex = sourcePoints[sourcePoints.length - 1];
        const end: PolylineVertex = sourcePoints[0];

        // Check if closing segment would be degenerate (last point = first point)
        // Use global EPSILON for floating point comparison
        const isAlreadyClosed: boolean =
            Math.abs(start.x - end.x) < EPSILON &&
            Math.abs(start.y - end.y) < EPSILON;

        if (!isAlreadyClosed) {
            const bulge: number | undefined =
                'bulge' in start && typeof start.bulge === 'number'
                    ? start.bulge
                    : undefined;

            segments.push(createBulgeOrLineShape(start, end, bulge));
        }
    }

    return segments;
}

/**
 * Extract vertices array from polyline, returning existing vertices or generating from segments
 */
export function polylineToVertices(polyline: Polyline): PolylineVertex[] {
    // Note: Since vertices are no longer stored directly on polyline,
    // we need to reconstruct them from segments

    // If no vertices but we have shapes, reconstruct vertices with bulge data
    if (polyline.shapes) {
        const vertices: PolylineVertex[] = [];

        for (let i: number = 0; i < polyline.shapes.length; i++) {
            const segment: Line | Arc | Circle | Polyline | Ellipse | Spline =
                polyline.shapes[i].geometry;

            if ('start' in segment && 'end' in segment) {
                // Line segment - add start point with no bulge
                vertices.push({
                    x: segment.start.x,
                    y: segment.start.y,
                    bulge: 0,
                });
            } else if ('center' in segment && 'radius' in segment) {
                // Arc segment - reconstruct bulge value
                const arc = segment as Arc;

                // Calculate start point from arc
                const startPoint: Point2D = calculateArcPoint(
                    arc.center,
                    arc.radius,
                    arc.startAngle
                );

                // Calculate bulge from arc properties
                // For arcs, we need to calculate the included angle and convert to bulge
                let includedAngle: number = arc.endAngle - arc.startAngle;

                // Handle angle wrapping
                if (arc.clockwise) {
                    if (includedAngle > 0) includedAngle -= 2 * Math.PI;
                    includedAngle = Math.abs(includedAngle);
                } else {
                    if (includedAngle < 0) includedAngle += 2 * Math.PI;
                }

                // Convert angle to bulge: bulge = tan(θ/4)
                const bulge: number =
                    // eslint-disable-next-line no-magic-numbers
                    Math.tan(includedAngle / 4) *
                    (arc.clockwise
                        ? DIRECTION_CLOCKWISE
                        : DIRECTION_COUNTERCLOCKWISE);

                vertices.push({
                    x: startPoint.x,
                    y: startPoint.y,
                    bulge: bulge,
                });
            }
        }

        // For non-closed polylines, add the final end point
        if (!polyline.closed && polyline.shapes.length > 0) {
            const lastSegment:
                | Line
                | Arc
                | Circle
                | Polyline
                | Ellipse
                | Spline = polyline.shapes[polyline.shapes.length - 1].geometry;
            if ('start' in lastSegment && 'end' in lastSegment) {
                vertices.push({
                    x: lastSegment.end.x,
                    y: lastSegment.end.y,
                    bulge: 0,
                });
            } else if ('center' in lastSegment && 'radius' in lastSegment) {
                const arc: Arc = lastSegment as Arc;
                const endPoint: Point2D = calculateArcPoint(
                    arc.center,
                    arc.radius,
                    arc.endAngle
                );

                vertices.push({
                    x: endPoint.x,
                    y: endPoint.y,
                    bulge: 0,
                });
            }
        }

        return vertices;
    }

    // Backward compatibility: Handle old polyline format with points array
    if (
        'points' in polyline &&
        Array.isArray((polyline as { points: Point2D[] }).points)
    ) {
        return (polyline as { points: Point2D[] }).points.map(
            (point: Point2D) => ({
                x: point.x,
                y: point.y,
                bulge: 0,
            })
        );
    }

    // Fallback to points array without bulge data
    const points: Point2D[] = polylineToPoints(polyline);
    return points.map((point) => ({ ...point, bulge: 0 }));
}

/**
 * Extract points array from polyline, returning existing points or generating from segments
 */
export function polylineToPoints(polyline: Polyline): Point2D[] {
    // Reconstruct points from segments (points no longer stored directly)
    if (polyline.shapes) {
        const points: Point2D[] = [];

        for (let i: number = 0; i < polyline.shapes.length; i++) {
            const segment: Line | Arc | Circle | Polyline | Ellipse | Spline =
                polyline.shapes[i].geometry;

            if ('start' in segment && 'end' in segment) {
                // Line segment - add start point
                points.push({ x: segment.start.x, y: segment.start.y });
            } else if ('center' in segment && 'radius' in segment) {
                // Arc segment - add start point (calculated from arc properties)
                const arc = segment as Arc;
                const startPoint: Point2D = calculateArcPoint(
                    arc.center,
                    arc.radius,
                    arc.startAngle
                );
                points.push(startPoint);
            }
        }

        // For non-closed polylines, add the final end point
        if (!polyline.closed && polyline.shapes.length > 0) {
            const lastSegment:
                | Line
                | Arc
                | Circle
                | Polyline
                | Ellipse
                | Spline = polyline.shapes[polyline.shapes.length - 1].geometry;
            if ('start' in lastSegment && 'end' in lastSegment) {
                points.push({ x: lastSegment.end.x, y: lastSegment.end.y });
            } else if ('center' in lastSegment && 'radius' in lastSegment) {
                const arc: Arc = lastSegment as Arc;
                const endPoint: Point2D = calculateArcPoint(
                    arc.center,
                    arc.radius,
                    arc.endAngle
                );
                points.push(endPoint);
            }
        }

        // For closed polylines, ensure start and end points are coincident
        if (polyline.closed && points.length > 1) {
            const firstPoint: Point2D = points[0];
            const lastPoint: Point2D = points[points.length - 1];

            // If not already coincident, duplicate the first point at the end
            if (firstPoint.x !== lastPoint.x || firstPoint.y !== lastPoint.y) {
                points.push({ x: firstPoint.x, y: firstPoint.y });
            }
        }

        return points;
    }

    // Backward compatibility: Handle old polyline format with points array
    if (
        'points' in polyline &&
        Array.isArray((polyline as { points: Point2D[] }).points)
    ) {
        return (polyline as { points: Point2D[] }).points;
    }

    // Fallback - this shouldn't happen in normal usage
    return [];
}

/**
 * Reverses a polyline by reversing its segments array and flipping the direction of each segment.
 * For Line segments, swaps start and end points.
 * For Arc segments, swaps start/end angles and flips the clockwise direction.
 *
 * @param polyline The polyline to reverse
 * @returns A new polyline with segments in reverse order and direction
 */
export function reversePolyline(polyline: Polyline): Polyline {
    if (!polyline.shapes || polyline.shapes.length === 0) {
        return polyline;
    }

    // Reverse the shapes array
    const reversedShapes: Shape[] = [...polyline.shapes]
        .reverse()
        .map((shape) => {
            const segment: Line | Arc | Circle | Polyline | Ellipse | Spline =
                shape.geometry;
            if ('start' in segment && 'end' in segment) {
                // Line segment - swap start and end points
                return {
                    ...shape,
                    geometry: {
                        start: segment.end,
                        end: segment.start,
                    } as Line,
                };
            } else if ('center' in segment && 'radius' in segment) {
                // Arc segment - swap start/end angles and flip clockwise direction
                const arc: Arc = segment as Arc;
                return {
                    ...shape,
                    geometry: {
                        center: arc.center,
                        radius: arc.radius,
                        startAngle: arc.endAngle,
                        endAngle: arc.startAngle,
                        clockwise: !arc.clockwise,
                    } as Arc,
                };
            }
            return shape;
        });

    return {
        closed: polyline.closed,
        shapes: reversedShapes,
    };
}

export function getPolylinePointAt(polyline: Polyline, t: number): Point2D {
    const points: Point2D[] = polylineToPoints(polyline);
    if (!points || points.length === 0) return { x: 0, y: 0 };

    const totalLength: number = points.reduce(
        (sum: number, pt: Point2D, i: number) => {
            if (i === 0) return 0;
            const dx: number = pt.x - points[i - 1].x;
            const dy: number = pt.y - points[i - 1].y;
            return sum + Math.sqrt(dx * dx + dy * dy);
        },
        0
    );

    const targetLength: number = t * totalLength;
    let currentLength: number = 0;

    for (let i: number = 1; i < points.length; i++) {
        const p1: Point2D = points[i - 1];
        const p2: Point2D = points[i];
        const dx: number = p2.x - p1.x;
        const dy: number = p2.y - p1.y;
        const segmentLength: number = Math.sqrt(dx * dx + dy * dy);

        if (currentLength + segmentLength >= targetLength) {
            const segmentT: number =
                (targetLength - currentLength) / segmentLength;
            return {
                x: p1.x + segmentT * dx,
                y: p1.y + segmentT * dy,
            };
        }

        currentLength += segmentLength;
    }

    return points[points.length - 1];
}
/**
 * Calculate total length of a polyline from its points
 * @param points - Array of 2D points
 * @returns Total length of the polyline
 */

export function calculatePolylineLength(points: Point2D[]): number {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
}
/**
 * Get tangent direction for a polyline geometry at start or end.
 */
export function getPolylineTangent(
    polyline: Polyline,
    isStart: boolean
): Point2D {
    // For polylines containing arc/line segments, get tangent from actual geometry
    if (polyline.shapes && polyline.shapes.length > 0) {
        const shape = isStart
            ? polyline.shapes[0]
            : polyline.shapes[polyline.shapes.length - 1];

        switch (shape.type) {
            case GeometryType.ARC: {
                const arc = shape.geometry as Arc;
                return getArcTangent(arc, isStart);
            }
            case GeometryType.LINE: {
                const line = shape.geometry as Line;
                return getLineTangent(line);
            }
            default:
                // Fallback to point-based calculation
                break;
        }
    }

    // Fallback: use point-based tangent calculation for simple polylines
    const points: Point2D[] = polylineToPoints(polyline);
    if (isStart && points.length >= 2) {
        const dx: number = points[1].x - points[0].x;
        const dy: number = points[1].y - points[0].y;
        const len: number = Math.sqrt(dx * dx + dy * dy);
        return len > 0 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };
    } else if (!isStart && points.length >= 2) {
        const n: number = points.length;
        const dx: number = points[n - 1].x - points[n - 2].x;
        const dy: number = points[n - 1].y - points[n - 2].y;
        const len: number = Math.sqrt(dx * dx + dy * dy);
        return len > 0 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };
    }
    return { x: 1, y: 0 };
}
