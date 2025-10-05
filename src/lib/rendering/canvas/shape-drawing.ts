/**
 * Pure functions for drawing shapes on canvas
 * Extracted from ShapeRenderer to avoid code duplication
 */

import type { Shape, Line, Arc, Circle, Polyline, Ellipse } from '$lib/types';
import { GeometryType } from '$lib/types';
import type { Spline } from '$lib/geometry/spline';
import { normalizeAngle } from '$lib/geometry/math/functions';
import {
    SPLINE_TESSELLATION_TOLERANCE,
    tessellateSpline,
} from '$lib/geometry/spline';
import {
    tessellateEllipse,
    ELLIPSE_TESSELLATION_POINTS,
} from '$lib/geometry/ellipse/index';

/**
 * Draw a line shape
 */
export function drawLine(ctx: CanvasRenderingContext2D, line: Line): void {
    ctx.beginPath();
    ctx.moveTo(line.start.x, line.start.y);
    ctx.lineTo(line.end.x, line.end.y);
    ctx.stroke();
}

/**
 * Draw a circle shape
 */
export function drawCircle(
    ctx: CanvasRenderingContext2D,
    circle: Circle
): void {
    ctx.beginPath();
    ctx.arc(circle.center.x, circle.center.y, circle.radius, 0, 2 * Math.PI);
    ctx.stroke();
}

/**
 * Draw an arc shape
 */
export function drawArc(ctx: CanvasRenderingContext2D, arc: Arc): void {
    ctx.beginPath();
    ctx.arc(
        arc.center.x,
        arc.center.y,
        arc.radius,
        normalizeAngle(arc.startAngle),
        normalizeAngle(arc.endAngle),
        arc.clockwise
    );
    ctx.stroke();
}

/**
 * Draw a polyline shape
 */
export function drawPolyline(
    ctx: CanvasRenderingContext2D,
    polyline: Polyline
): void {
    if (!polyline.shapes || polyline.shapes.length === 0) return;

    // Draw each shape in the polyline using drawLine or drawArc
    for (const shape of polyline.shapes) {
        switch (shape.type) {
            case GeometryType.LINE:
                drawLine(ctx, shape.geometry as Line);
                break;
            case GeometryType.ARC:
                drawArc(ctx, shape.geometry as Arc);
                break;
        }
    }
}

/**
 * Draw an ellipse shape
 */
export function drawEllipse(
    ctx: CanvasRenderingContext2D,
    ellipse: Ellipse,
    shape: Shape
): void {
    // Tessellate ellipse directly
    const tessellatedPoints = tessellateEllipse(ellipse, ELLIPSE_TESSELLATION_POINTS);

    if (tessellatedPoints.length < 2) return;

    // Determine if this is an ellipse arc or full ellipse
    const isArc =
        typeof ellipse.startParam === 'number' &&
        typeof ellipse.endParam === 'number';

    ctx.beginPath();
    ctx.moveTo(tessellatedPoints[0].x, tessellatedPoints[0].y);

    for (let i = 1; i < tessellatedPoints.length; i++) {
        ctx.lineTo(tessellatedPoints[i].x, tessellatedPoints[i].y);
    }

    // Close path for full ellipse
    if (!isArc) {
        ctx.closePath();
    }

    ctx.stroke();
}

/**
 * Draw a spline shape
 */
export function drawSpline(
    ctx: CanvasRenderingContext2D,
    spline: Spline,
    shape: Shape
): void {
    // Tessellate spline directly
    const result = tessellateSpline(spline, {
        method: 'verb-nurbs',
        tolerance: SPLINE_TESSELLATION_TOLERANCE,
    });

    if (!result.success || result.points.length < 2) return;

    const tessellatedPoints = result.points;
    if (tessellatedPoints.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(tessellatedPoints[0].x, tessellatedPoints[0].y);

    for (let i = 1; i < tessellatedPoints.length; i++) {
        ctx.lineTo(tessellatedPoints[i].x, tessellatedPoints[i].y);
    }

    if (spline.closed) {
        ctx.closePath();
    }

    ctx.stroke();
}

/**
 * Main dispatcher function to draw any shape type
 */
export function drawShape(ctx: CanvasRenderingContext2D, shape: Shape): void {
    switch (shape.type) {
        case GeometryType.LINE:
            drawLine(ctx, shape.geometry as Line);
            break;
        case GeometryType.CIRCLE:
            drawCircle(ctx, shape.geometry as Circle);
            break;
        case GeometryType.ARC:
            drawArc(ctx, shape.geometry as Arc);
            break;
        case GeometryType.POLYLINE:
            drawPolyline(ctx, shape.geometry as Polyline);
            break;
        case GeometryType.ELLIPSE:
            drawEllipse(ctx, shape.geometry as Ellipse, shape);
            break;
        case GeometryType.SPLINE:
            drawSpline(ctx, shape.geometry as Spline, shape);
            break;
        default:
            console.warn(`Unsupported shape type: ${shape.type}`);
    }
}
