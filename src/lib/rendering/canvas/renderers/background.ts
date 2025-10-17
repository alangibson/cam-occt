/**
 * BackgroundRenderer - Renders background elements like origin cross and grid
 */

import { BaseRenderer } from './base';
import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import { screenToWorldDistance } from '$lib/rendering/canvas/state/render-state';
import { LayerId } from '$lib/rendering/canvas/layers/types';
import type { Point2D } from '$lib/geometry/point';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
import { getDefaults } from '$lib/config';

// Constants for background rendering
const ORIGIN_CROSS_COLOR = '#888888'; // Gray color as specified in CLAUDE.md
const ORIGIN_CROSS_LINE_WIDTH = 1; // 1px line width

/**
 * Renders static background elements including the origin cross
 */
export class BackgroundRenderer extends BaseRenderer {
    constructor(coordinator: CoordinateTransformer) {
        super('background-renderer', LayerId.BACKGROUND, coordinator);
    }

    render(ctx: CanvasRenderingContext2D, state: RenderState): void {
        // Draw origin cross at world coordinate (0, 0)
        this.drawOriginCross(ctx, state);
    }

    /**
     * Draw the origin cross at world coordinate (0, 0)
     */
    private drawOriginCross(
        ctx: CanvasRenderingContext2D,
        state: RenderState
    ): void {
        const worldOrigin: Point2D = { x: 0, y: 0 };

        // Get unit-aware origin cross size from DefaultsManager
        const defaults = getDefaults();
        const originCrossSize = defaults.geometry.originCrossSize;

        // Set origin cross styling
        ctx.strokeStyle = ORIGIN_CROSS_COLOR;
        // Convert screen pixels to world units using utility function
        ctx.lineWidth = screenToWorldDistance(state, ORIGIN_CROSS_LINE_WIDTH);
        ctx.lineCap = 'round';

        // Draw horizontal line of the cross
        ctx.beginPath();
        ctx.moveTo(worldOrigin.x - originCrossSize, worldOrigin.y);
        ctx.lineTo(worldOrigin.x + originCrossSize, worldOrigin.y);
        ctx.stroke();

        // Draw vertical line of the cross
        ctx.beginPath();
        ctx.moveTo(worldOrigin.x, worldOrigin.y - originCrossSize);
        ctx.lineTo(worldOrigin.x, worldOrigin.y + originCrossSize);
        ctx.stroke();
    }
}
