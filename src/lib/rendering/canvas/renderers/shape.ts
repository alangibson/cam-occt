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
import type {
    Shape,
    Line,
    Arc,
    Circle,
    Polyline,
    Ellipse,
    Point2D,
} from '$lib/types';
import { GeometryType } from '$lib/types';
import type { Spline } from '$lib/geometry/spline';
import {
    getShapeChainId,
    getChainShapeIds,
} from '$lib/stores/chains/functions';
import { getChainPartType, getPartChainIds } from '$lib/stores/parts/functions';
import { tessellateSpline } from '$lib/geometry/spline';
import { distanceFromEllipsePerimeter } from '$lib/geometry/ellipse/index';
import { drawShape } from '$lib/rendering/canvas/shape-drawing';
import { getShapeNormal, getShapeMidpoint } from '$lib/geometry/shape/functions';
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
const SELECTED_LINE_WIDTH = 2;
const HOVERED_LINE_WIDTH = 1.5;
const PATH_SELECTED_LINE_WIDTH = 3;
const PATH_HIGHLIGHTED_LINE_WIDTH = 3;
const PATH_HIGHLIGHTED_SHADOW_BLUR = 4;
const CHAIN_SELECTED_LINE_WIDTH = 2;
const PART_SELECTED_LINE_WIDTH = 2.5;
const PART_SELECTED_SHADOW_BLUR = 2;
const CHAIN_HIGHLIGHTED_LINE_WIDTH = 2;
const PART_HIGHLIGHTED_LINE_WIDTH = 2.5;
const PART_HIGHLIGHTED_SHADOW_BLUR = 3;
const PART_HOVERED_LINE_WIDTH = 2;
const PATH_LINE_WIDTH = 2;
const PART_SHELL_LINE_WIDTH = 1.5;
const PART_HOLE_LINE_WIDTH = 1.5;
const CHAIN_FALLBACK_LINE_WIDTH = 1.5;
const DEFAULT_LINE_WIDTH = 1;
const NORMAL_LINE_LENGTH = 30; // Length of normal lines in screen pixels
const NORMAL_INDICATOR_RADIUS = 3; // Radius of the circle at normal line start

/**
 * Shape renderer that handles all basic geometry rendering
 */
export class ShapeRenderer extends BaseRenderer {
    constructor(coordinator: CoordinateTransformer) {
        super('shape-renderer', LayerId.SHAPES, coordinator);
    }

