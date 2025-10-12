/**
 * LeadRenderer - Renders lead-in and lead-out geometry
 *
 * Leads are lines or arcs that provide smooth entry and exit from cutting cuts.
 * This renderer handles:
 * - Lead-in lines (blue)
 * - Lead-out lines (red)
 * - Arc lead visualization
 * - Lead configuration display
 */

import { BaseRenderer } from './base';
import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import { LayerId } from '$lib/rendering/canvas/layers/types';
import type { Point2D } from '$lib/types';
import type { HitTestResult } from '$lib/rendering/canvas/utils/hit-test';
import {
    HitTestType,
    HitTestUtils,
} from '$lib/rendering/canvas/utils/hit-test';
import type { Cut } from '$lib/stores/cuts/interfaces';
import type { Operation } from '$lib/stores/operations/interfaces';
import { calculateLeads } from '$lib/algorithms/leads/lead-calculation';
import type { LeadConfig, LeadResult } from '$lib/algorithms/leads/interfaces';
import { LeadType } from '$lib/types/direction';
import { hasValidCachedLeads } from '$lib/utils/lead-persistence-utils';
import { findPartContainingChain } from '$lib/algorithms/part-detection/chain-part-interactions';
import {
    convertLeadGeometryToPoints,
    extractLeadNormalAndConnection,
} from '$lib/algorithms/leads/functions';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';

// Constants for lead rendering
const HIT_TEST_TOLERANCE = 5;
const NORMAL_INDICATOR_RADIUS = 3; // Radius of the circle at normal line start
const DEFAULT_NORMAL_LINE_LENGTH = 30; // Length in screen pixels
const LEAD_NORMAL_LINE_WIDTH = 1; // Width in screen pixels

export class LeadRenderer extends BaseRenderer {
    // Lead visualization settings
    private showLeadIn: boolean = true;
    private showLeadOut: boolean = true;
    private leadInColor: string = 'rgb(0, 83, 135)'; // RAL 5005 Signal Blue
    private leadOutColor: string = 'rgb(133, 18, 0)'; // Red
    private leadInOpacity: number = 1.0;
    private leadOutOpacity: number = 1.0;
    private leadLineWidth: number = 2;
    private normalLineColor: string = 'rgba(255, 165, 0, 0.6)'; // Light orange
    private normalLineLength: number = DEFAULT_NORMAL_LINE_LENGTH;

    constructor(coordinator: CoordinateTransformer) {
        super('lead-renderer', LayerId.LEADS, coordinator);
    }

    render(ctx: CanvasRenderingContext2D, state: RenderState): void {
        if (!state.cuts || state.cuts.length === 0) {
            return;
        }

        state.cuts.forEach((cut) => {
            // Skip disabled cuts or cuts with disabled operations
            const operation = state.operations.find(
                (op) => op.id === cut.operationId
            );
            if (!operation || !operation.enabled || !cut.enabled) return;

            // During simulation, optionally hide leads for non-current cuts
            if (
                state.stage === 'simulate' &&
                this.shouldHideLeadDuringSimulation(cut, state)
            ) {
                return;
            }

            // Draw lead paths if enabled
            if (state.visibility?.showLeadPaths) {
                this.drawCutLeads(ctx, state, cut, operation);
            }

            // Draw lead normals if enabled
            if (state.visibility?.showLeadNormals) {
                this.drawLeadNormals(ctx, state, cut, operation);
            }
        });
    }

    private drawCutLeads(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        cut: Cut,
        operation: Operation
    ): void {
        // Skip if both leads are disabled
        const leadInType = cut.leadInConfig?.type || LeadType.NONE;
        const leadOutType = cut.leadOutConfig?.type || LeadType.NONE;
        if (leadInType === LeadType.NONE && leadOutType === LeadType.NONE) {
            return;
        }

        // Calculate leads for this cut
        const leadResult = this.calculateCutLeads(cut, operation, state);
        if (!leadResult) return;

        // Draw lead-in
        if (this.showLeadIn && leadResult.leadIn) {
            const points = convertLeadGeometryToPoints(leadResult.leadIn);
            if (points.length > 1) {
                const leadId = `${cut.id}-leadIn`;
                const isSelected = state.selection?.selectedLeadId === leadId;
                const isHighlighted =
                    state.selection?.highlightedLeadId === leadId;
                const color =
                    isSelected || isHighlighted ? '#ff6600' : this.leadInColor;
                const opacity = this.getLeadOpacity(cut, 'leadIn', state);
                this.drawLeadGeometry(ctx, state, points, color, opacity);
            }
        }

        // Draw lead-out
        if (this.showLeadOut && leadResult.leadOut) {
            const points = convertLeadGeometryToPoints(leadResult.leadOut);
            if (points.length > 1) {
                const leadId = `${cut.id}-leadOut`;
                const isSelected = state.selection?.selectedLeadId === leadId;
                const isHighlighted =
                    state.selection?.highlightedLeadId === leadId;
                const color =
                    isSelected || isHighlighted ? '#ff6600' : this.leadOutColor;
                const opacity = this.getLeadOpacity(cut, 'leadOut', state);
                this.drawLeadGeometry(ctx, state, points, color, opacity);
            }
        }
    }

