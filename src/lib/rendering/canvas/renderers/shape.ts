/**
 * Shape renderer for basic geometry shapes
 */

import { BaseRenderer } from './base';
import { LayerId } from '$lib/rendering/canvas/layers/types';
import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import type { HitTestResult } from '$lib/rendering/canvas/utils/hit-test';
import {
    HitTestType,
    HitTestUtils,
} from '$lib/rendering/canvas/utils/hit-test';
import type { Polyline } from '$lib/geometry/polyline/interfaces';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { Shape } from '$lib/cam/shape/classes';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { Spline } from '$lib/geometry/spline/interfaces';
import {
    getShapeChainId,
    getChainShapeIds,
} from '$lib/stores/chains/functions';
import { tessellateSpline } from '$lib/geometry/spline/functions';
import { distanceFromEllipsePerimeter } from '$lib/geometry/ellipse/functions';
import {
    drawNormalLine,
    drawTessellationPoint,
    getTessellationPointSize,
    getTessellationBorderWidth,
} from './normal-renderer-utils';
import { drawShape } from '$lib/rendering/canvas/shape-drawing';
import { drawChevronArrow } from '$lib/rendering/canvas/utils/chevron-drawing';
import {
    getShapeNormal,
    getShapeMidpoint,
    getShapePointAt,
    tessellateShape,
} from '$lib/cam/shape/functions';
import { DEFAULT_PART_DETECTION_PARAMETERS } from '$lib/cam/part/defaults';
import {
    calculateViewportBounds,
    cullShapesToViewport,
} from '$lib/rendering/viewport-culling';
import { DrawingContext } from '$lib/rendering/canvas/utils/context';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';

// Constants for styling and rendering
const VIEWPORT_CULLING_THRESHOLD = 100;
const VIEWPORT_CULLING_BUFFER = 50;
const HIT_TEST_TOLERANCE_PIXELS = 5;
const SELECTED_LINE_WIDTH = 1;
const HOVERED_LINE_WIDTH = 1;
const DEFAULT_LINE_WIDTH = 1;

// Constants for shape winding direction and tangent lines
const SHAPE_CHEVRON_SIZE_PX = 8;
const SHAPE_TANGENT_LINE_LENGTH = 50; // Length of tangent lines in screen pixels
const SHAPE_TANGENT_LINE_WIDTH = 1;

/**
 * Shape renderer that handles all basic geometry rendering
 */
export class ShapeRenderer extends BaseRenderer {
    private getShapes: (state: RenderState) => ShapeData[];

    constructor(
        id: string,
        coordinator: CoordinateTransformer,
        getShapes: (state: RenderState) => ShapeData[]
    ) {
        super(id, LayerId.SHAPES, coordinator);
        this.getShapes = getShapes;
    }

