import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Shape, Point2D } from '$lib/types/geometry';
import type { Spline } from '$lib/geometry/spline';
import { GeometryType } from '$lib/types/geometry';
import type { Arc } from '$lib/geometry/arc';
import type { Line } from '$lib/geometry/line';
import type { Circle } from '$lib/geometry/circle';
import type { Polyline } from '$lib/geometry/polyline';
import type { Ellipse } from '$lib/geometry/ellipse';
import { CutDirection } from '$lib/types/direction';
import { getShapeEndPoint } from '$lib/geometry/shape/functions';
import { getShapeStartPoint } from '$lib/geometry/shape/functions';
import { STANDARD_GRID_SPACING } from '../constants';
import { CHAIN_CLOSURE_TOLERANCE } from '$lib/geometry/chain';
import { polylineToPoints } from '$lib/geometry/polyline';
import { calculateSquaredDistance } from '$lib/geometry/math';
import { POLYGON_POINTS_MIN } from '$lib/geometry/chain';
import {
    DEFAULT_TESSELLATION_SEGMENTS,
    QUARTER_CIRCLE_QUADRANTS,
    OCTAGON_SIDES,
    TESSELLATION_SAMPLE_MULTIPLIER,
} from '$lib/geometry/constants';

/**
 * Detects the cut direction of a chain using the shoelace formula (signed area calculation).
 *
 * For closed chains:
 * - Positive signed area = counterclockwise
 * - Negative signed area = clockwise
 *
 * For open chains:
 * - Returns 'none' as they don't have a natural cut direction
 */
export function detectCutDirection(
    chain: Chain,
    tolerance: number = CHAIN_CLOSURE_TOLERANCE
): CutDirection {
    if (!chain || !chain.shapes || chain.shapes.length === 0) {
        return CutDirection.NONE;
    }

    // Check if chain is closed by comparing first and last points
    const firstPoint: Point2D = getShapeStartPoint(chain.shapes[0]);
    const lastPoint: Point2D = getShapeEndPoint(
        chain.shapes[chain.shapes.length - 1]
    );

    if (!isPointsClosed(firstPoint, lastPoint, tolerance)) {
        return CutDirection.NONE; // Open paths don't have a natural cut direction
    }

    // Get all points from the chain
    const points: Point2D[] = getChainPoints(chain);

    if (points.length < POLYGON_POINTS_MIN) {
        return CutDirection.NONE; // Need at least 3 points to determine direction
    }

    // Calculate signed area using shoelace formula
    const signedArea: number = calculateSignedArea(points);

    // Positive area = counterclockwise, negative area = clockwise
    return signedArea > 0
        ? CutDirection.COUNTERCLOCKWISE
        : CutDirection.CLOCKWISE;
}

/**
 * Calculate a point on an ellipse at a given parameter
 */
export function calculateEllipsePoint(
    ellipse: Ellipse,
    param: number
): Point2D {
    // Calculate major and minor axis lengths
    const majorAxisLength: number = Math.sqrt(
        ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
            ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
    );
    const minorAxisLength: number = majorAxisLength * ellipse.minorToMajorRatio;

    // Calculate major axis angle
    const majorAxisAngle: number = Math.atan2(
        ellipse.majorAxisEndpoint.y,
        ellipse.majorAxisEndpoint.x
    );

    // Calculate point on canonical ellipse (axes aligned)
    const canonicalX: number = majorAxisLength * Math.cos(param);
    const canonicalY: number = minorAxisLength * Math.sin(param);

    // Rotate by major axis angle and translate to center
    const cos: number = Math.cos(majorAxisAngle);
    const sin: number = Math.sin(majorAxisAngle);

    return {
        x: ellipse.center.x + canonicalX * cos - canonicalY * sin,
        y: ellipse.center.y + canonicalX * sin + canonicalY * cos,
    };
}

/**
 * Check if two points are within tolerance (chain is closed)
 */
function isPointsClosed(
    point1: Point2D,
    point2: Point2D,
    tolerance: number
): boolean {
    const distance: number = Math.sqrt(
        calculateSquaredDistance(point1, point2)
    );
    return distance <= tolerance;
}

/**
 * Extract all points from a chain for area calculation
 */
function getChainPoints(chain: Chain): Point2D[] {
    const points: Point2D[] = [];

    for (const shape of chain.shapes) {
        const shapePoints: Point2D[] = getShapePoints(shape);
        points.push(...shapePoints);
    }

    return points;
}

/**
 * Get points from a shape for area calculation
 */
function getShapePoints(shape: Shape): Point2D[] {
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
                    ellipsePoints.push(calculateEllipsePoint(ellipse, param));
                }
            } else {
                // It's a full ellipse - sample points around the complete ellipse
                const numEllipseSamples: number = DEFAULT_TESSELLATION_SEGMENTS;
                for (let i: number = 0; i < numEllipseSamples; i++) {
                    const param: number = (i / numEllipseSamples) * 2 * Math.PI;
                    ellipsePoints.push(calculateEllipsePoint(ellipse, param));
                }
            }

            return ellipsePoints;

        default:
            return [];
    }
}

/**
 * Calculate signed area using the shoelace formula
 * Positive area indicates counterclockwise orientation
 * Negative area indicates clockwise orientation
 */
function calculateSignedArea(points: Point2D[]): number {
    if (points.length < POLYGON_POINTS_MIN) return 0;

    let area: number = 0;
    const n: number = points.length;

    for (let i: number = 0; i < n; i++) {
        const j: number = (i + 1) % n;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }

    return area / 2;
}
