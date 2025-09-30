/**
 * Rapid renderer for rapid movement lines
 */

import { BaseRenderer } from './base';
import { LayerId } from '$lib/rendering/canvas/layers/types';
import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import type { HitTestResult } from '$lib/rendering/canvas/utils/hit-test';
import {
    HitTestType,
    HitTestUtils,
} from '$lib/rendering/canvas/utils/hit-test';
import type { Point2D } from '$lib/types';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';

// Constants for styling
const HIT_TEST_TOLERANCE_PIXELS = 5;
const SELECTED_LINE_WIDTH = 2;
const HIGHLIGHTED_LINE_WIDTH = 1.5;
const DEFAULT_LINE_WIDTH = 0.5;
const DASH_SIZE = 5;
const HIGHLIGHTED_DASH_SIZE = 3;

/**
 * Rapid renderer that handles rapid movement line rendering and hit detection
 */
export class RapidRenderer extends BaseRenderer {
    constructor(coordinator: CoordinateTransformer) {
        super('rapid-renderer', LayerId.RAPIDS, coordinator);
    }

    /**
     * Render all visible rapid movements
     */
    render(ctx: CanvasRenderingContext2D, state: RenderState): void {
        if (
            !state.visibility.showRapids ||
            !state.rapids ||
            state.rapids.length === 0
        )
            return;

        ctx.save();

        state.rapids.forEach((rapid) => {
            // Determine visual state
            const isSelected = state.selection.selectedRapidId === rapid.id;
            const isHighlighted =
                state.selection.highlightedRapidId === rapid.id;
            const isHovered = state.hover?.hoveredRapid === rapid.id;

            // Set styling based on state
            if (isSelected) {
                ctx.strokeStyle = '#ff6600'; // Orange for selected (same as selected shapes)
                ctx.lineWidth =
                    state.transform.coordinator.screenToWorldDistance(
                        SELECTED_LINE_WIDTH
                    ); // Thicker line
                ctx.setLineDash([]); // Solid line for selected
            } else if (isHovered) {
                ctx.strokeStyle = '#ff6600'; // Orange for hovered
                ctx.lineWidth =
                    state.transform.coordinator.screenToWorldDistance(
                        HIGHLIGHTED_LINE_WIDTH
                    ); // Medium thickness
                const dashSize =
                    state.transform.coordinator.screenToWorldDistance(
                        HIGHLIGHTED_DASH_SIZE
                    );
                ctx.setLineDash([dashSize, dashSize]); // Shorter dashes
            } else if (isHighlighted) {
                ctx.strokeStyle = '#ff6600'; // Orange for highlighted
                ctx.lineWidth =
                    state.transform.coordinator.screenToWorldDistance(
                        HIGHLIGHTED_LINE_WIDTH
                    ); // Medium thickness
                const dashSize =
                    state.transform.coordinator.screenToWorldDistance(
                        HIGHLIGHTED_DASH_SIZE
                    );
                ctx.setLineDash([dashSize, dashSize]); // Shorter dashes
            } else {
                ctx.strokeStyle = 'rgb(0, 83, 135)'; // RAL 5005 Signal Blue for normal
                ctx.lineWidth =
                    state.transform.coordinator.screenToWorldDistance(
                        DEFAULT_LINE_WIDTH
                    ); // Thin line
                const dashSize =
                    state.transform.coordinator.screenToWorldDistance(
                        DASH_SIZE
                    );
                ctx.setLineDash([dashSize, dashSize]); // Normal dashes
            }

            ctx.beginPath();
            ctx.moveTo(rapid.start.x, rapid.start.y);
            ctx.lineTo(rapid.end.x, rapid.end.y);
            ctx.stroke();
        });

        ctx.restore();
    }

    /**
     * Test if a point hits any rapid line
     */
    hitWorld(point: Point2D, state: RenderState): HitTestResult | null {
        if (
            !state.visibility.showRapids ||
            !state.rapids ||
            state.rapids.length === 0
        )
            return null;

        const totalScale =
            state.transform.zoomScale * state.transform.unitScale;
        const tolerance = HIT_TEST_TOLERANCE_PIXELS / totalScale; // Screen pixels in world units

        for (const rapid of state.rapids) {
            const distance = HitTestUtils.distanceToLineSegment(
                point,
                rapid.start,
                rapid.end
            );

            if (distance < tolerance) {
                return {
                    type: HitTestType.RAPID,
                    id: rapid.id,
                    distance,
                    point,
                    metadata: { rapid },
                };
            }
        }

        return null;
    }
}
