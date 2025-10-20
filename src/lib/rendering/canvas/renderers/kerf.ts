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
import type { Shape } from '$lib/geometry/shape/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import { GeometryType } from '$lib/geometry/shape/enums';
import { convertLeadGeometryToPoints } from '$lib/cam/lead/functions';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { CacheableLead } from '$lib/cam/lead/interfaces';
import type { HitTestResult } from '$lib/rendering/canvas/utils/hit-test';
import {
    HitTestType,
    HitTestUtils,
} from '$lib/rendering/canvas/utils/hit-test';

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
        // Check if we should render kerfs
        if (!state.visibility.showKerfPaths) {
            return;
        }

        // Get kerfs from state
        const kerfs = state.kerfs || [];
        if (kerfs.length === 0) {
            return;
        }

        // Render each enabled kerf
        for (const kerf of kerfs) {
            if (!kerf.enabled) {
                continue;
            }

            this.renderKerf(ctx, kerf, state);
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
            const isSelected =
                state.selection.selectedKerfId &&
                state.selection.selectedKerfId === kerf.id;
            const isHighlighted =
                state.selection.highlightedKerfId &&
                state.selection.highlightedKerfId === kerf.id;

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
            // Use different colors based on selection state
            if (isSelected) {
                ctx.strokeStyle = SELECTED_KERF_COLOR;
            } else if (isHighlighted) {
                ctx.strokeStyle = HIGHLIGHTED_KERF_COLOR;
            } else {
                ctx.strokeStyle = KERF_COLOR;
            }
            ctx.lineWidth =
                state.transform.coordinator.screenToWorldDistance(
                    KERF_LINE_WIDTH
                );
            ctx.setLineDash([]); // Solid line
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();

            // Render lead-in geometry if present
            if (kerf.leadIn) {
                this.renderLead(ctx, state, kerf.leadIn, LEAD_IN_COLOR);
            }

            // Render lead-out geometry if present
            if (kerf.leadOut) {
                this.renderLead(ctx, state, kerf.leadOut, LEAD_OUT_COLOR);
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
     * Build a complete path from a chain's shapes
     * Adds all shapes to the current path without stroking/filling
     */
    private buildChainPath(
        ctx: CanvasRenderingContext2D,
        shapes: Shape[]
    ): void {
        if (shapes.length === 0) return;

        let isFirstShape = true;

        for (const shape of shapes) {
            this.addShapeToPath(ctx, shape, isFirstShape);
            isFirstShape = false;
        }
    }

    /**
     * Add a single shape to the current path
     *
     * NOTE: Kerf chains only contain Lines because they are generated from
     * tessellated Cut chains. The cutToKerf() function tessellates all geometry
     * types (arcs, circles, splines, etc.) into polylines before offset calculation.
     */
    private addShapeToPath(
        ctx: CanvasRenderingContext2D,
        shape: Shape,
        isFirstShape: boolean
    ): void {
        if (shape.type !== GeometryType.LINE) {
            throw new Error(
                `Kerf chains should only contain Lines, got ${shape.type}`
            );
        }
        this.addLineToPath(ctx, shape.geometry as Line, isFirstShape);
    }

    private addLineToPath(
        ctx: CanvasRenderingContext2D,
        line: Line,
        isFirstShape: boolean
    ): void {
        if (isFirstShape) {
            ctx.moveTo(line.start.x, line.start.y);
        } else {
            // For continuity, explicitly move to the start of this line
            // This handles any tiny numerical gaps between segments
            ctx.lineTo(line.start.x, line.start.y);
        }
        ctx.lineTo(line.end.x, line.end.y);
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
                            shape,
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
                            shape,
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