    /**
     * Render all visible shapes
     */
    render(ctx: CanvasRenderingContext2D, state: RenderState): void {
        // Get shapes from the configured data source
        const shapes = this.getShapes(state);
        if (!shapes || shapes.length === 0) return;

        // Create drawing context for coordinate transformation
        const drawingContext = new DrawingContext(ctx, state.transform);

        // Calculate viewport bounds for culling
        const viewportBounds = calculateViewportBounds(
            ctx.canvas.width,
            ctx.canvas.height,
            state.transform.zoomScale,
            state.transform.panOffset,
            state.transform.unitScale
        );

        // Use viewport culling for large drawings
        const shouldCull = shapes.length > VIEWPORT_CULLING_THRESHOLD;
        const shapesToRender = shouldCull
            ? cullShapesToViewport(
                  shapes,
                  viewportBounds,
                  VIEWPORT_CULLING_BUFFER
              ).visibleShapes
            : shapes;

        // Render shape paths if enabled
        if (state.visibility.showShapePaths) {
            // Render each visible shape
            shapesToRender.forEach((shape) => {
                // Check if layer is visible (only if respectLayerVisibility is true)
                if (state.respectLayerVisibility) {
                    const shapeLayer = shape.layer || '0';
                    const isVisible =
                        state.visibility.layerVisibility[shapeLayer] !== false;
                    if (!isVisible) return;
                }

                const chainId = getShapeChainId(shape.id, state.chains);

                let isSelected = state.selection.selectedShapes.has(shape.id);
                let isHovered = state.selection.hoveredShape === shape.id;

                // If selection mode is chain or part, check if any shape in the chain is selected/hovered
                if (
                    (state.selectionMode === 'chain' ||
                        state.selectionMode === 'part') &&
                    chainId
                ) {
                    const chainShapeIds = getChainShapeIds(
                        shape.id,
                        state.chains
                    );
                    isSelected = chainShapeIds.some((id) =>
                        state.selection.selectedShapes.has(id)
                    );
                    isHovered = chainShapeIds.some(
                        (id) => state.selection.hoveredShape === id
                    );
                }

                this.drawShapeStyled(
                    ctx,
                    shape,
                    isSelected,
                    isHovered,
                    state,
                    drawingContext
                );
            });
        }

        // Render shape normals if enabled
        if (state.visibility.showShapeNormals) {
            this.drawShapeNormals(ctx, state, shapesToRender);
        }

        // Render shape winding direction if enabled
        if (state.visibility.showShapeWindingDirection) {
            this.drawShapeWindingDirections(ctx, state, shapesToRender);
        }

        // Render shape tangent lines if enabled
        if (state.visibility.showShapeTangentLines) {
            this.drawShapeTangentLines(ctx, state, shapesToRender);
        }

        // Render shape tessellation if enabled
        if (state.visibility.showShapeTessellation) {
            this.drawShapeTessellation(ctx, state, shapesToRender);
        }
    }

    private drawShapeNormals(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        shapes: ShapeData[]
    ): void {
        for (const shape of shapes) {
            // Check if layer is visible
            if (state.respectLayerVisibility) {
                const shapeLayer = shape.layer || '0';
                const isVisible =
                    state.visibility.layerVisibility[shapeLayer] !== false;
                if (!isVisible) continue;
            }

            // Get midpoint of the shape
            const MIDPOINT_PARAM = 0.5;
            const midpoint = getShapeMidpoint(shape, MIDPOINT_PARAM);
            if (midpoint) {
                // Calculate normal at midpoint (t = 0.5)
                const normal = getShapeNormal(shape, MIDPOINT_PARAM);
                drawNormalLine(
                    ctx,
                    state,
                    midpoint,
                    normal,
                    'rgba(0, 150, 255, 0.7)' // Light blue
                );
            }
        }
    }

    /**
     * Helper to iterate shapes and apply a callback with midpoint and direction
     */
    private forEachShapeWithDirection(
        state: RenderState,
        shapes: ShapeData[],
        callback: (
            shape: ShapeData,
            midpoint: Point2D,
            direction: Point2D
        ) => void
    ): void {
        for (const shape of shapes) {
            // Check if layer is visible
            if (state.respectLayerVisibility) {
                const shapeLayer = shape.layer || '0';
                const isVisible =
                    state.visibility.layerVisibility[shapeLayer] !== false;
                if (!isVisible) continue;
            }

            // Get midpoint and direction of the shape
            const MIDPOINT_PARAM = 0.5;
            const midpoint = getShapeMidpoint(shape, MIDPOINT_PARAM);
            if (midpoint) {
                const direction = this.getShapeDirectionAtMidpoint(shape);
                if (direction) {
                    callback(shape, midpoint, direction);
                }
            }
        }
    }

    private drawShapeWindingDirections(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        shapes: ShapeData[]
    ): void {
        this.forEachShapeWithDirection(
            state,
            shapes,
            (_, midpoint, direction) => {
                // Calculate perpendicular vector for chevron wings
                const perpX = -direction.y;
                const perpY = direction.x;

                // Get chevron size in world units
                const chevronSize =
                    state.transform.coordinator.screenToWorldDistance(
                        SHAPE_CHEVRON_SIZE_PX
                    );

                drawChevronArrow(
                    ctx,
                    state,
                    midpoint,
                    direction.x,
                    direction.y,
                    perpX,
                    perpY,
                    chevronSize
                );
            }
        );
    }

