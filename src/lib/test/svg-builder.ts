import verb from 'verb-nurbs';
import type {
    Point2D,
    Arc,
    Line,
    Circle,
    Spline,
    Ellipse,
    Polyline,
} from '../types';
import type { VerbCurve } from 'verb-nurbs';
import { GeometryType } from '../types/geometry';
import { tessellateEllipse } from '../geometry/ellipse-tessellation';
import type { Shape } from '../algorithms/offset-calculation/chain/types';
import { tessellateVerbCurve } from '../algorithms/offset-calculation/offset/spline/spline';
import { getShapeEndPoint } from '$lib/geometry';
import { getShapeStartPoint } from '$lib/geometry';
import { polylineToPoints } from '$lib/geometry/polyline';
import { calculateArcPoint } from '../utils/arc-utils';
import {
    calculateSplineEndTangent,
    calculateSplineStartTangent,
} from '$lib/algorithms/offset-calculation/extend/spline';
import { isLine } from '$lib/geometry/line';
import { isArc } from '$lib/geometry/arc';

export class SVGBuilder {
    private elements: string[] = [];
    private width: number;
    private height: number;
    private offsetX: number;
    private offsetY: number;
    private bounds: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    } | null = null;
    private autoSize: boolean;
    private readonly padding = 50;
    private flipY: boolean;
    private legendItems: Array<{ color: string; label: string }> | null = null;

    constructor(
        width?: number,
        height?: number,
        offsetX?: number,
        offsetY?: number,
        flipY: boolean = true
    ) {
        this.flipY = flipY;

        if (width !== undefined && height !== undefined) {
            // Fixed size mode
            this.width = width;
            this.height = height;
            this.offsetX = offsetX || 0;
            this.offsetY = offsetY || 0;
            this.autoSize = false;
        } else {
            // Auto-sizing mode
            this.width = 0; // Will be calculated later
            this.height = 0; // Will be calculated later
            this.offsetX = 0; // Will be calculated later
            this.offsetY = 0; // Will be calculated later
            this.autoSize = true;
            this.bounds = null;
        }
    }

    // Update bounds with explicit coordinates (for all drawing elements)
    // Tracks bounds in CNC coordinates, includes stroke width for accurate sizing
    private updateBoundsWithPoint(point: Point2D, strokeRadius: number = 0) {
        if (!this.autoSize) return;

        // Debug: Check for NaN input
        if (isNaN(point.x) || isNaN(point.y)) {
            console.error(
                `updateBoundsWithPoint received NaN: x=${point.x}, y=${point.y}`
            );
            return; // Don't update bounds with NaN values
        }

        if (!this.bounds) {
            this.bounds = {
                minX: Infinity,
                minY: Infinity,
                maxX: -Infinity,
                maxY: -Infinity,
            };
        }

        this.bounds.minX = Math.min(this.bounds.minX, point.x - strokeRadius);
        this.bounds.minY = Math.min(this.bounds.minY, point.y - strokeRadius);
        this.bounds.maxX = Math.max(this.bounds.maxX, point.x + strokeRadius);
        this.bounds.maxY = Math.max(this.bounds.maxY, point.y + strokeRadius);
    }

    // Update bounds with rectangular area (for legend, text blocks, etc.)
    private updateBoundsWithRect(
        x: number,
        y: number,
        width: number,
        height: number
    ) {
        if (!this.autoSize) return;

        this.updateBoundsWithPoint({ x, y });
        this.updateBoundsWithPoint({ x: x + width, y: y + height });
    }

    // Transform X coordinate with offset
    private transformX(x: number): number {
        return x - this.offsetX;
    }

    // Transform Y coordinate from CNC (Y-up) to SVG (Y-down) with offset
    private transformY(y: number): number {
        if (this.flipY) {
            return this.height - (y - this.offsetY); // CNC Y-up to SVG Y-down conversion
        } else {
            return y - this.offsetY; // Direct transformation without flipping
        }
    }

    private addLine(
        line: Line,
        color: string,
        width: number,
        dashArray?: string
    ) {
        // Update bounds for auto-sizing with stroke width consideration
        this.updateBoundsWithPoint(line.start, width / 2);
        this.updateBoundsWithPoint(line.end, width / 2);

        // Store template with CNC coordinates - will be transformed during rendering
        this.elements.push(
            `LINE|${line.start.x},${line.start.y}|${line.end.x},${line.end.y}|${color}|${width}|${dashArray || ''}`
        );
    }

    private addCircle(
        circle: Circle,
        color: string,
        strokeWidth: number,
        fill: string,
        dashArray?: string
    ) {
        // Update bounds for auto-sizing - circle bounds include radius + stroke width
        this.updateBoundsWithPoint(
            circle.center,
            circle.radius + strokeWidth / 2
        );

        // Store template with CNC coordinates
        this.elements.push(
            `CIRCLE|${circle.center.x},${circle.center.y}|${circle.radius}|${color}|${strokeWidth}|${fill}|${dashArray || ''}`
        );
    }

    private addArc(
        arc: Arc,
        color: string,
        strokeWidth: number,
        dashArray?: string
    ) {
        // Update bounds for auto-sizing using arc's bounding circle + stroke width
        this.updateBoundsWithPoint(arc.center, arc.radius + strokeWidth / 2);

        // Store template with CNC coordinates - sweep direction will be handled during rendering
        this.elements.push(
            `ARC|${arc.center.x},${arc.center.y}|${arc.radius}|${arc.startAngle}|${arc.endAngle}|${arc.clockwise}|${color}|${strokeWidth}|${dashArray || ''}`
        );

        // Add green point at arc start and red point at arc end
        const arcShape: Shape = {
            id: `arc-${Date.now()}`,
            type: GeometryType.ARC,
            geometry: arc,
        };
        const startPoint: Point2D = getShapeStartPoint(arcShape);
        const endPoint: Point2D = getShapeEndPoint(arcShape);
        this.addCircle({ center: startPoint, radius: 3 }, 'green', 1, 'green');
        this.addCircle({ center: endPoint, radius: 3 }, 'red', 1, 'red');
    }

    private addPolyline(
        polyline: Polyline,
        color: string,
        strokeWidth: number,
        dashArray?: string
    ) {
        // Render each shape individually to preserve arcs
        polyline.shapes.forEach((shape) => {
            const segment = shape.geometry;
            if (isLine(segment)) {
                // Line segment
                this.addLine(segment as Line, color, strokeWidth, dashArray);
            } else if (isArc(segment)) {
                // Arc segment
                this.addArc(segment as Arc, color, strokeWidth, dashArray);
            }
        });
    }

    private addPolylinePoints(
        points: Point2D[],
        closed: boolean,
        color: string,
        strokeWidth: number,
        fill: string,
        dashArray?: string
    ) {
        // Add null safety check
        if (!points || points.length === 0) {
            return;
        }

        // Debug: Check for NaN in points
        const hasNaN: boolean = points.some((p) => isNaN(p.x) || isNaN(p.y));
        if (hasNaN) {
            console.error(
                `addPolyline received points with NaN values. First point: x=${points[0]?.x}, y=${points[0]?.y}`
            );
        }

        // Update bounds for auto-sizing with stroke width
        points.forEach((point) =>
            this.updateBoundsWithPoint(point, strokeWidth / 2)
        );

        // Store template with CNC coordinates
        // Format: POLYLINE|x1,y1|x2,y2|...|closed|color|strokeWidth|fill|dashArray
        const pointsStr: string = points.map((p) => `${p.x},${p.y}`).join('|');
        this.elements.push(
            `POLYLINE|${pointsStr}|${closed}|${color}|${strokeWidth}|${fill}|${dashArray || ''}`
        );
    }

    // Helper function to escape XML entities in text content
    private escapeXml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    addText(
        x: number,
        y: number,
        text: string,
        color: string,
        fontSize: string
    ) {
        // Update bounds for auto-sizing - approximate text bounds based on character width
        const fontSizeNum: number = parseFloat(fontSize.replace('px', ''));
        const approxCharWidth: number = fontSizeNum * 0.6; // Rough approximation for Arial
        const textWidth: number = text.length * approxCharWidth;
        const textHeight: number = fontSizeNum;

        this.updateBoundsWithRect(x, y - textHeight, textWidth, textHeight);

        // Store template with CNC coordinates
        this.elements.push(
            `TEXT|${x},${y}|${this.escapeXml(text)}|${color}|${fontSize}`
        );
    }

    addLegend(items: Array<{ color: string; label: string }>) {
        // Store legend data for rendering in toString() when dimensions are finalized
        this.legendItems = items;
    }

    private renderLegend(): string[] {
        if (!this.legendItems || this.legendItems.length === 0) {
            return [];
        }

        const elements: string[] = [];
        const items: Array<{ color: string; label: string }> = this.legendItems;

        // Calculate maximum label width for better sizing
        const maxLabelLength: number = Math.max(
            ...items.map((item) => item.label.length)
        );
        const legendWidth: number = Math.max(140, maxLabelLength * 8 + 50);

        // Calculate legend height based on number of items
        const legendHeight: number = items.length * 20 + 20;

        // Position in upper right corner with margin - use raw SVG coordinates (ignore flipY)
        const margin: number = 10;
        const x: number = this.width - legendWidth - margin;
        const y: number = margin;

        // Background box - positioned in upper right using raw SVG coordinates
        elements.push(
            `<rect x="${x}" y="${y}" width="${legendWidth}" height="${legendHeight}" fill="white" stroke="black" stroke-width="1" opacity="0.9" />`
        );

        // Legend items - all use raw SVG coordinates (no coordinate transformation)
        items.forEach((item, index) => {
            const itemY: number = y + 15 + index * 20;

            // Color indicator line or circle
            if (
                item.color === 'yellow' ||
                item.color === 'green' ||
                item.color === 'orange' ||
                item.color === 'cyan'
            ) {
                // Use circles for intersection points
                elements.push(
                    `<circle cx="${x + 15}" cy="${itemY}" r="3" fill="${item.color}" stroke="black" stroke-width="0.5" />`
                );
            } else {
                // Use lines for shapes
                elements.push(
                    `<line x1="${x + 5}" y1="${itemY}" x2="${x + 25}" y2="${itemY}" stroke="${item.color}" stroke-width="2" />`
                );
            }

            // Label text
            elements.push(
                `<text x="${x + 30}" y="${itemY + 4}" fill="black" font-size="12px" font-family="Arial">${this.escapeXml(item.label)}</text>`
            );
        });

        return elements;
    }

    // Methods for intersection visualization
    addShape(
        shape: Shape,
        color: string,
        strokeWidth: number,
        label?: string,
        dashArray?: string
    ) {
        switch (shape.type) {
            case GeometryType.LINE:
                const lineGeom: Line = shape.geometry as Line;
                this.addLine(lineGeom, color, strokeWidth, dashArray);
                break;
            case GeometryType.ARC:
                this.addArc(
                    shape.geometry as Arc,
                    color,
                    strokeWidth,
                    dashArray
                );
                break;
            case GeometryType.CIRCLE:
                const circleGeom: Circle = shape.geometry as Circle;
                this.addCircle(
                    circleGeom,
                    color,
                    strokeWidth,
                    'none',
                    dashArray
                );
                break;
            case GeometryType.POLYLINE:
                this.addPolyline(
                    shape.geometry as Polyline,
                    color,
                    strokeWidth,
                    dashArray
                );
                break;
            case GeometryType.SPLINE:
                this.addSpline(
                    shape.geometry as Spline,
                    color,
                    strokeWidth,
                    dashArray
                );
                break;
            case GeometryType.ELLIPSE:
                this.addEllipse(
                    shape.geometry as Ellipse,
                    color,
                    strokeWidth,
                    dashArray
                );
                break;
        }
    }

    private addSpline(
        spline: Spline,
        color: string,
        strokeWidth: number,
        dashArray?: string
    ) {
        // Debug: Check for invalid spline data
        if (!spline.controlPoints || spline.controlPoints.length === 0) {
            throw new Error('Spline has no control points');
        }

        // Check for NaN in control points before creating verb curve
        const hasNaNControlPoints: boolean = spline.controlPoints.some(
            (p) => isNaN(p.x) || isNaN(p.y)
        );
        if (hasNaNControlPoints) {
            throw new Error('Spline control points contain NaN values');
        }

        // Create verb curve for tessellation
        // Ensure we have valid weights - empty array is truthy but invalid
        const weights: number[] =
            spline.weights && spline.weights.length > 0
                ? spline.weights
                : spline.controlPoints.map(() => 1);

        // Validate and normalize the knot vector for verb-nurbs
        let normalizedKnots: number[] = [...spline.knots];

        // For simple Bezier curves (degree 3, 4 control points), ensure clamped format
        if (spline.degree === 3 && spline.controlPoints.length === 4) {
            if (
                spline.knots.length === 8 &&
                spline.knots[0] === 0 &&
                spline.knots[7] === 1 &&
                spline.knots.slice(0, 4).every((k) => k === 0) &&
                spline.knots.slice(4, 8).every((k) => k === 1)
            ) {
                // This is already a proper clamped knot vector for a Bezier curve
                // But verb-nurbs might expect a specific format
                // Let's try: [0, 0, 0, 0, 1, 1, 1, 1] - which is correct for clamped NURBS
                normalizedKnots = [0, 0, 0, 0, 1, 1, 1, 1];
            }
        }

        let verbCurve: VerbCurve;
        try {
            verbCurve = verb.geom.NurbsCurve.byKnotsControlPointsWeights(
                spline.degree,
                normalizedKnots,
                spline.controlPoints.map((p) => [p.x, p.y, 0]),
                weights
            );
        } catch (error) {
            // If the full NURBS construction fails, try simplified approach
            try {
                // Use the correct verb API for point interpolation
                verbCurve = verb.geom.NurbsCurve.byPoints(
                    spline.controlPoints.map((p) => [p.x, p.y, 0]),
                    Math.min(spline.degree, spline.controlPoints.length - 1)
                );
            } catch (fallbackError) {
                throw new Error(
                    `Both verb NURBS construction methods failed. Original: ${error}, Fallback: ${fallbackError}`
                );
            }
        }

        // Use fine tolerance for visual output - ensures smooth curves
        // Use 0.1 pixel tolerance for crisp visual representation
        const visualTolerance: number = 0.1;
        const points: Point2D[] = tessellateVerbCurve(
            verbCurve,
            visualTolerance
        );

        // Check for NaN in tessellated points
        const hasNaNTessellation: boolean = points.some(
            (p) => isNaN(p.x) || isNaN(p.y)
        );
        if (hasNaNTessellation) {
            throw new Error(
                `Spline tessellation produced NaN. Degree: ${spline.degree}, Knots: ${spline.knots.length}, Control points: ${spline.controlPoints.length}`
            );
        }

        this.addPolylinePoints(
            points,
            spline.closed,
            color,
            strokeWidth,
            'none',
            dashArray
        );
    }

    private addEllipse(
        ellipse: Ellipse,
        color: string,
        strokeWidth: number,
        dashArray?: string
    ) {
        const points: Point2D[] = tessellateEllipse(ellipse, { numPoints: 64 });
        const isArc: boolean =
            typeof ellipse.startParam === 'number' &&
            typeof ellipse.endParam === 'number';
        this.addPolylinePoints(
            points,
            !isArc,
            color,
            strokeWidth,
            'none',
            dashArray
        );

        // Add green point at ellipse arc start and red point at ellipse arc end (like addArc does)
        if (isArc) {
            const ellipseShape: Shape = {
                id: `ellipse-${Date.now()}`,
                type: GeometryType.ELLIPSE,
                geometry: ellipse,
            };
            const startPoint: Point2D = getShapeStartPoint(ellipseShape);
            const endPoint: Point2D = getShapeEndPoint(ellipseShape);
            this.addCircle(
                { center: startPoint, radius: 3 },
                'green',
                1,
                'green'
            );
            this.addCircle({ center: endPoint, radius: 3 }, 'red', 1, 'red');
        }
    }

    addIntersectionPoint(point: Point2D, color: string, radius: number) {
        this.addCircle({ center: point, radius }, 'black', 1, color);
    }

    /**
     * Draw extensions for a line shape as dotted lines
     */
    addLineExtensions(
        line: Line,
        color: string,
        strokeWidth: number,
        extensionLength: number = 100
    ) {
        // Calculate line direction
        const lineDir: { x: number; y: number } = {
            x: line.end.x - line.start.x,
            y: line.end.y - line.start.y,
        };
        const lineLength: number = Math.sqrt(
            lineDir.x * lineDir.x + lineDir.y * lineDir.y
        );
        const lineUnitDir: { x: number; y: number } = {
            x: lineDir.x / lineLength,
            y: lineDir.y / lineLength,
        };

        // Start extension (before line start)
        const startExtension: Point2D = {
            x: line.start.x - lineUnitDir.x * extensionLength,
            y: line.start.y - lineUnitDir.y * extensionLength,
        };
        this.addLine(
            { start: startExtension, end: line.start },
            color,
            strokeWidth,
            '5,5'
        );

        // End extension (after line end)
        const endExtension: Point2D = {
            x: line.end.x + lineUnitDir.x * extensionLength,
            y: line.end.y + lineUnitDir.y * extensionLength,
        };
        this.addLine(
            { start: line.end, end: endExtension },
            color,
            strokeWidth,
            '5,5'
        );
    }

    /**
     * Draw extensions for a spline shape as dotted tangent lines
     */
    addSplineExtensions(
        spline: Spline,
        color: string,
        strokeWidth: number,
        extensionLength: number = 100
    ) {
        try {
            // Get start and end points of spline
            const startPoint: Point2D = spline.controlPoints[0];
            const endPoint: Point2D =
                spline.controlPoints[spline.controlPoints.length - 1];

            // Get tangent directions
            const startTangent: Point2D = calculateSplineStartTangent(spline);
            const endTangent: Point2D = calculateSplineEndTangent(spline);

            // Normalize tangents
            const startTangentLength: number = Math.sqrt(
                startTangent.x * startTangent.x +
                    startTangent.y * startTangent.y
            );
            const endTangentLength: number = Math.sqrt(
                endTangent.x * endTangent.x + endTangent.y * endTangent.y
            );

            const startUnitTangent: Point2D = {
                x: startTangent.x / startTangentLength,
                y: startTangent.y / startTangentLength,
            };
            const endUnitTangent: Point2D = {
                x: endTangent.x / endTangentLength,
                y: endTangent.y / endTangentLength,
            };

            // Start extension (tangent before spline start)
            const startExtension: Point2D = {
                x: startPoint.x - startUnitTangent.x * extensionLength,
                y: startPoint.y - startUnitTangent.y * extensionLength,
            };
            this.addLine(
                { start: startExtension, end: startPoint },
                color,
                strokeWidth,
                '5,5'
            );

            // End extension (tangent after spline end)
            const endExtension: Point2D = {
                x: endPoint.x + endUnitTangent.x * extensionLength,
                y: endPoint.y + endUnitTangent.y * extensionLength,
            };
            this.addLine(
                { start: endPoint, end: endExtension },
                color,
                strokeWidth,
                '5,5'
            );
        } catch {
            // Fallback: simple linear extensions using control points
            const startPoint: Point2D = spline.controlPoints[0];
            const endPoint: Point2D =
                spline.controlPoints[spline.controlPoints.length - 1];

            // Approximate tangent from first two control points
            if (spline.controlPoints.length > 1) {
                const startTangent: Point2D = {
                    x: spline.controlPoints[1].x - spline.controlPoints[0].x,
                    y: spline.controlPoints[1].y - spline.controlPoints[0].y,
                };
                const startLength: number = Math.sqrt(
                    startTangent.x * startTangent.x +
                        startTangent.y * startTangent.y
                );
                const startUnit: Point2D = {
                    x: startTangent.x / startLength,
                    y: startTangent.y / startLength,
                };

                const startExtension: Point2D = {
                    x: startPoint.x - startUnit.x * extensionLength,
                    y: startPoint.y - startUnit.y * extensionLength,
                };
                this.addLine(
                    { start: startExtension, end: startPoint },
                    color,
                    strokeWidth,
                    '5,5'
                );
            }

            // Approximate tangent from last two control points
            if (spline.controlPoints.length > 1) {
                const lastIdx: number = spline.controlPoints.length - 1;
                const endTangent: Point2D = {
                    x:
                        spline.controlPoints[lastIdx].x -
                        spline.controlPoints[lastIdx - 1].x,
                    y:
                        spline.controlPoints[lastIdx].y -
                        spline.controlPoints[lastIdx - 1].y,
                };
                const endLength: number = Math.sqrt(
                    endTangent.x * endTangent.x + endTangent.y * endTangent.y
                );
                const endUnit: Point2D = {
                    x: endTangent.x / endLength,
                    y: endTangent.y / endLength,
                };

                const endExtension: Point2D = {
                    x: endPoint.x + endUnit.x * extensionLength,
                    y: endPoint.y + endUnit.y * extensionLength,
                };
                this.addLine(
                    { start: endPoint, end: endExtension },
                    color,
                    strokeWidth,
                    '5,5'
                );
            }
        }
    }

    /**
     * Draw extensions for an arc shape as dotted arc segments
     */
    addArcExtensions(
        arc: Arc,
        color: string,
        strokeWidth: number,
        extensionLength: number = 100
    ) {
        // Calculate angular extension based on extension length and radius
        // extensionAngle = extensionLength / radius (in radians)
        // Clamp to a reasonable maximum (e.g., 4π radians = 720°)
        const extensionAngle: number = Math.min(
            extensionLength / arc.radius,
            4 * Math.PI
        );

        let extendedStartAngle: number;
        let extendedEndAngle: number;

        if (arc.clockwise) {
            // For clockwise arcs, extend by increasing start angle and decreasing end angle
            extendedStartAngle = arc.startAngle + extensionAngle;
            extendedEndAngle = arc.endAngle - extensionAngle;
        } else {
            // For counter-clockwise arcs, extend by decreasing start angle and increasing end angle
            extendedStartAngle = arc.startAngle - extensionAngle;
            extendedEndAngle = arc.endAngle + extensionAngle;
        }

        // Draw start extension (from extended start to original start)
        const startExtensionArc: Arc = {
            center: arc.center,
            radius: arc.radius,
            startAngle: extendedStartAngle,
            endAngle: arc.startAngle,
            clockwise: arc.clockwise,
        };
        this.addArcWithDash(startExtensionArc, color, strokeWidth, '5,5');

        // Draw end extension (from original end to extended end)
        const endExtensionArc: Arc = {
            center: arc.center,
            radius: arc.radius,
            startAngle: arc.endAngle,
            endAngle: extendedEndAngle,
            clockwise: arc.clockwise,
        };
        this.addArcWithDash(endExtensionArc, color, strokeWidth, '5,5');
    }

    /**
     * Draw an arc with optional dash pattern
     */
    addArcWithDash(
        arc: Arc,
        color: string,
        strokeWidth: number,
        dashArray?: string
    ) {
        const startPoint = calculateArcPoint(
            arc.center,
            arc.radius,
            arc.startAngle
        );
        const endPoint = calculateArcPoint(
            arc.center,
            arc.radius,
            arc.endAngle
        );
        const startX = startPoint.x;
        const startY = startPoint.y;
        const endX = endPoint.x;
        const endY = endPoint.y;

        const largeArcFlag: number =
            Math.abs(arc.endAngle - arc.startAngle) > Math.PI ? 1 : 0;

        // For CNC to SVG coordinate transformation, we need to handle the sweep direction properly
        // When Y is flipped, we need to consider both the clockwise flag and the angle direction
        let sweepFlag: number = arc.clockwise ? 1 : 0;

        // Special case: if startAngle > endAngle (decreasing angles), we need to flip the sweep
        if (arc.startAngle > arc.endAngle && !arc.clockwise) {
            sweepFlag = 1;
        }

        const dashStyle: string = dashArray
            ? ` stroke-dasharray="${dashArray}"`
            : '';

        this.elements.push(
            `<path d="M ${startX} ${this.transformY(startY)} A ${arc.radius} ${arc.radius} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${this.transformY(endY)}" stroke="${color}" stroke-width="${strokeWidth}" fill="none"${dashStyle}/>`
        );
    }

    /**
     * Draw extensions for a polyline shape as dotted lines extending first and last segments
     */
    addPolylineExtensions(
        polyline: Polyline,
        color: string,
        strokeWidth: number,
        extensionLength: number = 100
    ) {
        const points: Point2D[] = polylineToPoints(polyline);
        if (points.length < 2) {
            return; // Cannot extend a polyline with less than 2 points
        }

        // Don't extend closed polylines - they connect back to themselves
        if (polyline.closed) {
            return;
        }

        // First segment extension (before polyline start)
        const firstPoint: Point2D = points[0];
        const secondPoint: Point2D = points[1];

        const firstSegmentDir: Point2D = {
            x: secondPoint.x - firstPoint.x,
            y: secondPoint.y - firstPoint.y,
        };
        const firstSegmentLength: number = Math.sqrt(
            firstSegmentDir.x * firstSegmentDir.x +
                firstSegmentDir.y * firstSegmentDir.y
        );

        if (firstSegmentLength > 0) {
            const firstUnitDir: Point2D = {
                x: firstSegmentDir.x / firstSegmentLength,
                y: firstSegmentDir.y / firstSegmentLength,
            };

            const startExtension: Point2D = {
                x: firstPoint.x - firstUnitDir.x * extensionLength,
                y: firstPoint.y - firstUnitDir.y * extensionLength,
            };
            this.addLine(
                { start: startExtension, end: firstPoint },
                color,
                strokeWidth,
                '5,5'
            );
        }

        // Last segment extension (after polyline end)
        const lastPoint: Point2D = points[points.length - 1];
        const secondLastPoint: Point2D = points[points.length - 2];

        const lastSegmentDir: Point2D = {
            x: lastPoint.x - secondLastPoint.x,
            y: lastPoint.y - secondLastPoint.y,
        };
        const lastSegmentLength: number = Math.sqrt(
            lastSegmentDir.x * lastSegmentDir.x +
                lastSegmentDir.y * lastSegmentDir.y
        );

        if (lastSegmentLength > 0) {
            const lastUnitDir: Point2D = {
                x: lastSegmentDir.x / lastSegmentLength,
                y: lastSegmentDir.y / lastSegmentLength,
            };

            const endExtension: Point2D = {
                x: lastPoint.x + lastUnitDir.x * extensionLength,
                y: lastPoint.y + lastUnitDir.y * extensionLength,
            };
            this.addLine(
                { start: lastPoint, end: endExtension },
                color,
                strokeWidth,
                '5,5'
            );
        }
    }

    /**
     * Draw extensions for any shape type
     */
    addShapeExtensions(
        shape: Shape,
        color: string,
        strokeWidth: number,
        extensionLength: number = 100
    ) {
        switch (shape.type) {
            case GeometryType.LINE:
                this.addLineExtensions(
                    shape.geometry as Line,
                    color,
                    strokeWidth,
                    extensionLength
                );
                break;
            case GeometryType.ARC:
                this.addArcExtensions(
                    shape.geometry as Arc,
                    color,
                    strokeWidth,
                    extensionLength
                );
                break;
            case GeometryType.SPLINE:
                this.addSplineExtensions(
                    shape.geometry as Spline,
                    color,
                    strokeWidth,
                    extensionLength
                );
                break;
            case GeometryType.POLYLINE:
                this.addPolylineExtensions(
                    shape.geometry as Polyline,
                    color,
                    strokeWidth,
                    extensionLength
                );
                break;
            // Other shape types (circle, ellipse) could be added here if needed
            default:
                // For unsupported shape types, do nothing
                break;
        }
    }

    addTitle(title: string) {
        this.addText(this.width / 2, this.height - 20, title, 'black', '16px');
    }

    // Transform a stored CNC element template to final SVG element
    private transformElementToSVG(element: string): string {
        const parts: string[] = element.split('|');
        const type: string = parts[0];

        switch (type) {
            case 'LINE': {
                const [startX, startY]: number[] = parts[1]
                    .split(',')
                    .map(Number);
                const [endX, endY]: number[] = parts[2].split(',').map(Number);
                const color: string = parts[3];
                const width: string = parts[4];
                const dashArray: string = parts[5];
                const dashStyle: string = dashArray
                    ? ` stroke-dasharray="${dashArray}"`
                    : '';
                return `<line x1="${this.transformX(startX)}" y1="${this.transformY(startY)}" x2="${this.transformX(endX)}" y2="${this.transformY(endY)}" stroke="${color}" stroke-width="${width}" fill="none"${dashStyle}/>`;
            }

            case 'CIRCLE': {
                const [centerX, centerY]: number[] = parts[1]
                    .split(',')
                    .map(Number);
                const radius: string = parts[2];
                const color: string = parts[3];
                const strokeWidth: string = parts[4];
                const fill: string = parts[5];
                const dashArray: string = parts[6];
                const dashStyle: string = dashArray
                    ? ` stroke-dasharray="${dashArray}"`
                    : '';
                return `<circle cx="${this.transformX(centerX)}" cy="${this.transformY(centerY)}" r="${radius}" stroke="${color}" stroke-width="${strokeWidth}" fill="${fill}"${dashStyle}/>`;
            }

            case 'RING': {
                const [centerX, centerY]: number[] = parts[1]
                    .split(',')
                    .map(Number);
                const radius: string = parts[2];
                const color: string = parts[3];
                const strokeWidth: string = parts[4];
                const dashArray: string = parts[5];
                const dashStyle: string = dashArray
                    ? ` stroke-dasharray="${dashArray}"`
                    : '';
                return `<circle cx="${this.transformX(centerX)}" cy="${this.transformY(centerY)}" r="${radius}" stroke="${color}" stroke-width="${strokeWidth}" fill="none"${dashStyle}/>`;
            }

            case 'ARC': {
                const [centerX, centerY]: number[] = parts[1]
                    .split(',')
                    .map(Number);
                const radius: number = Number(parts[2]);
                const startAngle: number = Number(parts[3]);
                const endAngle: number = Number(parts[4]);
                const clockwise: boolean = parts[5] === 'true';
                const color: string = parts[6];
                const strokeWidth: string = parts[7];
                const dashArray: string = parts[8];

                // Calculate start and end points
                const arcStart = calculateArcPoint(
                    { x: centerX, y: centerY },
                    radius,
                    startAngle
                );
                const arcEnd = calculateArcPoint(
                    { x: centerX, y: centerY },
                    radius,
                    endAngle
                );
                const startX = this.transformX(arcStart.x);
                const startY = this.transformY(arcStart.y);
                const endX = this.transformX(arcEnd.x);
                const endY = this.transformY(arcEnd.y);

                // Calculate the actual sweep angle considering arc direction
                // The key insight: we need to determine the angular span the arc actually covers,
                // not the arithmetic difference between angles
                let sweepAngle: number;

                if (clockwise) {
                    // For clockwise arcs: measure from startAngle to endAngle going clockwise
                    // Normalize both angles to [0, 2π) range first
                    let normalizedStart: number = startAngle;
                    let normalizedEnd: number = endAngle;

                    while (normalizedStart < 0) normalizedStart += 2 * Math.PI;
                    while (normalizedStart >= 2 * Math.PI)
                        normalizedStart -= 2 * Math.PI;
                    while (normalizedEnd < 0) normalizedEnd += 2 * Math.PI;
                    while (normalizedEnd >= 2 * Math.PI)
                        normalizedEnd -= 2 * Math.PI;

                    if (normalizedStart >= normalizedEnd) {
                        // Normal case: startAngle > endAngle (e.g., from 90° to 45°)
                        sweepAngle = normalizedStart - normalizedEnd;
                    } else {
                        // Cross 0°: from small angle to large angle clockwise (e.g., from 10° to 350°)
                        sweepAngle =
                            2 * Math.PI - normalizedEnd + normalizedStart;
                    }
                } else {
                    // For counter-clockwise arcs: measure from startAngle to endAngle going counter-clockwise
                    if (endAngle >= startAngle) {
                        // Normal case: startAngle < endAngle (e.g., from 45° to 90°)
                        sweepAngle = endAngle - startAngle;
                    } else {
                        // Cross 0°: from large angle to small angle counter-clockwise (e.g., from 350° to 10°)
                        sweepAngle = 2 * Math.PI - startAngle + endAngle;
                    }
                }

                // SVG large-arc-flag: 1 if the arc span is greater than 180° (π radians), 0 otherwise
                // Use a small tolerance to handle floating-point precision issues around exactly 180°
                const tolerance: number = 1e-10;
                const largeArcFlag: number =
                    sweepAngle > Math.PI + tolerance ? 1 : 0;

                // Convert Arc.clockwise boolean to SVG sweep-flag (1 = clockwise, 0 = counter-clockwise)
                // The Arc interface already contains the correct sweep direction from DXF parsing
                const sweepFlag: number = clockwise ? 1 : 0;

                const pathData: string = `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${endY}`;

                const dashStyle: string = dashArray
                    ? ` stroke-dasharray="${dashArray}"`
                    : '';
                return `<path d="${pathData}" stroke="${color}" stroke-width="${strokeWidth}" fill="none"${dashStyle}/>`;
            }

            case 'POLYLINE': {
                // Format: POLYLINE|x1,y1|x2,y2|...|closed|color|strokeWidth|fill|dashArray
                const stylePartsStart: number = parts.length - 5; // last 5 are: closed, color, strokeWidth, fill, dashArray
                const pointParts: string[] = parts.slice(1, stylePartsStart);
                const points: Point2D[] = pointParts.map((part) => {
                    const [x, y]: number[] = part.split(',').map(Number);
                    return { x, y };
                });
                const closed: boolean = parts[stylePartsStart] === 'true';
                const color: string = parts[stylePartsStart + 1];
                const strokeWidth: string = parts[stylePartsStart + 2];
                const fill: string = parts[stylePartsStart + 3];
                const dashArray: string = parts[stylePartsStart + 4];

                const pointsStr: string = points
                    .map(
                        (p) => `${this.transformX(p.x)},${this.transformY(p.y)}`
                    )
                    .join(' ');
                const element: string = closed ? 'polygon' : 'polyline';
                const dashStyle: string = dashArray
                    ? ` stroke-dasharray="${dashArray}"`
                    : '';
                return `<${element} points="${pointsStr}" stroke="${color}" stroke-width="${strokeWidth}" fill="${fill}"${dashStyle}/>`;
            }

            case 'TEXT': {
                const [x, y] = parts[1].split(',').map(Number);
                const text: string = parts[2];
                const color: string = parts[3];
                const fontSize: string = parts[4];
                return `<text x="${this.transformX(x)}" y="${this.transformY(y)}" fill="${color}" font-size="${fontSize}" font-family="Arial">${text}</text>`;
            }

            default:
                // If it's not a template, assume it's already an SVG element (legacy)
                return element;
        }
    }

    toString(): string {
        // Step 1: Pre-calculate legend dimensions if needed for bounds
        let legendWidth: number = 0;
        let legendHeight: number = 0;
        if (this.legendItems && this.legendItems.length > 0) {
            const maxLabelLength: number = Math.max(
                ...this.legendItems.map((item) => item.label.length)
            );
            legendWidth = Math.max(140, maxLabelLength * 8 + 50);
            legendHeight = this.legendItems.length * 20 + 20;
        }

        // Step 2: Finalize dimensions for auto-sizing based on CNC coordinate bounds
        if (this.autoSize) {
            if (
                !this.bounds ||
                this.bounds.minX === Infinity ||
                this.bounds.maxX === -Infinity ||
                this.bounds.minY === Infinity ||
                this.bounds.maxY === -Infinity
            ) {
                // Default dimensions if no bounds were established
                this.width = 400;
                this.height = 400;
                this.offsetX = 0;
                this.offsetY = 0;
            } else {
                // Calculate viewport dimensions from CNC coordinate bounds
                const boundsWidth: number = this.bounds.maxX - this.bounds.minX;
                const boundsHeight: number =
                    this.bounds.maxY - this.bounds.minY;

                // Use standard padding - bounds already include stroke width considerations
                const totalPadding: number = this.padding;

                // Calculate SVG viewport size
                this.width = Math.max(boundsWidth + 2 * totalPadding, 100);
                this.height = Math.max(boundsHeight + 2 * totalPadding, 100);

                // Add extra space for legend if it exists
                if (legendWidth > 0) {
                    this.width = Math.max(
                        this.width,
                        legendWidth + 3 * this.padding
                    );
                    this.height = Math.max(
                        this.height,
                        legendHeight + 2 * this.padding
                    );
                }

                // Set transform offsets to map CNC coordinates to SVG coordinates
                // CNC (minX, minY) should map to SVG (padding, height-padding) for Y-up systems
                // or to SVG (padding, padding) for Y-down systems
                this.offsetX = this.bounds.minX - totalPadding;
                this.offsetY = this.bounds.minY - totalPadding;
            }
        } else if (!this.autoSize) {
            // For fixed-size mode, ensure we have valid dimensions
            if (this.width <= 0) this.width = 400;
            if (this.height <= 0) this.height = 400;
        }

        // Step 3: Transform stored CNC elements to SVG elements
        const transformedElements: string[] = this.elements.map((element) =>
            this.transformElementToSVG(element)
        );

        // Step 4: Render legend elements now that dimensions are finalized
        const legendElements: string[] = this.renderLegend();
        const allElements: string[] = [
            ...transformedElements,
            ...legendElements,
        ];

        return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white" stroke="lightgray" stroke-width="0.5"/>
  ${allElements.join('\n  ')}
</svg>`;
    }
}
