/**
 * KerfRenderer - Renders kerf visualization
 *
 * Kerfs represent the material removal zone of the cutting tool.
 * This renderer handles:
 * - Kerf path rendering (inner and outer offset chains)
 * - Dark yellow coloring for visibility
 */

import { BaseRenderer } from './base';
import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import { LayerId } from '$lib/rendering/canvas/layers/types';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
import type { Kerf } from '$lib/cam/kerf/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { Shape } from '$lib/cam/shape/classes';
import type { Line } from '$lib/geometry/line/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import { convertLeadGeometryToPoints } from '$lib/cam/lead/functions';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { CacheableLead } from '$lib/cam/lead/interfaces';
import type { HitTestResult } from '$lib/rendering/canvas/utils/hit-test';
import {
    HitTestType,
    HitTestUtils,
} from '$lib/rendering/canvas/utils/hit-test';
import { drawShape } from '$lib/rendering/canvas/shape-drawing';
import type { CutData } from '$lib/cam/cut/interfaces';
import { isCutEnabledForRendering } from '$lib/rendering/canvas/utils/renderer-utils';

/**
 * Constants for kerf rendering
 */
const KERF_LINE_WIDTH = 1;
const KERF_COLOR = '#B8860B'; // Dark yellow (dark goldenrod)
const KERF_FILL_COLOR = 'rgba(184, 134, 11, 0.3)'; // Semi-transparent dark goldenrod
const SELECTED_KERF_COLOR = '#ff6600'; // Orange for selected kerf
const SELECTED_KERF_FILL_COLOR = 'rgba(255, 102, 0, 0.3)'; // Semi-transparent orange
const HIGHLIGHTED_KERF_COLOR = '#ff9933'; // Light orange for highlighted
const HIGHLIGHTED_KERF_FILL_COLOR = 'rgba(255, 153, 51, 0.3)'; // Semi-transparent light orange
const LEAD_LINE_WIDTH = 2;
const LEAD_IN_COLOR = 'rgb(0, 83, 135)'; // RAL 5005 Signal Blue
const LEAD_OUT_COLOR = 'rgb(133, 18, 0)'; // Red
const HIT_TOLERANCE_PX = 5;

/**
 * KerfRenderer handles rendering of kerf zones including:
 * - Inner offset chain (inner boundary of material removal)
 * - Outer offset chain (outer boundary of material removal)
 */
export class KerfRenderer extends BaseRenderer {
    constructor(coordinator: CoordinateTransformer) {
        super('kerf', LayerId.OFFSETS, coordinator);
    }

    render(ctx: CanvasRenderingContext2D, state: RenderState): void {
        // Check if we should render anything at all
        if (
            !state.visibility.showKerfPaths &&
            !state.visibility.showLeadKerfs &&
            !state.visibility.showCutter
        ) {
            return;
        }

        // Render kerf paths if enabled
        if (state.visibility.showKerfPaths || state.visibility.showLeadKerfs) {
            // Get kerfs from state
            const kerfs = state.kerfs || [];

            // Render each enabled kerf
            for (const kerf of kerfs) {
                if (!kerf.enabled) {
                    continue;
                }

                this.renderKerf(ctx, kerf, state);
            }
        }

        // Render cutter path if enabled (independent of kerf path visibility)
        if (state.visibility.showCutter) {
            this.drawCutterPath(ctx, state);
        }
    }

