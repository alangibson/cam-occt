import { BaseRenderer } from './base';
import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import { screenToWorldDistance } from '$lib/rendering/canvas/state/render-state';
import type { HitTestResult } from '$lib/rendering/canvas/utils/hit-test';
import {
    HitTestType,
    HitTestUtils,
} from '$lib/rendering/canvas/utils/hit-test';
import type { Point2D } from '$lib/types';
import { drawShape } from '$lib/rendering/canvas/shape-drawing';
import type { Cut } from '$lib/stores/cuts/interfaces';
import { LayerId as LayerIdEnum } from '$lib/rendering/canvas/layers/types';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
import {
    getShapeStartPoint,
    getShapeEndPoint,
} from '$lib/geometry/shape/functions';
import {
    isCutEnabledForRendering,
    applyCutStyling,
    setupHitTest,
} from '$lib/rendering/canvas/utils/renderer-utils';

/**
 * Constants for cut rendering
 */
const OFFSET_LINE_WIDTH = 2;
const SELECTED_OFFSET_LINE_WIDTH = 2;
const SELECTED_CUT_LINE_WIDTH = 3;
const HIGHLIGHTED_CUT_LINE_WIDTH = 2.5;
const GAP_FILL_LINE_WIDTH = 2;
const ENDPOINT_RADIUS_PX = 3;
const HIT_TOLERANCE_PX = 5;

/**
 * CutRenderer handles rendering of cuts including:
 * - Offset cut geometry (green lines)
 * - Gap fills
 * - Cut start/end point markers
 */
export class CutRenderer extends BaseRenderer {
    constructor(coordinator: CoordinateTransformer) {
        super('cut', LayerIdEnum.OFFSETS, coordinator);
    }

    render(ctx: CanvasRenderingContext2D, state: RenderState): void {
        if (!state.cutsState || state.cutsState.cuts.length === 0) return;

        // First render cut geometry (offset shapes)
        this.drawOffsetCuts(ctx, state);

        // Then render endpoints on top
        this.drawCutEndpoints(ctx, state);
    }

