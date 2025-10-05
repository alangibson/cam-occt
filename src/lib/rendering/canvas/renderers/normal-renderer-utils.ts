import type { Point2D } from '$lib/types';
import type { RenderState } from '$lib/rendering/canvas/state/render-state';

const NORMAL_LINE_LENGTH = 20; // Screen pixels
const NORMAL_LINE_WIDTH = 2; // Screen pixels
const DASH_SIZE = 4;
const ARROW_LENGTH_RATIO = 0.15;
const ARROW_ANGLE_DEGREES = 30;
const DEGREES_TO_RADIANS = 180;

export function drawNormalLine(
    ctx: CanvasRenderingContext2D,
    state: RenderState,
    connectionPoint: Point2D,
    normalDirection: Point2D,
    color: string
): void {
    // Calculate normal line length in world coordinates
    const normalWorldLength =
        state.transform.coordinator.screenToWorldDistance(NORMAL_LINE_LENGTH);

    // Calculate end point of normal line
    const endX = connectionPoint.x + normalDirection.x * normalWorldLength;
    const endY = connectionPoint.y + normalDirection.y * normalWorldLength;

    // Draw the normal line
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth =
        state.transform.coordinator.screenToWorldDistance(NORMAL_LINE_WIDTH);
    ctx.setLineDash([DASH_SIZE, DASH_SIZE]);

    ctx.beginPath();
    ctx.moveTo(connectionPoint.x, connectionPoint.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Draw arrowhead
    const arrowLength = normalWorldLength * ARROW_LENGTH_RATIO;
    const arrowAngle = (Math.PI * ARROW_ANGLE_DEGREES) / DEGREES_TO_RADIANS; // Convert to radians

    const angle = Math.atan2(normalDirection.y, normalDirection.x);

    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
        endX - arrowLength * Math.cos(angle - arrowAngle),
        endY - arrowLength * Math.sin(angle - arrowAngle)
    );
    ctx.moveTo(endX, endY);
    ctx.lineTo(
        endX - arrowLength * Math.cos(angle + arrowAngle),
        endY - arrowLength * Math.sin(angle + arrowAngle)
    );
    ctx.stroke();

    ctx.restore();
}
