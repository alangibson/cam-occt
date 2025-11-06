/**
 * Common utility functions for renderers
 */

import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import type { Cut } from '$lib/cam/cut/interfaces';

/**
 * Constants for renderer utilities
 */
const SHADOW_BLUR_PX = 4;
const DEFAULT_HIT_TOLERANCE_PX = 5;

/**
 * Check if a cut is enabled and should be rendered
 */
export function isCutEnabledForRendering(
    cut: Cut,
    state: RenderState
): boolean {
    const operation = state.operations.find((op) => op.id === cut.operationId);
    return !!(operation && operation.enabled && cut.enabled);
}

/**
 * Apply common cut styling based on selection and hover state
 */
export function applyCutStyling(
    ctx: CanvasRenderingContext2D,
    state: RenderState,
    isSelected: boolean,
    isHighlighted: boolean,
    cutColors: {
        selectedDark: string;
        highlighted: string;
        normal: string;
    },
    lineWidths: {
        selected: number;
        highlighted: number;
        normal: number;
    },
    enableShadow: boolean = true
): void {
    if (isSelected) {
        ctx.strokeStyle = cutColors.selectedDark;
        ctx.lineWidth = state.transform.coordinator.screenToWorldDistance(
            lineWidths.selected
        );
    } else if (isHighlighted) {
        ctx.strokeStyle = cutColors.highlighted;
        ctx.lineWidth = state.transform.coordinator.screenToWorldDistance(
            lineWidths.highlighted
        );
        if (enableShadow) {
            ctx.shadowColor = cutColors.highlighted;
            ctx.shadowBlur =
                state.transform.coordinator.screenToWorldDistance(
                    SHADOW_BLUR_PX
                );
        }
    } else {
        ctx.strokeStyle = cutColors.normal;
        ctx.lineWidth = state.transform.coordinator.screenToWorldDistance(
            lineWidths.normal
        );
    }
}

/**
 * Common hitTest setup and validation
 * Returns null if no cuts to test, otherwise returns the hit tolerance and enabled cuts
 */
export function setupHitTest(
    state: RenderState,
    hitTolerancePx: number = DEFAULT_HIT_TOLERANCE_PX
): { hitTolerance: number; enabledCuts: Cut[] } | null {
    if (!state.cutsState || state.cutsState.cuts.length === 0) return null;

    const hitTolerance =
        state.transform.coordinator.screenToWorldDistance(hitTolerancePx);
    const enabledCuts = state.cutsState.cuts.filter((cut) =>
        isCutEnabledForRendering(cut, state)
    );

    return { hitTolerance, enabledCuts };
}
