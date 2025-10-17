/**
 * Enhanced canvas context wrapper for coordinate transformation and drawing utilities
 */

import type { Point2D } from '$lib/geometry/point';
import type { TransformState } from '$lib/rendering/canvas/state/render-state';

/**
 * Drawing context wrapper that handles coordinate transformation
 */
export class DrawingContext {
    private ctx: CanvasRenderingContext2D;
    private transform: TransformState;
    private screenOrigin: Point2D;

    constructor(ctx: CanvasRenderingContext2D, transform: TransformState) {
        this.ctx = ctx;
        this.transform = transform;

        // Calculate screen origin based on canvas size and offset
        const ORIGIN_X_RATIO = 0.25;
        const ORIGIN_Y_RATIO = 0.75;
        this.screenOrigin = {
            x: ctx.canvas.width * ORIGIN_X_RATIO + transform.panOffset.x,
            y: ctx.canvas.height * ORIGIN_Y_RATIO + transform.panOffset.y,
        };
    }

    /**
     * Get the wrapped context for direct access
     */
    getContext(): CanvasRenderingContext2D {
        return this.ctx;
    }

    /**
     * Get total scale factor (zoom * unit scale)
     */
    getTotalScale(): number {
        return this.transform.zoomScale * this.transform.unitScale;
    }

    /**
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(screenPoint: Point2D): Point2D {
        const totalScale = this.getTotalScale();
        return {
            x: (screenPoint.x - this.screenOrigin.x) / totalScale,
            y: -(screenPoint.y - this.screenOrigin.y) / totalScale, // Flip Y for CAD convention
        };
    }

    /**
     * Convert world coordinates to screen coordinates
     */
    worldToScreen(worldPoint: Point2D): Point2D {
        const totalScale = this.getTotalScale();
        return {
            x: this.screenOrigin.x + worldPoint.x * totalScale,
            y: this.screenOrigin.y - worldPoint.y * totalScale, // Flip Y for CAD convention
        };
    }

    /**
     * Convert screen distance to world distance
     */
    screenToWorldDistance(screenDistance: number): number {
        return screenDistance / this.getTotalScale();
    }

    /**
     * Convert world distance to screen distance
     */
    worldToScreenDistance(worldDistance: number): number {
        return worldDistance * this.getTotalScale();
    }

    /**
     * Apply transform to context
     */
    applyTransform(): void {
        this.ctx.save();
        this.ctx.translate(this.screenOrigin.x, this.screenOrigin.y);
        const totalScale = this.getTotalScale();
        this.ctx.scale(totalScale, -totalScale); // Flip Y for CAD convention
    }

    /**
     * Reset transform
     */
    resetTransform(): void {
        this.ctx.restore();
    }

    /**
     * Clear the entire canvas
     */
    clear(): void {
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    }

    /**
     * Draw a line in world coordinates
     */
    drawLine(start: Point2D, end: Point2D): void {
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();
    }

    /**
     * Draw a circle in world coordinates
     */
    drawCircle(center: Point2D, radius: number): void {
        this.ctx.beginPath();
        this.ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
        this.ctx.stroke();
    }

    /**
     * Draw an arc in world coordinates
     */
    drawArc(
        center: Point2D,
        radius: number,
        startAngle: number,
        endAngle: number,
        counterClockwise: boolean = false
    ): void {
        this.ctx.beginPath();
        this.ctx.arc(
            center.x,
            center.y,
            radius,
            startAngle,
            endAngle,
            counterClockwise
        );
        this.ctx.stroke();
    }

    /**
     * Draw a polyline in world coordinates
     */
    drawPolyline(points: Point2D[], closed: boolean = false): void {
        if (points.length < 2) return;

        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }

        if (closed) {
            this.ctx.closePath();
        }

        this.ctx.stroke();
    }

    /**
     * Fill a circle in world coordinates
     */
    fillCircle(center: Point2D, radius: number): void {
        this.ctx.beginPath();
        this.ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
        this.ctx.fill();
    }

    /**
     * Draw text in world coordinates (with proper orientation)
     */
    drawText(text: string, position: Point2D, fontSize: number): void {
        // Save current transform
        this.ctx.save();

        // Move to position in world coordinates
        this.ctx.translate(position.x, position.y);

        // Flip Y back for text to be readable
        const FLIP_SCALE = -1;
        this.ctx.scale(1, FLIP_SCALE);

        // Set font size in world units
        this.ctx.font = `${fontSize}px sans-serif`;

        // Draw text
        this.ctx.fillText(text, 0, 0);

        // Restore transform
        this.ctx.restore();
    }

    /**
     * Set stroke style with world-space line width
     */
    setStrokeStyle(color: string, lineWidth: number): void {
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = this.screenToWorldDistance(lineWidth);
    }

    /**
     * Set fill style
     */
    setFillStyle(color: string): void {
        this.ctx.fillStyle = color;
    }

    /**
     * Set line dash pattern (in screen pixels)
     */
    setLineDash(segments: readonly number[]): void {
        // Convert screen pixels to world units for dash pattern
        const worldSegments = segments.map((s) =>
            this.screenToWorldDistance(s)
        );
        this.ctx.setLineDash(worldSegments);
    }

    /**
     * Reset line dash
     */
    resetLineDash(): void {
        this.ctx.setLineDash([]);
    }

    /**
     * Set shadow (in screen pixels)
     */
    setShadow(
        color: string,
        blur: number,
        offsetX: number = 0,
        offsetY: number = 0
    ): void {
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = blur;
        this.ctx.shadowOffsetX = offsetX;
        this.ctx.shadowOffsetY = offsetY;
    }

    /**
     * Reset shadow
     */
    resetShadow(): void {
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
    }

    /**
     * Set line cap and join styles
     */
    setLineStyle(
        cap: CanvasLineCap = 'round',
        join: CanvasLineJoin = 'round'
    ): void {
        this.ctx.lineCap = cap;
        this.ctx.lineJoin = join;
    }
}
