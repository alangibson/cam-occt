import { BaseRenderer } from './base';
import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import type { HitTestResult } from '$lib/rendering/canvas/utils/hit-test';
import type { Point2D, Shape } from '$lib/types';
import type { Cut } from '$lib/stores/cuts/interfaces';
import { LayerId as LayerIdEnum } from '$lib/rendering/canvas/layers/types';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
import { sampleShapesAtDistanceIntervals } from '$lib/geometry/shape/functions';
import { isCutEnabledForRendering } from '$lib/rendering/canvas/utils/renderer-utils';
import { drawChevronArrow } from '$lib/rendering/canvas/utils/chevron-drawing';

/**
 * Physical spacing between cut direction chevrons in drawing units
 */
const CHEVRON_SPACING_UNITS: number = 10;

/**
 * Constants for chevron rendering
 */
const CHEVRON_SIZE_PX = 8;

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
            state.cutsState &&
            state.cutsState.cuts.length > 0
        ) {
            this.drawCutChevrons(ctx, state);
        }

        // Draw chain chevrons if showChainDirections is enabled
        if (state.visibility.showChainDirections && state.chains.length > 0) {
            this.drawChainChevrons(ctx, state);
        }
    }

    /**
     * Draw chevron arrows along cuts to show cut direction
     */
    private drawCutChevrons(
        ctx: CanvasRenderingContext2D,
        state: RenderState
    ): void {
        if (!state.cutsState || state.cutsState.cuts.length === 0) return;

        state.cutsState.cuts.forEach((cut: Cut) => {
            // Only draw chevrons for enabled cuts with enabled operations
            if (!isCutEnabledForRendering(cut, state)) {
                return;
            }

            let shapesToSample: Shape[] = [];

            // Use execution chain if available (contains shapes in correct execution order)
            if (cut.cutChain && cut.cutChain.shapes.length > 0) {
                shapesToSample = cut.cutChain.shapes;
            } else {
                // Fallback to original shapes for backward compatibility
                // IMPORTANT: Don't manually apply cut direction here - it conflicts with stored chain direction
                if (
                    cut.offset &&
                    cut.offset.offsetShapes &&
                    cut.offset.offsetShapes.length > 0
                ) {
                    shapesToSample = cut.offset.offsetShapes;
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
            const chevronSamples = sampleShapesAtDistanceIntervals(
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
            const chevronSamples = sampleShapesAtDistanceIntervals(
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

    hitWorld(_point: Point2D, _state: RenderState): HitTestResult | null {
        // Chevrons are decorative and don't need hit testing
        return null;
    }
}