    /**
     * Render a single kerf (both inner and outer chains, plus leads)
     * Uses evenodd fill rule to fill the area between inner and outer paths
     */
    private renderKerf(
        ctx: CanvasRenderingContext2D,
        kerf: Kerf,
        state: RenderState
    ): void {
        ctx.save();

        try {
            // Check if this kerf is selected or highlighted
            const isSelected = Boolean(
                state.selection.selectedKerfId &&
                    state.selection.selectedKerfId === kerf.id
            );
            const isHighlighted = Boolean(
                state.selection.highlightedKerfId &&
                    state.selection.highlightedKerfId === kerf.id
            );

            // Render main kerf paths if showKerfPaths is enabled
            if (state.visibility.showKerfPaths) {
                // Build complete paths for both chains
                ctx.beginPath();

                // Add outer chain to path
                if (kerf.outerChain && kerf.outerChain.shapes.length > 0) {
                    this.buildChainPath(ctx, kerf.outerChain.shapes);
                }

                // Add inner chain to path (in same winding direction)
                if (kerf.innerChain && kerf.innerChain.shapes.length > 0) {
                    this.buildChainPath(ctx, kerf.innerChain.shapes);
                }

                // Fill the area between the two paths using evenodd rule
                // Use different colors based on selection state
                if (isSelected) {
                    ctx.fillStyle = SELECTED_KERF_FILL_COLOR;
                } else if (isHighlighted) {
                    ctx.fillStyle = HIGHLIGHTED_KERF_FILL_COLOR;
                } else {
                    ctx.fillStyle = KERF_FILL_COLOR;
                }
                ctx.fill('evenodd');

                // Optionally stroke the boundaries for visibility
                this.applyKerfStyles(ctx, state, isSelected, isHighlighted);
                ctx.stroke();

                // Render lead-in geometry if present
                if (kerf.leadIn) {
                    this.renderLead(ctx, state, kerf.leadIn, LEAD_IN_COLOR);
                }

                // Render lead-out geometry if present
                if (kerf.leadOut) {
                    this.renderLead(ctx, state, kerf.leadOut, LEAD_OUT_COLOR);
                }
            }

            // Render lead kerfs if showLeadKerfs is enabled
            if (state.visibility.showLeadKerfs) {
                // Render lead-in kerf
                if (kerf.leadInInnerChain && kerf.leadInOuterChain) {
                    this.renderLeadKerf(
                        ctx,
                        state,
                        kerf.leadInInnerChain.shapes,
                        kerf.leadInOuterChain.shapes,
                        isSelected,
                        isHighlighted
                    );
                }

                // Render lead-out kerf
                if (kerf.leadOutInnerChain && kerf.leadOutOuterChain) {
                    this.renderLeadKerf(
                        ctx,
                        state,
                        kerf.leadOutInnerChain.shapes,
                        kerf.leadOutOuterChain.shapes,
                        isSelected,
                        isHighlighted
                    );
                }
            }
        } finally {
            ctx.restore();
        }
    }

    /**
     * Render a lead geometry (lead-in or lead-out)
     */
    private renderLead(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        lead: CacheableLead,
        color: string
    ): void {
        const points = convertLeadGeometryToPoints(lead);
        if (points.length < 2) return;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth =
            state.transform.coordinator.screenToWorldDistance(LEAD_LINE_WIDTH);
        ctx.setLineDash([]);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }

