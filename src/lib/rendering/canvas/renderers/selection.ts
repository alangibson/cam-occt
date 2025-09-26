import { BaseRenderer } from './base';
import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import { DrawingContext } from '$lib/rendering/canvas/utils/context';
import { LayerId } from '$lib/rendering/canvas/layers/types';
import type { Point2D } from '$lib/types';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
// Removed unused chain imports
import { drawShape } from '$lib/rendering/canvas/shape-drawing';

/**
 * SelectionRenderer handles rendering of selection overlays for shapes, chains, parts, paths, and rapids
 * This renderer draws orange selection highlights on top of the base geometry
 */

// Constants for selection rendering
const SELECTED_LINE_WIDTH = 2;
const SELECTED_SHADOW_BLUR = 4;
const DASH_LENGTH = 5;

export class SelectionRenderer extends BaseRenderer {
    constructor(coordinator: CoordinateTransformer) {
        super('selection', LayerId.SELECTION, coordinator);
    }

    private readonly SELECTED_COLOR = '#ff6600';

    render(ctx: CanvasRenderingContext2D, state: RenderState): void {
        if (!state.drawing) return;

        const drawingContext = new DrawingContext(ctx, state.transform);

        // Render selected shapes
        this.renderSelectedShapes(ctx, drawingContext, state);

        // Render selected rapids
        this.renderSelectedRapids(ctx, drawingContext, state);

        // Render selected offset shape
        this.renderSelectedOffsetShape(ctx, drawingContext, state);

        // Render marquee selection box if present
        this.renderMarqueeSelection(ctx, drawingContext, state);
    }

    private renderSelectedShapes(
        ctx: CanvasRenderingContext2D,
        drawingContext: DrawingContext,
        state: RenderState
    ): void {
        if (!state.selection.selectedShapes.size) return;

        const shapes = state.drawing?.shapes || [];

        ctx.save();
        ctx.strokeStyle = this.SELECTED_COLOR;
        ctx.lineWidth =
            drawingContext.screenToWorldDistance(SELECTED_LINE_WIDTH);
        ctx.shadowColor = this.SELECTED_COLOR;
        ctx.shadowBlur =
            drawingContext.screenToWorldDistance(SELECTED_SHADOW_BLUR);

        for (const shape of shapes) {
            if (state.selection.selectedShapes.has(shape.id)) {
                drawShape(ctx, shape);
            }
        }

        ctx.restore();
    }

    private renderSelectedRapids(
        ctx: CanvasRenderingContext2D,
        drawingContext: DrawingContext,
        state: RenderState
    ): void {
        if (!state.selection.selectedRapidId || !state.rapids?.length) return;

        const rapid = state.rapids.find(
            (r) => r.id === state.selection.selectedRapidId
        );
        if (!rapid) return;

        ctx.save();
        ctx.strokeStyle = this.SELECTED_COLOR;
        ctx.lineWidth =
            drawingContext.screenToWorldDistance(SELECTED_LINE_WIDTH);
        ctx.setLineDash([]); // Solid line for selected

        ctx.beginPath();
        ctx.moveTo(rapid.start.x, rapid.start.y);
        ctx.lineTo(rapid.end.x, rapid.end.y);
        ctx.stroke();

        ctx.restore();
    }

    private renderSelectedOffsetShape(
        ctx: CanvasRenderingContext2D,
        drawingContext: DrawingContext,
        state: RenderState
    ): void {
        if (!state.selection.selectedOffsetShape) return;

        ctx.save();
        ctx.strokeStyle = this.SELECTED_COLOR;
        ctx.lineWidth =
            drawingContext.screenToWorldDistance(SELECTED_LINE_WIDTH);
        ctx.shadowColor = this.SELECTED_COLOR;
        ctx.shadowBlur =
            drawingContext.screenToWorldDistance(SELECTED_SHADOW_BLUR);

        drawShape(ctx, state.selection.selectedOffsetShape);

        ctx.restore();
    }

    private renderMarqueeSelection(
        ctx: CanvasRenderingContext2D,
        drawingContext: DrawingContext,
        state: RenderState
    ): void {
        // Check if there's an active marquee selection
        interface MarqueeState extends RenderState {
            marqueeSelection?: {
                start: Point2D;
                end: Point2D;
            };
        }
        const marquee = (state as MarqueeState).marqueeSelection;
        if (!marquee || !marquee.start || !marquee.end) return;

        ctx.save();
        ctx.strokeStyle = this.SELECTED_COLOR;
        ctx.lineWidth = drawingContext.screenToWorldDistance(1);
        ctx.setLineDash([
            drawingContext.screenToWorldDistance(DASH_LENGTH),
            drawingContext.screenToWorldDistance(DASH_LENGTH),
        ]);

        const width = marquee.end.x - marquee.start.x;
        const height = marquee.end.y - marquee.start.y;

        ctx.strokeRect(marquee.start.x, marquee.start.y, width, height);

        ctx.restore();
    }

    hitWorld(): null {
        // Selection overlays don't participate in hit testing
        return null;
    }
}
