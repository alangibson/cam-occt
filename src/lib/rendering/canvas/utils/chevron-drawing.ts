/**
 * Shared chevron drawing utilities
 */

import type { Point2D } from '$lib/types';
import type { RenderState } from '$lib/rendering/canvas/state/render-state';

// Chevron geometry constants
const WING_LENGTH_RATIO = 0.7;
const BACK_OFFSET_RATIO = 0.3;
const TIP_OFFSET_RATIO = 0.4;
const PI_DIVISOR = 4;
const QUARTER_PI = Math.PI / PI_DIVISOR;
const CHEVRON_LINE_WIDTH = 1.5;

/**
 * Draw a chevron arrow at the specified location
 */
export function drawChevronArrow(
    ctx: CanvasRenderingContext2D,
    state: RenderState,
    center: Point2D,
    dirX: number,
    dirY: number,
    perpX: number,
    perpY: number,
    size: number
): void {
    ctx.save();
    ctx.strokeStyle = 'rgb(0, 133, 84)'; // Green color to match cut color
    ctx.lineWidth =
        state.transform.coordinator.screenToWorldDistance(CHEVRON_LINE_WIDTH);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Calculate chevron wing points (90 degree angle between wings)
    const wingLength = size * WING_LENGTH_RATIO;
    const backOffset = size * BACK_OFFSET_RATIO;

    // Wing points: 45 degrees on each side of the direction vector
    const wing1X =
        center.x -
        backOffset * dirX +
        wingLength *
            (dirX * Math.cos(QUARTER_PI) + perpX * Math.sin(QUARTER_PI));
    const wing1Y =
        center.y -
        backOffset * dirY +
        wingLength *
            (dirY * Math.cos(QUARTER_PI) + perpY * Math.sin(QUARTER_PI));

    const wing2X =
        center.x -
        backOffset * dirX +
        wingLength *
            (dirX * Math.cos(QUARTER_PI) - perpX * Math.sin(QUARTER_PI));
    const wing2Y =
        center.y -
        backOffset * dirY +
        wingLength *
            (dirY * Math.cos(QUARTER_PI) - perpY * Math.sin(QUARTER_PI));

    const tipX = center.x + size * TIP_OFFSET_RATIO * dirX;
    const tipY = center.y + size * TIP_OFFSET_RATIO * dirY;

    // Draw the chevron (two lines forming arrow shape)
    ctx.beginPath();
    ctx.moveTo(wing1X, wing1Y);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(wing2X, wing2Y);
    ctx.stroke();

    ctx.restore();
}
