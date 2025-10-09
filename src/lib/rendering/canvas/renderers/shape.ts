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
import { drawNormalLine } from './normal-renderer-utils';
import { drawShape } from '$lib/rendering/canvas/shape-drawing';
import { drawChevronArrow } from '$lib/rendering/canvas/utils/chevron-drawing';
import {
    getShapeNormal,
    getShapeMidpoint,
    getShapePointAt,
} from '$lib/geometry/shape/functions';
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
const CUT_SELECTED_LINE_WIDTH = 3;
const CUT_HIGHLIGHTED_LINE_WIDTH = 3;
const CUT_HIGHLIGHTED_SHADOW_BLUR = 4;
const CHAIN_SELECTED_LINE_WIDTH = 2;
const PART_SELECTED_LINE_WIDTH = 2.5;
const PART_SELECTED_SHADOW_BLUR = 2;
const CHAIN_HIGHLIGHTED_LINE_WIDTH = 2;
const PART_HIGHLIGHTED_LINE_WIDTH = 2.5;
const PART_HIGHLIGHTED_SHADOW_BLUR = 3;
const PART_HOVERED_LINE_WIDTH = 2;
const CUT_LINE_WIDTH = 2;
const PART_SHELL_LINE_WIDTH = 1.5;
const PART_HOLE_LINE_WIDTH = 1.5;
const CHAIN_FALLBACK_LINE_WIDTH = 1.5;
const DEFAULT_LINE_WIDTH = 1;

// Constants for shape winding direction and tangent lines
const SHAPE_CHEVRON_SIZE_PX = 8;
const SHAPE_TANGENT_LINE_LENGTH = 50; // Length of tangent lines in screen pixels
const SHAPE_TANGENT_LINE_WIDTH = 2;

/**
 * Shape renderer that handles all basic geometry rendering
 */
export class ShapeRenderer extends BaseRenderer {
    private getShapes: (state: RenderState) => Shape[];

    constructor(
        id: string,
        coordinator: CoordinateTransformer,
        getShapes: (state: RenderState) => Shape[]
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

            // If selection mode is chain or part, check if any shape in the chain is selected/hovered
            if (
                (state.selectionMode === 'chain' ||
                    state.selectionMode === 'part') &&
                chainId
            ) {
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

        // Render shape winding direction if enabled
        if (state.visibility.showShapeWindingDirection) {
            this.drawShapeWindingDirections(ctx, state, shapesToRender);
        }

        // Render shape tangent lines if enabled
        if (state.visibility.showShapeTangentLines) {
            this.drawShapeTangentLines(ctx, state, shapesToRender);
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
        shapes: Shape[],
        callback: (shape: Shape, midpoint: Point2D, direction: Point2D) => void
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
        shapes: Shape[]
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
        shapes: Shape[]
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
    private getShapeDirectionAtMidpoint(shape: Shape): Point2D | null {
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
        const hasCut = chainId && state.chainsWithCuts.includes(chainId);

        // Check if this cut is selected or highlighted
        const isCutSelected =
            state.selection.selectedCutId &&
            state.cuts.some(
                (cut) =>
                    cut.id === state.selection.selectedCutId &&
                    cut.chainId === chainId
            );
        const isCutHighlighted =
            state.selection.highlightedCutId &&
            state.cuts.some(
                (cut) =>
                    cut.id === state.selection.highlightedCutId &&
                    cut.chainId === chainId
            );

        // Apply styling based on priority: selected > hovered > cut selected > cut highlighted > etc.
        if (isSelected) {
            ctx.strokeStyle = '#ff6600';
            ctx.lineWidth =
                drawingContext.screenToWorldDistance(SELECTED_LINE_WIDTH);
        } else if (isHovered) {
            ctx.strokeStyle = '#ff6600';
            ctx.lineWidth =
                drawingContext.screenToWorldDistance(HOVERED_LINE_WIDTH);
        } else if (isCutSelected) {
            ctx.strokeStyle = 'rgb(0, 133, 84)'; // Dark green color for selected cut
            ctx.lineWidth = drawingContext.screenToWorldDistance(
                CUT_SELECTED_LINE_WIDTH
            );
        } else if (isCutHighlighted) {
            ctx.strokeStyle = '#15803d'; // Dark green color for highlighted cut
            ctx.lineWidth = drawingContext.screenToWorldDistance(
                CUT_HIGHLIGHTED_LINE_WIDTH
            );
            ctx.shadowColor = '#15803d';
            ctx.shadowBlur = drawingContext.screenToWorldDistance(
                CUT_HIGHLIGHTED_SHADOW_BLUR
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
        } else if (hasCut) {
            ctx.strokeStyle = 'rgb(0, 133, 84)'; // Green color for chains with cuts
            ctx.lineWidth =
                drawingContext.screenToWorldDistance(CUT_LINE_WIDTH);
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
