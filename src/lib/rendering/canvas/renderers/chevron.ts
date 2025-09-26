import { BaseRenderer } from './base';
import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import type { HitTestResult } from '$lib/rendering/canvas/utils/hit-test';
import type { Point2D, Shape } from '$lib/types';
import type { Path } from '$lib/stores/paths/interfaces';
import { LayerId as LayerIdEnum } from '$lib/rendering/canvas/layers/types';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
import { samplePathAtDistanceIntervals } from '$lib/geometry/shape/functions';
import { isPathEnabledForRendering } from '$lib/rendering/canvas/utils/renderer-utils';

/**
 * Physical spacing between cut direction chevrons in drawing units
 */
const CHEVRON_SPACING_UNITS: number = 10;

/**
 * Constants for chevron rendering
 */
const CHEVRON_SIZE_PX = 8;
const CHEVRON_LINE_WIDTH = 1.5;
const WING_LENGTH_RATIO = 0.7;
const BACK_OFFSET_RATIO = 0.3;
const TIP_OFFSET_RATIO = 0.4;
const PI_DIVISOR = 4;
const QUARTER_PI = Math.PI / PI_DIVISOR;

/**
 * ChevronRenderer handles rendering of direction arrows along paths
 */
export class ChevronRenderer extends BaseRenderer {
    constructor(coordinator: CoordinateTransformer) {
        super('chevron', LayerIdEnum.OVERLAYS, coordinator);
    }

    render(ctx: CanvasRenderingContext2D, state: RenderState): void {
        if (!state.pathsState || state.pathsState.paths.length === 0) {
            return;
        }

        this.drawPathChevrons(ctx, state);
    }

    /**
     * Draw chevron arrows along paths to show cut direction
     */
    private drawPathChevrons(
        ctx: CanvasRenderingContext2D,
        state: RenderState
    ): void {
        if (!state.pathsState || state.pathsState.paths.length === 0) return;

        state.pathsState.paths.forEach((path: Path) => {
            // Only draw chevrons for enabled paths with enabled operations
            if (!isPathEnabledForRendering(path, state)) {
                return;
            }

            let shapesToSample: Shape[] = [];

            // Use execution chain if available (contains shapes in correct execution order)
            if (path.cutChain && path.cutChain.shapes.length > 0) {
                shapesToSample = path.cutChain.shapes;
            } else {
                // Fallback to original shapes for backward compatibility
                // IMPORTANT: Don't manually apply cut direction here - it conflicts with stored chain direction
                if (
                    path.offset &&
                    path.offset.offsetShapes &&
                    path.offset.offsetShapes.length > 0
                ) {
                    shapesToSample = path.offset.offsetShapes;
                } else {
                    // Get the chain for this path and use original shapes
                    const chain = state.chains.find(
                        (c) => c.id === path.chainId
                    );
                    if (!chain || chain.shapes.length === 0) {
                        return;
                    }

                    shapesToSample = chain.shapes;
                }
            }

            // Use the new utility to sample at regular distance intervals
            const chevronSamples = samplePathAtDistanceIntervals(
                shapesToSample,
                CHEVRON_SPACING_UNITS
            );

            // Draw chevron arrows at the sampled locations
            const chevronSize =
                state.transform.coordinator.screenToWorldDistance(
                    CHEVRON_SIZE_PX
                ); // Size of chevrons in world units

            chevronSamples.forEach((sample) => {
                // Get the direction from the sampling function
                // Since cutChain shapes have been properly reversed (both order and geometry),
                // the direction vectors are already correct for the intended cut direction
                const dirX = sample.direction.x;
                const dirY = sample.direction.y;

                // Calculate perpendicular vector for chevron wings
                const perpX = -dirY;
                const perpY = dirX;

                this.drawChevronArrow(
                    ctx,
                    state,
                    sample.point,
                    dirX,
                    dirY,
                    perpX,
                    perpY,
                    chevronSize
                );
            });
        });
    }

    /**
     * Draw a single chevron arrow at the specified location
     */
    private drawChevronArrow(
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
        ctx.strokeStyle = 'rgb(0, 133, 84)'; // Green color to match path color
        ctx.lineWidth =
            state.transform.coordinator.screenToWorldDistance(
                CHEVRON_LINE_WIDTH
            );
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

    hitWorld(_point: Point2D, _state: RenderState): HitTestResult | null {
        // Chevrons are decorative and don't need hit testing
        return null;
    }
}