    private drawShapeTangentLines(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        shapes: ShapeData[]
    ): void {
        this.forEachShapeWithDirection(
            state,
            shapes,
            (_, midpoint, direction) => {
                this.drawShapeTangent(ctx, state, midpoint, direction);
            }
        );
    }

    /**
     * Get the direction vector at the midpoint of a shape
     */
    private getShapeDirectionAtMidpoint(shape: ShapeData): Point2D | null {
        const MIDPOINT_PARAM = 0.5;
        const DELTA = 0.01; // Small offset for direction calculation

        // Get points slightly before and after midpoint
        const t1 = Math.max(0, MIDPOINT_PARAM - DELTA);
        const t2 = Math.min(1, MIDPOINT_PARAM + DELTA);

        const p1 = getShapePointAt(shape, t1);
        const p2 = getShapePointAt(shape, t2);

        if (!p1 || !p2) return null;

        // Calculate direction vector
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;

        // Normalize
        const magnitude = Math.sqrt(dx * dx + dy * dy);
        if (magnitude === 0) return null;

        return {
            x: dx / magnitude,
            y: dy / magnitude,
        };
    }

    /**
     * Draw a tangent line at the specified location (adapted from ChainRenderer)
     */
    private drawShapeTangent(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        point: Point2D,
        direction: Point2D
    ): void {
        // Calculate the length in world coordinates
        const tangentLength = state.transform.coordinator.screenToWorldDistance(
            SHAPE_TANGENT_LINE_LENGTH
        );
        const lineWidth = state.transform.coordinator.screenToWorldDistance(
            SHAPE_TANGENT_LINE_WIDTH
        );

        // Calculate start and end points of the tangent line
        const startPoint = {
            x: point.x - direction.x * tangentLength,
            y: point.y - direction.y * tangentLength,
        };
        const endPoint = {
            x: point.x + direction.x * tangentLength,
            y: point.y + direction.y * tangentLength,
        };

        ctx.save();

        // Set yellow color and line style (same as chain tangents)
        ctx.strokeStyle = '#ffff00'; // Yellow
        ctx.lineWidth = lineWidth;
        ctx.setLineDash([]);

        // Draw the tangent line
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(endPoint.x, endPoint.y);
        ctx.stroke();

        ctx.restore();
    }

    /**
     * Draw tessellation points for shapes
     */
    private drawShapeTessellation(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        shapes: ShapeData[]
    ): void {
        ctx.save();

        const pointSize = getTessellationPointSize(state);
        const borderWidth = getTessellationBorderWidth();

        for (const shape of shapes) {
            // Check if layer is visible
            if (state.respectLayerVisibility) {
                const shapeLayer = shape.layer || '0';
                const isVisible =
                    state.visibility.layerVisibility[shapeLayer] !== false;
                if (!isVisible) continue;
            }

            // Get tessellation points
            const tessellationPoints = tessellateShape(
                shape,
                DEFAULT_PART_DETECTION_PARAMETERS
            );

            // Draw each tessellation point as a small circle
            for (const point of tessellationPoints) {
                drawTessellationPoint(
                    ctx,
                    state,
                    point,
                    pointSize,
                    borderWidth
                );
            }
        }

        ctx.restore();
    }

