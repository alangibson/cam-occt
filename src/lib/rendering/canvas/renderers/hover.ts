import { BaseRenderer } from './base';
import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import { DrawingContext } from '$lib/rendering/canvas/utils/context';
import { LayerId } from '$lib/rendering/canvas/layers/types';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
import {
    getShapeChainId,
    getChainShapeIds,
} from '$lib/stores/chains/functions';
import { drawShape } from '$lib/rendering/canvas/shape-drawing';

/**
 * HoverRenderer handles rendering of hover effects for shapes, chains, parts, paths, and rapids
 * This renderer draws orange hover highlights on top of the base geometry
 */
// Constants for hover rendering
const HOVER_LINE_WIDTH = 1.5;
const DASH_SIZE_MULTIPLIER = 3;

export class HoverRenderer extends BaseRenderer {
    constructor(coordinator: CoordinateTransformer) {
        super('hover', LayerId.SELECTION, coordinator);
    }

    private readonly HOVER_COLOR = '#ff6600';

    render(ctx: CanvasRenderingContext2D, state: RenderState): void {
        if (!state.drawing) return;

        const drawingContext = new DrawingContext(ctx, state.transform);

        // Render hovered shape
        this.renderHoveredShape(ctx, drawingContext, state);

        // Render hovered rapid
        this.renderHoveredRapid(ctx, drawingContext, state);

        // Render tooltip if present
        this.renderTooltip(ctx, drawingContext, state);
    }

    private renderHoveredShape(
        ctx: CanvasRenderingContext2D,
        drawingContext: DrawingContext,
        state: RenderState
    ): void {
        if (!state.selection?.hoveredShape) return;

        const shapes = state.drawing?.shapes || [];
        const shape = shapes.find((s) => s.id === state.selection.hoveredShape);
        if (!shape) return;

        // Don't render hover if shape is already selected
        if (state.selection.selectedShapes.has(shape.id)) return;

        ctx.save();
        ctx.strokeStyle = this.HOVER_COLOR;
        ctx.lineWidth = drawingContext.screenToWorldDistance(HOVER_LINE_WIDTH);

        // If treating chains as entities and shape is in a chain, highlight the whole chain
        if (state.treatChainsAsEntities) {
            const chainId = getShapeChainId(shape.id, state.chains);
            if (chainId) {
                const chainShapeIds = getChainShapeIds(shape.id, state.chains);
                for (const shapeId of chainShapeIds) {
                    const chainShape = shapes.find((s) => s.id === shapeId);
                    if (
                        chainShape &&
                        !state.selection.selectedShapes.has(shapeId)
                    ) {
                        drawShape(ctx, chainShape);
                    }
                }
            } else {
                drawShape(ctx, shape);
            }
        } else {
            drawShape(ctx, shape);
        }

        ctx.restore();
    }

    private renderHoveredRapid(
        ctx: CanvasRenderingContext2D,
        drawingContext: DrawingContext,
        state: RenderState
    ): void {
        // Skip if hover state doesn't exist or no hovered rapid
        if (!state.hover?.hoveredRapid || !state.rapids?.length) return;

        const rapid = state.rapids.find(
            (r) => r.id === state.hover!.hoveredRapid
        );
        if (!rapid) return;

        // Don't render hover if rapid is already selected
        if (state.selection.selectedRapidId === rapid.id) return;

        ctx.save();
        ctx.strokeStyle = this.HOVER_COLOR;
        ctx.lineWidth = drawingContext.screenToWorldDistance(HOVER_LINE_WIDTH);
        const dashSize =
            drawingContext.screenToWorldDistance(DASH_SIZE_MULTIPLIER);
        ctx.setLineDash([dashSize, dashSize]);

        ctx.beginPath();
        ctx.moveTo(rapid.start.x, rapid.start.y);
        ctx.lineTo(rapid.end.x, rapid.end.y);
        ctx.stroke();

        ctx.restore();
    }

    private renderTooltip(
        ctx: CanvasRenderingContext2D,
        drawingContext: DrawingContext,
        state: RenderState
    ): void {
        // Check if tooltip should be shown - skip if hover state doesn't exist
        if (!state.hover?.mousePosition || !state.selection?.hoveredShape)
            return;

        const shapes = state.drawing?.shapes || [];
        const shape = shapes.find((s) => s.id === state.selection.hoveredShape);
        if (!shape) return;

        // Get shape information for tooltip
        const chainId = getShapeChainId(shape.id, state.chains);
        let tooltipText = `Shape: ${shape.id}`;
        if (chainId) {
            tooltipText += `\nChain: ${chainId}`;
        }

        // Convert mouse position to world coordinates for tooltip placement
        const worldPos = state.transform.coordinator.screenToWorld(
            state.hover!.mousePosition
        );

        // Offset tooltip slightly from cursor
        const TOOLTIP_OFFSET = 20; // Tooltip offset in pixels
        const tooltipOffset =
            drawingContext.screenToWorldDistance(TOOLTIP_OFFSET);
        const x = worldPos.x + tooltipOffset;
        const y = worldPos.y - tooltipOffset;

        // Render tooltip background
        ctx.save();

        // Measure text
        const FONT_SIZE = 12;
        ctx.font = `${drawingContext.screenToWorldDistance(FONT_SIZE)}px sans-serif`;
        const metrics = ctx.measureText(tooltipText);
        const PADDING_SIZE = 4;
        const padding = drawingContext.screenToWorldDistance(PADDING_SIZE);

        // Draw background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(
            x - padding,
            y - drawingContext.screenToWorldDistance(FONT_SIZE) - padding,
            metrics.width + padding * 2,
            drawingContext.screenToWorldDistance(FONT_SIZE + PADDING_SIZE) +
                padding * 2
        );

        // Draw text
        ctx.fillStyle = 'white';
        ctx.fillText(tooltipText, x, y);

        ctx.restore();
    }

    hitWorld(): null {
        // Hover overlays don't participate in hit testing
        return null;
    }
}