    private calculateCutLeads(
        cut: Cut,
        operation: Operation,
        state: RenderState
    ): LeadResult {
        try {
            // First check if we have valid cached lead geometry
            if (hasValidCachedLeads(cut)) {
                // For cached leads, we need to add normal and connection point if missing
                const leadIn = cut.leadIn ? { ...cut.leadIn } : undefined;
                const leadOut = cut.leadOut ? { ...cut.leadOut } : undefined;

                // Add normal and connection point to cached leads if missing
                if (leadIn && (!leadIn.normal || !leadIn.connectionPoint)) {
                    const extracted = extractLeadNormalAndConnection(
                        leadIn,
                        true
                    );
                    if (extracted) {
                        leadIn.normal = extracted.normal;
                        leadIn.connectionPoint = extracted.connectionPoint;
                    }
                }

                if (leadOut && (!leadOut.normal || !leadOut.connectionPoint)) {
                    const extracted = extractLeadNormalAndConnection(
                        leadOut,
                        false
                    );
                    if (extracted) {
                        leadOut.normal = extracted.normal;
                        leadOut.connectionPoint = extracted.connectionPoint;
                    }
                }

                return {
                    leadIn,
                    leadOut,
                    warnings: cut.leadValidation?.warnings || [],
                };
            }

            // Fall back to dynamic calculation if no valid cache
            // Get the chain for this cut - prefer cut chain if available
            let chain = cut.cutChain;

            // Fallback to original chain lookup for backward compatibility
            if (!chain) {
                chain = state.chains.find((c) => c.id === cut.chainId);
                if (!chain || chain.shapes.length === 0) {
                    return { warnings: [] };
                }

                // Apply cut direction ordering if using fallback chain
                if (cut.cutDirection === 'counterclockwise') {
                    chain = { ...chain, shapes: [...chain.shapes].reverse() };
                }
            }

            if (!chain || chain.shapes.length === 0) return { warnings: [] };

            // Get the part if the cut is part of a part
            let part = null;
            if (operation.targetType === 'parts') {
                part = findPartContainingChain(cut.chainId, state.parts);
            }

            // Get lead configurations with proper defaults
            const leadInConfig: LeadConfig = cut.leadInConfig || {
                type: LeadType.NONE,
                length: 0,
                flipSide: false,
                angle: undefined,
            };

            const leadOutConfig: LeadConfig = cut.leadOutConfig || {
                type: LeadType.NONE,
                length: 0,
                flipSide: false,
                angle: undefined,
            };

            // Calculate leads using correct signature
            const leadResult: LeadResult = calculateLeads(
                chain,
                leadInConfig,
                leadOutConfig,
                cut.cutDirection,
                part || undefined,
                cut.normal
            );

            return leadResult;
        } catch (error) {
            console.error('Error calculating leads for cut:', cut.id, error);
            return { warnings: [`Error calculating leads: ${error}`] };
        }
    }

    private drawLeadGeometry(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        points: Point2D[],
        color: string,
        opacity: number = 1.0
    ): void {
        if (points.length < 2) return;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = opacity;
        ctx.lineWidth = state.transform.coordinator.screenToWorldDistance(
            this.leadLineWidth
        );
        ctx.setLineDash([]);

        ctx.beginPath();
        const startPoint = points[0];
        ctx.moveTo(startPoint.x, startPoint.y);

        for (let i = 1; i < points.length; i++) {
            const point = points[i];
            ctx.lineTo(point.x, point.y);
        }

        ctx.stroke();
        ctx.restore();
    }

    private shouldHideLeadDuringSimulation(
        _cut: Cut,
        state: RenderState
    ): boolean {
        if (state.stage !== 'simulate') return false;

        // Option: Only hide leads for the currently executing cut
        // This would need access to current simulation cut from state
        // For now, return false to maintain existing behavior
        return false;
    }

    private getLeadOpacity(
        _cut: Cut,
        leadType: 'leadIn' | 'leadOut',
        state: RenderState
    ): number {
        if (state.stage !== 'simulate') {
            return leadType === 'leadIn'
                ? this.leadInOpacity
                : this.leadOutOpacity;
        }

        // During simulation, could reduce opacity of static leads
        const baseOpacity =
            leadType === 'leadIn' ? this.leadInOpacity : this.leadOutOpacity;

        // For now, keep leads at normal opacity during simulation
        // Could be enhanced with simulation state from render state
        return baseOpacity;
    }