    /**
     * Draw offset cuts with offset shapes as solid green lines
     */
    private drawOffsetCuts(
        ctx: CanvasRenderingContext2D,
        state: RenderState
    ): void {
        if (!state.cutsState || state.cutsState.cuts.length === 0) return;

        state.cutsState.cuts.forEach((cut: Cut) => {
            // Only draw offset cuts for enabled cuts with enabled operations
            if (!isCutEnabledForRendering(cut, state)) {
                return;
            }

            // Only draw if cut has calculated offset
            if (!cut.offset) {
                return;
            }

            // Validate offset geometry before rendering
            if (!cut.offset.offsetShapes) {
                console.warn(
                    `Invalid offset geometry for cut ${cut.id}: missing offsetShapes`
                );
                return;
            }

            if (!Array.isArray(cut.offset.offsetShapes)) {
                console.warn(
                    `Invalid offset geometry for cut ${cut.id}: offsetShapes is not an array`
                );
                return;
            }

            if (cut.offset.offsetShapes.length === 0) {
                console.warn(
                    `Invalid offset geometry for cut ${cut.id}: empty offsetShapes array`
                );
                return;
            }

            const isCutSelected =
                state.selection.selectedCutId &&
                state.selection.selectedCutId === cut.id;
            const isCutHighlighted =
                state.selection.highlightedCutId &&
                state.selection.highlightedCutId === cut.id;

            ctx.save();

            try {
                // Define color constants for visual consistency
                const cutColors = {
                    offsetGreen: 'rgb(0, 133, 84)', // Green for offset cuts
                    selectedDark: '#ff9933', // Light orange for selected
                    highlighted: '#ff9933', // Light orange for highlighted
                };

                // Draw offset shapes as solid green lines
                ctx.setLineDash([]); // Solid line pattern
                ctx.shadowColor = 'transparent'; // Reset shadow
                ctx.shadowBlur = 0;

                // Maintain professional line appearance
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                cut.offset.offsetShapes.forEach((shape, index) => {
                    try {
                        // Check if this specific offset shape is selected
                        const isOffsetShapeSelected =
                            state.selection.selectedOffsetShape &&
                            state.selection.selectedOffsetShape.id === shape.id;

                        // Set styling based on selection state with proper hierarchy
                        if (isOffsetShapeSelected) {
                            ctx.strokeStyle = '#ff6600'; // Orange for selected offset shape
                            ctx.lineWidth =
                                state.transform.coordinator.screenToWorldDistance(
                                    SELECTED_OFFSET_LINE_WIDTH
                                ); // 2px selected offset shape
                        } else {
                            applyCutStyling(
                                ctx,
                                state,
                                !!isCutSelected,
                                !!isCutHighlighted,
                                {
                                    selectedDark: cutColors.selectedDark,
                                    highlighted: cutColors.highlighted,
                                    normal: cutColors.offsetGreen,
                                },
                                {
                                    selected: SELECTED_CUT_LINE_WIDTH,
                                    highlighted: HIGHLIGHTED_CUT_LINE_WIDTH,
                                    normal: OFFSET_LINE_WIDTH,
                                }
                            );
                        }

                        drawShape(ctx, shape);

                        // Reset shadow after each shape if it was applied
                        if (isCutHighlighted && !isOffsetShapeSelected) {
                            ctx.shadowColor = 'transparent';
                            ctx.shadowBlur = 0;
                        }
                    } catch (error) {
                        console.warn(
                            `Error rendering offset shape ${index} for cut ${cut.id}:`,
                            error
                        );
                    }
                });

                // Render gap fills if they exist (filler shapes and modified shapes)
                if (cut.offset.gapFills && cut.offset.gapFills.length > 0) {
                    ctx.save();

                    // Use same color logic as offset shapes for consistency
                    applyCutStyling(
                        ctx,
                        state,
                        !!isCutSelected,
                        !!isCutHighlighted,
                        {
                            selectedDark: cutColors.selectedDark,
                            highlighted: cutColors.highlighted,
                            normal: cutColors.offsetGreen,
                        },
                        {
                            selected: SELECTED_CUT_LINE_WIDTH,
                            highlighted: HIGHLIGHTED_CUT_LINE_WIDTH,
                            normal: GAP_FILL_LINE_WIDTH,
                        }
                    );
                    ctx.setLineDash([]); // Solid line

                    for (const gapFill of cut.offset.gapFills) {
                        // Render filler shape if it exists
                        if (gapFill.fillerShape) {
                            try {
                                drawShape(ctx, gapFill.fillerShape);
                            } catch (error) {
                                console.warn(
                                    `Error rendering gap filler shape for cut ${cut.id}:`,
                                    error
                                );
                            }
                        }

                        // Render modified shapes (these replace the original offset shapes in gap areas)
                        for (const modifiedShapeEntry of gapFill.modifiedShapes) {
                            drawShape(ctx, modifiedShapeEntry.modified);
                        }
                    }

                    // Reset shadow after gap fills if it was applied
                    if (isCutHighlighted) {
                        ctx.shadowColor = 'transparent';
                        ctx.shadowBlur = 0;
                    }

                    ctx.restore();
                }
            } catch (error) {
                console.error(`Error rendering offset cut ${cut.id}:`, error);
            } finally {
                ctx.restore();
            }
        });
    }

