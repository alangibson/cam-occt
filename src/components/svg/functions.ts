import { Shape } from '$lib/cam/shape/classes';
import { calculateArcPoint } from '$lib/geometry/arc/functions';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { DxfPolyline } from '$lib/geometry/dxf-polyline/interfaces';
import { sampleEllipse } from '$lib/geometry/ellipse/functions';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import type { Line } from '$lib/geometry/line/interfaces';
import { tessellateSpline } from '$lib/geometry/spline/functions';
import type { Spline } from '$lib/geometry/spline/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import { EPSILON } from '$lib/geometry/math/constants';

// Constants
const ANGLE_FULL_ROTATION = Math.PI * 2;
const ELLIPSE_TESSELLATION_POINTS = 64;

/**
 * Transform X coordinate from CNC to SVG coordinate system
 */
export function transformX(x: number, offsetX: number): number {
    return x - offsetX;
}

/**
 * Transform Y coordinate from CNC (Y-up) to SVG (Y-down) coordinate system
 */
export function transformY(
    y: number,
    height: number,
    offsetY: number,
    flipY: boolean
): number {
    if (flipY) {
        return height - (y - offsetY); // CNC Y-up to SVG Y-down conversion
    } else {
        return y - offsetY; // Direct transformation without flipping
    }
}

/**
 * Transform a point from CNC to SVG coordinate system
 */
export function transformPoint(
    point: Point2D,
    height: number,
    offset: Point2D,
    flipY: boolean
): Point2D {
    return {
        x: transformX(point.x, offset.x),
        y: transformY(point.y, height, offset.y, flipY),
    };
}

/**
 * Convert point array to SVG path data
 */
export function pointsToPathData(
    points: Point2D[],
    closed: boolean,
    height: number,
    offset: Point2D,
    flipY: boolean
): string {
    if (!points || points.length === 0) {
        return '';
    }

    const transformedPoints = points.map((p) =>
        transformPoint(p, height, offset, flipY)
    );

    let pathData = `M ${transformedPoints[0].x} ${transformedPoints[0].y}`;
    for (let i = 1; i < transformedPoints.length; i++) {
        pathData += ` L ${transformedPoints[i].x} ${transformedPoints[i].y}`;
    }
    if (closed) {
        pathData += ' Z';
    }
    return pathData;
}

/**
 * Generate SVG path data for a line
 */
export function lineToPathData(
    line: Line,
    height: number,
    offset: Point2D,
    flipY: boolean
): string {
    const start = transformPoint(line.start, height, offset, flipY);
    const end = transformPoint(line.end, height, offset, flipY);
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}

/**
 * Generate SVG path data for an arc with correct sweep direction
 * Based on SVGBuilder implementation (lines 591-676)
 */
export function arcToPathData(
    arc: Arc,
    height: number,
    offset: Point2D,
    flipY: boolean
): string {
    // Calculate start and end points in CNC coordinates
    const arcStart = calculateArcPoint(arc.center, arc.radius, arc.startAngle);
    const arcEnd = calculateArcPoint(arc.center, arc.radius, arc.endAngle);

    // Transform to SVG coordinates
    const startX = transformX(arcStart.x, offset.x);
    const startY = transformY(arcStart.y, height, offset.y, flipY);
    const endX = transformX(arcEnd.x, offset.x);
    const endY = transformY(arcEnd.y, height, offset.y, flipY);

    // Calculate the actual sweep angle considering arc direction
    let sweepAngle: number;

    if (arc.clockwise) {
        // For clockwise arcs: measure from startAngle to endAngle going clockwise
        let normalizedStart = arc.startAngle;
        let normalizedEnd = arc.endAngle;

        while (normalizedStart < 0) normalizedStart += ANGLE_FULL_ROTATION;
        while (normalizedStart >= ANGLE_FULL_ROTATION)
            normalizedStart -= ANGLE_FULL_ROTATION;
        while (normalizedEnd < 0) normalizedEnd += ANGLE_FULL_ROTATION;
        while (normalizedEnd >= ANGLE_FULL_ROTATION)
            normalizedEnd -= ANGLE_FULL_ROTATION;

        if (normalizedStart >= normalizedEnd) {
            sweepAngle = normalizedStart - normalizedEnd;
        } else {
            sweepAngle = ANGLE_FULL_ROTATION - normalizedEnd + normalizedStart;
        }
    } else {
        // For counter-clockwise arcs: measure from startAngle to endAngle going counter-clockwise
        if (arc.endAngle >= arc.startAngle) {
            sweepAngle = arc.endAngle - arc.startAngle;
        } else {
            sweepAngle = ANGLE_FULL_ROTATION - arc.startAngle + arc.endAngle;
        }
    }

    // SVG large-arc-flag: 1 if the arc span is greater than 180° (π radians), 0 otherwise
    const largeArcFlag = sweepAngle > Math.PI + EPSILON ? 1 : 0;

    // Convert Arc.clockwise boolean to SVG sweep-flag (1 = clockwise, 0 = counter-clockwise)
    // The Arc interface already contains the correct sweep direction from DXF parsing
    const sweepFlag = arc.clockwise ? 1 : 0;

    return `M ${startX} ${startY} A ${arc.radius} ${arc.radius} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${endY}`;
}