    /**
     * Render all visible shapes
     */
    render(ctx: CanvasRenderingContext2D, state: RenderState): void {
        if (!state.drawing) return;

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
        const shouldCull =
            state.drawing.shapes.length > VIEWPORT_CULLING_THRESHOLD;
        const shapesToRender = shouldCull
            ? cullShapesToViewport(
                  state.drawing.shapes,
                  viewportBounds,
                  VIEWPORT_CULLING_BUFFER
              ).visibleShapes
            : state.drawing.shapes;

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
            const partType = getChainPartType(chainId || '', state.parts);
            let isSelected = state.selection.selectedShapes.has(shape.id);
            let isHovered = state.selection.hoveredShape === shape.id;

            // If treating chains as entities, check if any shape in the chain is selected/hovered
            if (state.treatChainsAsEntities && chainId) {
                const chainShapeIds = getChainShapeIds(shape.id, state.chains);
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
                chainId,
                partType,
                state,
                drawingContext
            );
        });

        // Render shape normals if enabled
        if (state.visibility.showShapeNormals) {
            this.drawShapeNormals(ctx, state, shapesToRender);
        }
    }

    private drawShapeNormals(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        shapes: Shape[]
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
            const midpoint = getShapeMidpoint(shape, 0.5);
            if (midpoint) {
                // Calculate normal at midpoint (t = 0.5)
                const normal = getShapeNormal(shape, 0.5);
                this.drawNormalLine(ctx, state, midpoint, normal);
            }
        }
    }

    private drawNormalLine(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        connectionPoint: Point2D,
        normalDirection: Point2D
    ): void {
        // Calculate normal line length in world coordinates
        const normalWorldLength =
            state.transform.coordinator.screenToWorldDistance(
                NORMAL_LINE_LENGTH
            );

        // Calculate end point of normal line
        const endX = connectionPoint.x + normalDirection.x * normalWorldLength;
        const endY = connectionPoint.y + normalDirection.y * normalWorldLength;

        // Draw the normal line
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 150, 255, 0.7)'; // Light blue
        ctx.lineWidth = state.transform.coordinator.screenToWorldDistance(1);
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(connectionPoint.x, connectionPoint.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Draw a small circle at the start point for clarity
        ctx.fillStyle = 'rgba(0, 150, 255, 0.7)'; // Light blue
        const circleRadius = state.transform.coordinator.screenToWorldDistance(
            NORMAL_INDICATOR_RADIUS
        );
        ctx.beginPath();
        ctx.arc(
            connectionPoint.x,
            connectionPoint.y,
            circleRadius,
            0,
            2 * Math.PI
        );
        ctx.fill();

        ctx.restore();
    }

    /**
     * Test if a point hits any shape
     */
    hitWorld(point: Point2D, state: RenderState): HitTestResult | null {
        if (!state.drawing) return null;

        // For hit testing, we can use a simple tolerance calculation without full drawing context
        // since we only need the tolerance value, not actual drawing operations
        const totalScale =
            state.transform.zoomScale * state.transform.unitScale;
        const tolerance = HIT_TEST_TOLERANCE_PIXELS / totalScale; // Screen pixels in world units

        for (const shape of state.drawing.shapes) {
            // Check if layer is visible before hit testing
            if (state.respectLayerVisibility) {
                const shapeLayer = shape.layer || '0';
                const isVisible =
                    state.visibility.layerVisibility[shapeLayer] !== false;
                if (!isVisible) continue;
            }

            if (HitTestUtils.isPointNearShape(point, shape, tolerance)) {
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
        shape: Shape,
        isSelected: boolean,
        isHovered: boolean = false,
        chainId: string | null = null,
        partType: 'shell' | 'hole' | null = null,
        state: RenderState,
        drawingContext: DrawingContext
    ): void {
        // Save context state
        ctx.save();

        // Get chain IDs for part highlighting
        const highlightedChainIds = state.selection.highlightedPartId
            ? getPartChainIds(state.selection.highlightedPartId, state.parts)
            : [];
        const hoveredChainIds = state.selection.hoveredPartId
            ? getPartChainIds(state.selection.hoveredPartId, state.parts)
            : [];
        const selectedChainIds = state.selection.selectedPartId
            ? getPartChainIds(state.selection.selectedPartId, state.parts)
            : [];

        // Check various highlighting states
        const isPartHighlighted =
            chainId && highlightedChainIds.includes(chainId);
        const isPartHovered = chainId && hoveredChainIds.includes(chainId);
        const isPartSelected = chainId && selectedChainIds.includes(chainId);
        const isChainSelected =
            chainId && state.selection.selectedChainId === chainId;

        const isChainHighlighted =
            chainId && state.selection.highlightedChainId === chainId;
        const hasPath = chainId && state.chainsWithPaths.includes(chainId);

        // Check if this path is selected or highlighted
        const isPathSelected =
            state.selection.selectedPathId &&
            state.paths.some(
                (p) =>
                    p.id === state.selection.selectedPathId &&
                    p.chainId === chainId
            );
        const isPathHighlighted =
            state.selection.highlightedPathId &&
            state.paths.some(
                (p) =>
                    p.id === state.selection.highlightedPathId &&
                    p.chainId === chainId
            );

        // Apply styling based on priority: selected > hovered > path selected > path highlighted > etc.
        if (isSelected) {
            ctx.strokeStyle = '#ff6600';
            ctx.lineWidth =
                drawingContext.screenToWorldDistance(SELECTED_LINE_WIDTH);
        } else if (isHovered) {
            ctx.strokeStyle = '#ff6600';
            ctx.lineWidth =
                drawingContext.screenToWorldDistance(HOVERED_LINE_WIDTH);
        } else if (isPathSelected) {
            ctx.strokeStyle = 'rgb(0, 133, 84)'; // Dark green color for selected path
            ctx.lineWidth = drawingContext.screenToWorldDistance(
                PATH_SELECTED_LINE_WIDTH
            );
        } else if (isPathHighlighted) {
            ctx.strokeStyle = '#15803d'; // Dark green color for highlighted path
            ctx.lineWidth = drawingContext.screenToWorldDistance(
                PATH_HIGHLIGHTED_LINE_WIDTH
            );
            ctx.shadowColor = '#15803d';
            ctx.shadowBlur = drawingContext.screenToWorldDistance(
                PATH_HIGHLIGHTED_SHADOW_BLUR
            );
        } else if (isChainSelected) {
            ctx.strokeStyle = '#f59e0b'; // Dark amber color for selected chain
            ctx.lineWidth = drawingContext.screenToWorldDistance(
                CHAIN_SELECTED_LINE_WIDTH
            );
        } else if (isPartSelected) {
            ctx.strokeStyle = '#f59e0b'; // Dark amber color for selected part
            ctx.lineWidth = drawingContext.screenToWorldDistance(
                PART_SELECTED_LINE_WIDTH
            );
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = drawingContext.screenToWorldDistance(
                PART_SELECTED_SHADOW_BLUR
            );
        } else if (isChainHighlighted) {
            ctx.strokeStyle = '#fbbf24'; // Light amber color for highlighted chain
            ctx.lineWidth = drawingContext.screenToWorldDistance(
                CHAIN_HIGHLIGHTED_LINE_WIDTH
            );
        } else if (isPartHighlighted) {
            ctx.strokeStyle = '#f59e0b'; // Amber color for highlighted part
            ctx.lineWidth = drawingContext.screenToWorldDistance(
                PART_HIGHLIGHTED_LINE_WIDTH
            );
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = drawingContext.screenToWorldDistance(
                PART_HIGHLIGHTED_SHADOW_BLUR
            );
        } else if (isPartHovered) {
            ctx.strokeStyle = '#fbbf24'; // Light amber color for hovered part
            ctx.lineWidth = drawingContext.screenToWorldDistance(
                PART_HOVERED_LINE_WIDTH
            );
        } else if (hasPath) {
            ctx.strokeStyle = 'rgb(0, 133, 84)'; // Green color for chains with paths
            ctx.lineWidth =
                drawingContext.screenToWorldDistance(PATH_LINE_WIDTH);
        } else if (partType === 'shell') {
            ctx.strokeStyle = 'rgb(0, 83, 135)'; // RAL 5005 Signal Blue for part shells
            ctx.lineWidth = drawingContext.screenToWorldDistance(
                PART_SHELL_LINE_WIDTH
            );
        } else if (partType === 'hole') {
            ctx.strokeStyle = 'rgba(0, 83, 135, 0.6)'; // Lighter RAL 5005 Signal Blue for holes
            ctx.lineWidth =
                drawingContext.screenToWorldDistance(PART_HOLE_LINE_WIDTH);
        } else if (chainId) {
            ctx.strokeStyle = 'rgb(0, 83, 135)'; // RAL 5005 Signal Blue for chained shapes (fallback)
            ctx.lineWidth = drawingContext.screenToWorldDistance(
                CHAIN_FALLBACK_LINE_WIDTH
            );
        } else {
            ctx.strokeStyle = '#000000';
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
    private calculateDistanceToShape(point: Point2D, shape: Shape): number {
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