    /**
     * Draw cut start/end points as colored circles
     */
    private drawCutEndpoints(
        ctx: CanvasRenderingContext2D,
        state: RenderState
    ): void {
        if (!state.cutsState || state.cutsState.cuts.length === 0) return;

        const pointRadius = screenToWorldDistance(state, ENDPOINT_RADIUS_PX); // Fixed size regardless of zoom

        state.cutsState.cuts.forEach((cut: Cut) => {
            // Only draw endpoints for enabled cuts with enabled operations
            if (!isCutEnabledForRendering(cut, state)) return;

            // Get the chain for this cut to find start/end points
            const chain = state.chains.find((c) => c.id === cut.chainId);
            if (!chain || chain.shapes.length === 0) return;

            // Use offset shapes if they exist, otherwise use original chain shapes
            const shapesToUse =
                cut.offset && cut.offset.offsetShapes.length > 0
                    ? cut.offset.offsetShapes
                    : chain.shapes;

            // Get first and last shape
            const firstShape = shapesToUse[0];
            const lastShape = shapesToUse[shapesToUse.length - 1];

            if (!firstShape || !lastShape) return;

            // Get start point of first shape
            const startPoint = getShapeStartPoint(firstShape);
            if (startPoint) {
                ctx.save();
                ctx.fillStyle = 'rgb(0, 133, 84)'; // Green for start
                ctx.beginPath();
                ctx.arc(
                    startPoint.x,
                    startPoint.y,
                    pointRadius,
                    0,
                    2 * Math.PI
                );
                ctx.fill();
                ctx.restore();
            }

            // Get end point of last shape
            const endPoint = getShapeEndPoint(lastShape);
            if (endPoint) {
                ctx.save();
                ctx.fillStyle = 'rgb(133, 18, 0)'; // Red for end
                ctx.beginPath();
                ctx.arc(endPoint.x, endPoint.y, pointRadius, 0, 2 * Math.PI);
                ctx.fill();
                ctx.restore();
            }
        });
    }

    hitWorld(point: Point2D, state: RenderState): HitTestResult | null {
        // Defensive check for point validity
        if (
            !point ||
            typeof point.x !== 'number' ||
            typeof point.y !== 'number'
        ) {
            console.error('CutRenderer.hitWorld: invalid point', point);
            return null;
        }

        const hitSetup = setupHitTest(state, HIT_TOLERANCE_PX);
        if (!hitSetup) return null;

        const { hitTolerance, enabledCuts } = hitSetup;

        // First test for cut geometry hits (offset shapes)
        for (const cut of enabledCuts) {
            // Only test if cut has offset geometry
            if (!cut.offset || !cut.offset.offsetShapes) continue;

            // Test offset shapes for cut hit
            for (const shape of cut.offset.offsetShapes) {
                if (HitTestUtils.isPointNearShape(point, shape, hitTolerance)) {
                    return {
                        type: HitTestType.CUT,
                        id: cut.id,
                        distance: hitTolerance,
                        point,
                        metadata: { cutId: cut.id },
                    };
                }
            }
        }

        // Then test for endpoint hits
        for (const cut of enabledCuts) {
            // Get the chain for this cut
            const chain = state.chains.find((c) => c.id === cut.chainId);
            if (!chain || chain.shapes.length === 0) continue;

            // Use offset shapes if they exist, otherwise use original chain shapes
            const shapesToUse =
                cut.offset && cut.offset.offsetShapes.length > 0
                    ? cut.offset.offsetShapes
                    : chain.shapes;

            // Check if point is near cut endpoint
            const firstShape = shapesToUse[0];
            const lastShape = shapesToUse[shapesToUse.length - 1];

            if (firstShape) {
                const startPoint = getShapeStartPoint(firstShape);
                if (startPoint) {
                    const dx = point.x - startPoint.x;
                    const dy = point.y - startPoint.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance <= hitTolerance) {
                        return {
                            type: HitTestType.CUT,
                            id: cut.id,
                            distance,
                            point: startPoint,
                            metadata: { endpoint: 'start' },
                        };
                    }
                }
            }

            if (lastShape) {
                const endPoint = getShapeEndPoint(lastShape);
                if (endPoint) {
                    const dx = point.x - endPoint.x;
                    const dy = point.y - endPoint.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance <= hitTolerance) {
                        return {
                            type: HitTestType.CUT,
                            id: cut.id,
                            distance,
                            point: endPoint,
                            metadata: { endpoint: 'end' },
                        };
                    }
                }
            }
        }

        return null;
    }
}