    hitWorld(point: Point2D, state: RenderState): HitTestResult | null {
        if (!state.cuts || state.cuts.length === 0) {
            return null;
        }

        // Test for hits on lead geometry
        for (const cut of state.cuts) {
            const operation = state.operations.find(
                (op) => op.id === cut.operationId
            );
            if (!operation || !operation.enabled || !cut.enabled) continue;

            const leadResult = this.calculateCutLeads(cut, operation, state);
            if (!leadResult) continue;

            // Test lead-in
            if (leadResult.leadIn) {
                const points = convertLeadGeometryToPoints(leadResult.leadIn);
                if (this.isPointNearLeadGeometry(point, points, state)) {
                    return {
                        type: HitTestType.LEAD,
                        id: `${cut.id}-leadIn`,
                        distance: 0,
                        point: point,
                        metadata: {
                            cutId: cut.id,
                            leadType: 'leadIn',
                        },
                    };
                }
            }

            // Test lead-out
            if (leadResult.leadOut) {
                const points = convertLeadGeometryToPoints(leadResult.leadOut);
                if (this.isPointNearLeadGeometry(point, points, state)) {
                    return {
                        type: HitTestType.LEAD,
                        id: `${cut.id}-leadOut`,
                        distance: 0,
                        point: point,
                        metadata: {
                            cutId: cut.id,
                            leadType: 'leadOut',
                        },
                    };
                }
            }
        }

        return null;
    }

    private isPointNearLeadGeometry(
        point: Point2D,
        points: Point2D[],
        state: RenderState
    ): boolean {
        if (points.length < 2) return false;

        const tolerance =
            state.transform.coordinator.screenToWorldDistance(
                HIT_TEST_TOLERANCE
            );

        // Test against each line segment in the lead geometry
        for (let i = 0; i < points.length - 1; i++) {
            if (
                HitTestUtils.distanceToLineSegment(
                    point,
                    points[i],
                    points[i + 1]
                ) <= tolerance
            ) {
                return true;
            }
        }

        return false;
    }

    private drawLeadNormals(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        cut: Cut,
        operation: Operation
    ): void {
        const leadResult = this.calculateCutLeads(cut, operation, state);
        if (!leadResult) return;

        // Draw normal for lead-in (normal starts at connection point)
        if (
            leadResult.leadIn &&
            leadResult.leadIn.normal &&
            leadResult.leadIn.connectionPoint
        ) {
            this.drawNormalLine(
                ctx,
                state,
                leadResult.leadIn.connectionPoint,
                leadResult.leadIn.normal
            );
        }

        // Draw normal for lead-out (normal starts at connection point)
        if (
            leadResult.leadOut &&
            leadResult.leadOut.normal &&
            leadResult.leadOut.connectionPoint
        ) {
            this.drawNormalLine(
                ctx,
                state,
                leadResult.leadOut.connectionPoint,
                leadResult.leadOut.normal
            );
        }
    }

    private drawNormalLine(
        ctx: CanvasRenderingContext2D,
        state: RenderState,
        connectionPoint: Point2D,
        normalDirection: Point2D
    ): void {
        // normalDirection is already a unit vector from the lead calculation
        // Calculate normal line length in world coordinates
        const normalWorldLength =
            state.transform.coordinator.screenToWorldDistance(
                this.normalLineLength
            );

        // Calculate end point of normal line
        const endX = connectionPoint.x + normalDirection.x * normalWorldLength;
        const endY = connectionPoint.y + normalDirection.y * normalWorldLength;

        // Draw the normal line
        ctx.save();
        ctx.strokeStyle = this.normalLineColor;
        ctx.lineWidth = state.transform.coordinator.screenToWorldDistance(
            LEAD_NORMAL_LINE_WIDTH
        );
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(connectionPoint.x, connectionPoint.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Draw a small circle at the start point for clarity
        ctx.fillStyle = this.normalLineColor;
        const circleRadius = state.transform.coordinator.screenToWorldDistance(
            NORMAL_INDICATOR_RADIUS
        );
        ctx.beginPath();
        ctx.arc(
            connectionPoint.x,
            connectionPoint.y,
            circleRadius,
            0,
            2 * Math.PI
        );
        ctx.fill();

        ctx.restore();
    }

    /**
     * Set lead visualization mode for different stages
     */
    setVisualizationMode(mode: 'normal' | 'simulation' | 'hidden'): void {
        switch (mode) {
            case 'normal':
                this.showLeadIn = true;
                this.showLeadOut = true;
                this.leadInOpacity = 1.0;
                this.leadOutOpacity = 1.0;
                break;
            case 'simulation':
                this.showLeadIn = true;
                this.showLeadOut = true;
                this.leadInOpacity = 0.4;
                this.leadOutOpacity = 0.4;
                break;
            case 'hidden':
                this.showLeadIn = false;
                this.showLeadOut = false;
                break;
        }
    }

    /**
     * Configure lead colors
     */
    setLeadColors(leadInColor: string, leadOutColor: string): void {
        this.leadInColor = leadInColor;
        this.leadOutColor = leadOutColor;
    }

    /**
     * Configure lead line width
     */
    setLeadLineWidth(width: number): void {
        this.leadLineWidth = width;
    }
}