    /**
     * Test if a point hits any shape
     */
    hitWorld(point: Point2D, state: RenderState): HitTestResult | null {
        // Get shapes from the configured data source
        const shapes = this.getShapes(state);
        if (!shapes || shapes.length === 0) return null;

        // For hit testing, we can use a simple tolerance calculation without full drawing context
        // since we only need the tolerance value, not actual drawing operations
        const totalScale =
            state.transform.zoomScale * state.transform.unitScale;
        const tolerance = HIT_TEST_TOLERANCE_PIXELS / totalScale; // Screen pixels in world units

        for (const shape of shapes) {
            // Check if layer is visible before hit testing
            if (state.respectLayerVisibility) {
                const shapeLayer = shape.layer || '0';
                const isVisible =
                    state.visibility.layerVisibility[shapeLayer] !== false;
                if (!isVisible) continue;
            }

            if (
                HitTestUtils.isPointNearShape(
                    point,
                    new Shape(shape),
                    tolerance
                )
            ) {
                const distance = this.calculateDistanceToShape(point, shape);
                return {
                    type: HitTestType.SHAPE,
                    id: shape.id,
                    distance,
                    point,
                    metadata: { shape },
                };
            }
        }

        return null;
    }

    /**
     * Draw a shape with appropriate styling based on its state
     */
    private drawShapeStyled(
        ctx: CanvasRenderingContext2D,
        shape: ShapeData,
        isSelected: boolean,
        isHovered: boolean,
        state: RenderState,
        drawingContext: DrawingContext
    ): void {
        // Save context state
        ctx.save();

        // Shapes are ONLY black or orange (when selected/hovered)
        // Blue rendering is handled by ChainRenderer and PartRenderer
        if (isSelected) {
            ctx.strokeStyle = '#ff6600'; // Orange for selected
            ctx.lineWidth =
                drawingContext.screenToWorldDistance(SELECTED_LINE_WIDTH);
        } else if (isHovered) {
            ctx.strokeStyle = '#ff6600'; // Orange for hovered
            ctx.lineWidth =
                drawingContext.screenToWorldDistance(HOVERED_LINE_WIDTH);
        } else {
            ctx.strokeStyle = '#000000'; // Black for all other shapes
            ctx.lineWidth =
                drawingContext.screenToWorldDistance(DEFAULT_LINE_WIDTH);
        }

        // Render the shape geometry using shared function
        drawShape(ctx, shape);

        // Restore context state
        ctx.restore();
    }

    /**
     * Calculate the exact distance from a point to a shape
     */
    private calculateDistanceToShape(point: Point2D, shape: ShapeData): number {
        switch (shape.type) {
            case GeometryType.LINE:
                const line = shape.geometry as Line;
                return HitTestUtils.distanceToLineSegment(
                    point,
                    line.start,
                    line.end
                );

            case GeometryType.CIRCLE:
                const circle = shape.geometry as Circle;
                const distToCenter = HitTestUtils.distance(
                    point,
                    circle.center
                );
                return Math.abs(distToCenter - circle.radius);

            case GeometryType.ARC:
                const arc = shape.geometry as Arc;
                return HitTestUtils.distanceToArc(
                    point,
                    arc.center,
                    arc.radius,
                    arc.startAngle,
                    arc.endAngle,
                    arc.clockwise
                );

            case GeometryType.ELLIPSE:
                const ellipse = shape.geometry as Ellipse;
                return distanceFromEllipsePerimeter(point, ellipse);

            case GeometryType.POLYLINE:
                const polyline = shape.geometry as Polyline;
                if (!polyline.shapes || polyline.shapes.length === 0)
                    return Infinity;

                let minDistance = Infinity;
                for (const polylineShape of polyline.shapes) {
                    const distance = this.calculateDistanceToShape(
                        point,
                        polylineShape
                    );
                    minDistance = Math.min(minDistance, distance);
                }
                return minDistance;

            case GeometryType.SPLINE:
                const spline = shape.geometry as Spline;
                const evaluatedPoints = tessellateSpline(spline, {
                    numSamples: 100, // More points for accurate distance calculation
                }).points;

                if (!evaluatedPoints || evaluatedPoints.length < 2)
                    return Infinity;

                let minDist = Infinity;
                for (let i = 0; i < evaluatedPoints.length - 1; i++) {
                    const distance = HitTestUtils.distanceToLineSegment(
                        point,
                        evaluatedPoints[i],
                        evaluatedPoints[i + 1]
                    );
                    minDist = Math.min(minDist, distance);
                }

                return minDist;

            default:
                return Infinity;
        }
    }
}