        ctx.stroke();
        ctx.restore();
    }

    /**
     * Render kerf around a lead (the area between inner and outer offset chains)
     */
    private renderLeadKerf(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        innerShapes: ShapeData[],
        outerShapes: ShapeData[],
        isSelected: boolean,
        isHighlighted: boolean
    ): void {
        if (innerShapes.length === 0 || outerShapes.length === 0) {
            return;
        }

        ctx.save();

        try {
            // Build complete paths for both chains
            ctx.beginPath();

            // Add outer chain to path
            this.buildChainPath(ctx, outerShapes);

            // Add inner chain to path (in same winding direction)
            this.buildChainPath(ctx, innerShapes);

            // Fill the area between the two paths using evenodd rule
            // Use different colors based on selection state
            if (isSelected) {
                ctx.fillStyle = SELECTED_KERF_FILL_COLOR;
            } else if (isHighlighted) {
                ctx.fillStyle = HIGHLIGHTED_KERF_FILL_COLOR;
            } else {
                ctx.fillStyle = KERF_FILL_COLOR;
            }
            ctx.fill('evenodd');

            // Stroke the boundaries for visibility
            this.applyKerfStyles(ctx, state, isSelected, isHighlighted);
            ctx.stroke();
        } finally {
            ctx.restore();
        }
    }

    /**
     * Apply kerf rendering styles based on selection state
     */
    private applyKerfStyles(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        isSelected: boolean,
        isHighlighted: boolean
    ): void {
        // Use different colors based on selection state
        if (isSelected) {
            ctx.strokeStyle = SELECTED_KERF_COLOR;
        } else if (isHighlighted) {
            ctx.strokeStyle = HIGHLIGHTED_KERF_COLOR;
        } else {
            ctx.strokeStyle = KERF_COLOR;
        }
        ctx.lineWidth =
            state.transform.coordinator.screenToWorldDistance(KERF_LINE_WIDTH);
        ctx.setLineDash([]); // Solid line
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }

    /**
     * Build a complete path from a chain's shapes
     * Adds all shapes to the current path without stroking/filling
     *
     * Handles both continuous chains and chains with multiple disconnected polygons
     * (e.g., shell + holes). Detects discontinuities and properly closes each polygon
     * subpath for evenodd fill rendering.
     */
    private buildChainPath(
        ctx: CanvasRenderingContext2D,
        shapes: ShapeData[]
    ): void {
        if (shapes.length === 0) return;

        const DISCONTINUITY_TOLERANCE = 0.001; // Gap threshold to detect new polygon
        let lastEndpoint: Point2D | null = null;

        for (let i = 0; i < shapes.length; i++) {
            const shape = shapes[i];
            if (shape.type !== GeometryType.LINE) {
                throw new Error(
                    `Kerf chains should only contain Lines, got ${shape.type}`
                );
            }

            const line = shape.geometry as Line;
            const isFirstShape = i === 0;
            const isLastShape = i === shapes.length - 1;

            // Check if this line is continuous with the previous one
            let isContinuous = false;
            if (!isFirstShape && lastEndpoint) {
                const dx = line.start.x - lastEndpoint.x;
                const dy = line.start.y - lastEndpoint.y;
                const gap = Math.sqrt(dx * dx + dy * dy);
                isContinuous = gap < DISCONTINUITY_TOLERANCE;
            }

            // Detect end of current polygon (start of new polygon or end of shapes)
            const isPolygonEnd = !isFirstShape && !isContinuous;

            // Close the previous polygon subpath before starting new one
            if (isPolygonEnd) {
                ctx.closePath();
                ctx.moveTo(line.start.x, line.start.y);
            } else if (isFirstShape) {
                ctx.moveTo(line.start.x, line.start.y);
            } else {
                // For continuous shapes, lineTo start point to handle tiny numerical gaps
                ctx.lineTo(line.start.x, line.start.y);
            }

            // Draw the line
            ctx.lineTo(line.end.x, line.end.y);
            lastEndpoint = line.end;

            // Close the final polygon subpath
            if (isLastShape) {
                ctx.closePath();
            }
        }
    }

    /**
     * Draw cutter path visualization (translucent yellow stroke matching kerf width)
     */
    private drawCutterPath(
        ctx: CanvasRenderingContext2D,
        state: RenderState
    ): void {
        if (!state.cuts || state.cuts.length === 0) return;

        state.cuts.forEach((cut: CutData) => {
            // Only draw cutter for enabled cuts with enabled operations
            if (!isCutEnabledForRendering(cut, state)) {
                return;
            }

            // Get kerf width from offset (if exists) or directly from cut
            const kerfWidth = cut.offset?.kerfWidth || cut.kerfWidth;
            if (!kerfWidth) {
                return;
            }

            // Determine which shapes to render cutter on
            // Priority: offset shapes > cutChain shapes > original chain shapes
            let shapesToDraw: ShapeData[] | null = null;

            if (
                cut.offset?.offsetShapes &&
                cut.offset.offsetShapes.length > 0
            ) {
                shapesToDraw = cut.offset.offsetShapes;
            } else if (cut.cutChain?.shapes && cut.cutChain.shapes.length > 0) {
                shapesToDraw = cut.cutChain.shapes;
            } else {
                const chain = state.chains.find((c) => c.id === cut.chainId);
                if (chain && chain.shapes.length > 0) {
                    shapesToDraw = chain.shapes;
                }
            }

            if (!shapesToDraw || shapesToDraw.length === 0) {
                return;
            }

            ctx.save();

            try {
                // Set translucent yellow stroke with kerf width
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.4)'; // Translucent yellow
                ctx.lineWidth = kerfWidth;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.setLineDash([]); // Solid line

                // Draw all shapes with cutter visualization
                shapesToDraw.forEach((shape) => {
                    try {
                        drawShape(ctx, shape);
                    } catch (error) {
                        console.warn(
                            `Error rendering cutter path shape for cut ${cut.id}:`,
                            error
                        );
                    }
                });

                // Draw cutter over lead-in if it exists
                if (cut.leadIn) {
                    try {
                        const leadInPoints = convertLeadGeometryToPoints(
                            cut.leadIn
                        );
                        if (leadInPoints.length >= 2) {
                            ctx.beginPath();
                            ctx.moveTo(leadInPoints[0].x, leadInPoints[0].y);
                            for (let i = 1; i < leadInPoints.length; i++) {
                                ctx.lineTo(
                                    leadInPoints[i].x,
                                    leadInPoints[i].y
                                );
                            }
                            ctx.stroke();
                        }
                    } catch (error) {
                        console.warn(
                            `Error rendering cutter path on lead-in for cut ${cut.id}:`,
                            error
                        );
                    }
                }

                // Draw cutter over lead-out if it exists
                if (cut.leadOut) {
                    try {
                        const leadOutPoints = convertLeadGeometryToPoints(
                            cut.leadOut
                        );
                        if (leadOutPoints.length >= 2) {
                            ctx.beginPath();
                            ctx.moveTo(leadOutPoints[0].x, leadOutPoints[0].y);
                            for (let i = 1; i < leadOutPoints.length; i++) {
                                ctx.lineTo(
                                    leadOutPoints[i].x,
                                    leadOutPoints[i].y
                                );
                            }
                            ctx.stroke();
                        }
                    } catch (error) {
                        console.warn(
                            `Error rendering cutter path on lead-out for cut ${cut.id}:`,
                            error
                        );
                    }
                }
            } catch (error) {
                console.error(
                    `Error rendering cutter path for cut ${cut.id}:`,
                    error
                );
            } finally {
                ctx.restore();
            }
        });
    }

    /**
     * Hit test to detect clicks on kerfs
     */
    hitWorld(point: Point2D, state: RenderState): HitTestResult | null {
        // Defensive check for point validity
        if (
            !point ||
            typeof point.x !== 'number' ||
            typeof point.y !== 'number'
        ) {
            console.error('KerfRenderer.hitWorld: invalid point', point);
            return null;
        }

        // Check if kerfs are visible
        if (!state.visibility.showKerfPaths) {
            return null;
        }

        // Get kerfs from state
        const kerfs = state.kerfs || [];
        if (kerfs.length === 0) {
            return null;
        }

        // Calculate hit tolerance in world units
        const hitTolerance =
            state.transform.coordinator.screenToWorldDistance(HIT_TOLERANCE_PX);

        // Test each enabled kerf
        for (const kerf of kerfs) {
            if (!kerf.enabled) {
                continue;
            }

            // Test shapes in inner chain
            if (kerf.innerChain && kerf.innerChain.shapes.length > 0) {
                for (const shape of kerf.innerChain.shapes) {
                    if (
                        HitTestUtils.isPointNearShape(
                            point,
                            new Shape(shape),
                            hitTolerance
                        )
                    ) {
                        return {
                            type: HitTestType.KERF,
                            id: kerf.id,
                            distance: hitTolerance,
                            point,
                            metadata: {},
                        };
                    }
                }
            }

            // Test shapes in outer chain
            if (kerf.outerChain && kerf.outerChain.shapes.length > 0) {
                for (const shape of kerf.outerChain.shapes) {
                    if (
                        HitTestUtils.isPointNearShape(
                            point,
                            new Shape(shape),
                            hitTolerance
                        )
                    ) {
                        return {
                            type: HitTestType.KERF,
                            id: kerf.id,
                            distance: hitTolerance,
                            point,
                            metadata: {},
                        };
                    }
                }
            }
        }

        return null;
    }
}
