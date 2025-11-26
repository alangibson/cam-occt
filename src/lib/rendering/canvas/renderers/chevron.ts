import { BaseRenderer } from './base';
import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import type { HitTestResult } from '$lib/rendering/canvas/utils/hit-test';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { CutData } from '$lib/cam/cut/interfaces';
import { LayerId as LayerIdEnum } from '$lib/rendering/canvas/layers/types';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
import { sampleShapes } from '$lib/cam/shape/functions';
import { isCutEnabledForRendering } from '$lib/rendering/canvas/utils/renderer-utils';
import { drawChevronArrow } from '$lib/rendering/canvas/utils/chevron-drawing';
import { Shape } from '$lib/cam/shape/classes';

/**
 * Physical spacing between cut direction chevrons in drawing units
 */
const CHEVRON_SPACING_UNITS: number = 10;

/**
 * Constants for chevron rendering
 */
const CHEVRON_SIZE_PX = 8;
const WING_LENGTH_RATIO = 0.7;
const BACK_OFFSET_RATIO = 0.3;
const TIP_OFFSET_RATIO = 0.4;
const QUADRANTS_IN_CIRCLE = 4;
const QUARTER_PI = Math.PI / QUADRANTS_IN_CIRCLE;

/**
 * ChevronRenderer handles rendering of direction arrows along cuts
 */
export class ChevronRenderer extends BaseRenderer {
    constructor(coordinator: CoordinateTransformer) {
        super('chevron', LayerIdEnum.OVERLAYS, coordinator);
    }

    render(ctx: CanvasRenderingContext2D, state: RenderState): void {
        // Only draw cut chevrons if showCutDirections is enabled
        if (
            state.visibility.showCutDirections &&
            state.cuts &&
            state.cuts.length > 0
        ) {
            this.drawCutChevrons(ctx, state);
        }

        // Draw chain chevrons if showChainDirections is enabled
        if (state.visibility.showChainDirections && state.chains.length > 0) {
            this.drawChainChevrons(ctx, state);
        }

        // Draw rapid chevrons if showRapidDirections is enabled
        if (state.visibility.showRapidDirections && state.rapids.length > 0) {
            this.drawRapidChevrons(ctx, state);
        }
    }

    /**
     * Draw chevron arrows along cuts to show cut direction
     */
    private drawCutChevrons(
        ctx: CanvasRenderingContext2D,
        state: RenderState
    ): void {
        if (!state.cuts || state.cuts.length === 0) return;

        state.cuts.forEach((cut: CutData) => {
            // Only draw chevrons for enabled cuts with enabled operations
            if (!isCutEnabledForRendering(cut, state)) {
                return;
            }

            let shapesToSample: Shape[] = [];

            // Use execution chain if available (contains shapes in correct execution order)
            if (cut.cutChain && cut.cutChain.shapes.length > 0) {
                shapesToSample = cut.cutChain.shapes.map((s) => new Shape(s));
            } else {
                // Fallback to original shapes for backward compatibility
                // IMPORTANT: Don't manually apply cut direction here - it conflicts with stored chain direction
                if (
                    cut.offset &&
                    cut.offset.offsetShapes &&
                    cut.offset.offsetShapes.length > 0
                ) {
                    shapesToSample = cut.offset.offsetShapes.map(
                        (s) => new Shape(s)
                    );
                } else {
                    // Get the chain for this cut and use original shapes
                    const chain = state.chains.find(
                        (c) => c.id === cut.chainId
                    );
                    if (!chain || chain.shapes.length === 0) {
                        return;
                    }

                    shapesToSample = chain.shapes;
                }
            }

            // Use the new utility to sample at regular distance intervals
            const chevronSamples = sampleShapes(
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

                drawChevronArrow(
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
     * Draw chevron arrows along chains to show chain direction
     */
    private drawChainChevrons(
        ctx: CanvasRenderingContext2D,
        state: RenderState
    ): void {
        state.chains.forEach((chain) => {
            if (chain.shapes.length === 0) return;

            // Use the new utility to sample at regular distance intervals
            const chevronSamples = sampleShapes(
                chain.shapes,
                CHEVRON_SPACING_UNITS
            );

            // Draw chevron arrows at the sampled locations
            const chevronSize =
                state.transform.coordinator.screenToWorldDistance(
                    CHEVRON_SIZE_PX
                );

            chevronSamples.forEach((sample) => {
                const dirX = sample.direction.x;
                const dirY = sample.direction.y;

                // Calculate perpendicular vector for chevron wings
                const perpX = -dirY;
                const perpY = dirX;

                drawChevronArrow(
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
     * Draw chevron arrows along rapids to show rapid direction
     */
    private drawRapidChevrons(
        ctx: CanvasRenderingContext2D,
        state: RenderState
    ): void {
        state.rapids.forEach((rapid) => {
            // Calculate direction vector from start to end
            const dx = rapid.end.x - rapid.start.x;
            const dy = rapid.end.y - rapid.start.y;
            const length = Math.sqrt(dx * dx + dy * dy);

            if (length === 0) return; // Skip zero-length rapids

            // Normalize direction vector
            const dirX = dx / length;
            const dirY = dy / length;

            // Calculate perpendicular vector for chevron wings
            const perpX = -dirY;
            const perpY = dirX;

            // Draw chevron at midpoint of the rapid
            const midpoint = {
                x: (rapid.start.x + rapid.end.x) / 2,
                y: (rapid.start.y + rapid.end.y) / 2,
            };

            const chevronSize =
                state.transform.coordinator.screenToWorldDistance(
                    CHEVRON_SIZE_PX
                );

            // Use blue color to match rapid line color
            ctx.save();
            ctx.strokeStyle = 'rgb(0, 83, 135)'; // RAL 5005 Signal Blue
            ctx.lineWidth =
                state.transform.coordinator.screenToWorldDistance(1);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Calculate chevron wing points (90 degree angle between wings)
            const wingLength = chevronSize * WING_LENGTH_RATIO;
            const backOffset = chevronSize * BACK_OFFSET_RATIO;
            const quarterPI = QUARTER_PI;

            // Wing points: 45 degrees on each side of the direction vector
            const wing1X =
                midpoint.x -
                backOffset * dirX +
                wingLength *
                    (dirX * Math.cos(quarterPI) + perpX * Math.sin(quarterPI));
            const wing1Y =
                midpoint.y -
                backOffset * dirY +
                wingLength *
                    (dirY * Math.cos(quarterPI) + perpY * Math.sin(quarterPI));

            const wing2X =
                midpoint.x -
                backOffset * dirX +
                wingLength *
                    (dirX * Math.cos(quarterPI) - perpX * Math.sin(quarterPI));
            const wing2Y =
                midpoint.y -
                backOffset * dirY +
                wingLength *
                    (dirY * Math.cos(quarterPI) - perpY * Math.sin(quarterPI));

            const tipX = midpoint.x + chevronSize * TIP_OFFSET_RATIO * dirX;
            const tipY = midpoint.y + chevronSize * TIP_OFFSET_RATIO * dirY;

            // Draw the chevron (two lines forming arrow shape)
            ctx.beginPath();
            ctx.moveTo(wing1X, wing1Y);
            ctx.lineTo(tipX, tipY);
            ctx.lineTo(wing2X, wing2Y);
            ctx.stroke();

            ctx.restore();
        });
    }

    hitWorld(_point: Point2D, _state: RenderState): HitTestResult | null {
        // Chevrons are decorative and don't need hit testing
        return null;
    }
}