/**
 * Generate SVG path data for a circle
 */
export function circleToPathData(
    circle: Circle,
    height: number,
    offset: Point2D,
    flipY: boolean
): string {
    const center = transformPoint(circle.center, height, offset, flipY);
    const r = circle.radius;
    // Draw circle as two arcs
    return `M ${center.x - r} ${center.y} A ${r} ${r} 0 1 0 ${center.x + r} ${center.y} A ${r} ${r} 0 1 0 ${center.x - r} ${center.y}`;
}

/**
 * Generate SVG path data for an ellipse (tessellated to polyline)
 */
export function ellipseToPathData(
    ellipse: Ellipse,
    height: number,
    offset: Point2D,
    flipY: boolean
): string {
    const points = sampleEllipse(ellipse, ELLIPSE_TESSELLATION_POINTS);
    const isArc =
        typeof ellipse.startParam === 'number' &&
        typeof ellipse.endParam === 'number';

    return pointsToPathData(points, !isArc, height, offset, flipY);
}

/**
 * Generate SVG path data for a polyline
 */
export function polylineToPathData(
    polyline: DxfPolyline,
    height: number,
    offset: Point2D,
    flipY: boolean
): string {
    // Render each segment in the polyline
    let pathData = '';
    polyline.shapes.forEach((segmentData, index) => {
        const segment = new Shape(segmentData);
        const segmentPath = shapeToPathData(segment, height, offset, flipY);
        if (index === 0) {
            pathData = segmentPath;
        } else {
            // Extract everything after the M command for subsequent segments
            const match = segmentPath.match(/M\s+[\d.-]+\s+[\d.-]+\s+(.*)/);
            if (match) {
                pathData += ' ' + match[1];
            }
        }
    });
    return pathData;
}

/**
 * Generate SVG path data for a spline (tessellated to polyline)
 */
export function splineToPathData(
    spline: Spline,
    height: number,
    offset: Point2D,
    flipY: boolean
): string {
    const result = tessellateSpline(spline, { tolerance: 0.01 });

    if (!result.success || !result.points) {
        return '';
    }

    return pointsToPathData(
        result.points,
        spline.closed,
        height,
        offset,
        flipY
    );
}

/**
 * Convert shape to SVG path data with coordinate transformation
 */
export function shapeToPathData(
    shape: Shape,
    height: number,
    offset: Point2D,
    flipY: boolean
): string {
    switch (shape.type) {
        case GeometryType.LINE:
            return lineToPathData(
                shape.geometry as Line,
                height,
                offset,
                flipY
            );
        case GeometryType.ARC:
            return arcToPathData(shape.geometry as Arc, height, offset, flipY);
        case GeometryType.CIRCLE:
            return circleToPathData(
                shape.geometry as Circle,
                height,
                offset,
                flipY
            );
        case GeometryType.ELLIPSE:
            return ellipseToPathData(
                shape.geometry as Ellipse,
                height,
                offset,
                flipY
            );
        case GeometryType.POLYLINE:
            return polylineToPathData(
                shape.geometry as DxfPolyline,
                height,
                offset,
                flipY
            );
        case GeometryType.SPLINE:
            return splineToPathData(
                shape.geometry as Spline,
                height,
                offset,
                flipY
            );
        default:
            return '';
    }
}
