<script lang="ts">
    import type { Cut } from '$lib/cam/cut/interfaces';
    import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
    import { calculateLeads } from '$lib/cam/lead/lead-calculation';
    import { type LeadConfig, type LeadResult } from '$lib/cam/lead/interfaces';
    import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
    import type { Point2D } from '$lib/types';
    import { LeadType } from '$lib/types/direction';
    import { hasValidCachedLeads } from '$lib/cam/cut/lead-persistence';
    import { findPartContainingChain } from '$lib/algorithms/part-detection/chain-part-interactions';
    import type { Operation } from '$lib/stores/operations/interfaces';
    import type { Chain } from '$lib/geometry/chain/interfaces';
    import { convertLeadGeometryToPoints } from '$lib/cam/lead/functions';

    // Props
    export let ctx: CanvasRenderingContext2D;
    export let coordinator: CoordinateTransformer;
    export let cuts: Cut[];
    export let operations: Operation[];
    export let parts: DetectedPart[];
    export let chains: Chain[];
    export let currentStage: string = 'program';
    export let isSimulating: boolean = false;
    export let simulationProgress: number = 0;
    export let currentSimulationCut: Cut | null = null;

    // Lead visualization settings
    export let showLeadIn: boolean = true;
    export let showLeadOut: boolean = true;
    export let leadInColor: string = 'rgb(0, 83, 135)'; // RAL 5005 Signal Blue
    export let leadOutColor: string = 'rgb(133, 18, 0)'; // Red
    export let leadInOpacity: number = 1.0;
    export let leadOutOpacity: number = 1.0;
    export let leadLineWidth: number = 1;

    /**
     * Main function to draw all lead lines
     */
    export function drawLeads() {
        if (!cuts || cuts.length === 0) return;

        cuts.forEach((cut) => {
            // Skip disabled cuts or cuts with disabled operations
            const operation = operations.find(
                (op) => op.id === cut.operationId
            );
            if (!operation || !operation.enabled || !cut.enabled) return;

            // During simulation, optionally hide leads for non-current cuts
            if (isSimulating && shouldHideLeadDuringSimulation(cut)) return;

            drawCutLeads(cut, operation);
        });
    }

    /**
     * Draw leads for a specific cut
     */
    function drawCutLeads(cut: Cut, operation: Operation) {
        // Skip if both leads are disabled
        const leadInType = cut.leadInConfig?.type || LeadType.NONE;
        const leadOutType = cut.leadOutConfig?.type || LeadType.NONE;
        if (leadInType === LeadType.NONE && leadOutType === LeadType.NONE)
            return;

        // Calculate leads for this cut
        const leadResult = calculateCutLeads(cut, operation);
        if (!leadResult) return;

        // Draw lead-in
        if (showLeadIn && leadResult.leadIn) {
            const points = convertLeadGeometryToPoints(leadResult.leadIn);
            if (points.length > 1) {
                const opacity = getLeadOpacity(cut, 'leadIn');
                drawLeadGeometry(points, leadInColor, opacity);
            }
        }

        // Draw lead-out
        if (showLeadOut && leadResult.leadOut) {
            const points = convertLeadGeometryToPoints(leadResult.leadOut);
            if (points.length > 1) {
                const opacity = getLeadOpacity(cut, 'leadOut');
                drawLeadGeometry(points, leadOutColor, opacity);
            }
        }
    }

    /**
     * Calculate lead geometry for a cut (with caching)
     */
    function calculateCutLeads(cut: Cut, operation: Operation): LeadResult {
        try {
            // First check if we have valid cached lead geometry
            if (hasValidCachedLeads(cut)) {
                console.log(`Using cached lead geometry for cut ${cut.name}`);
                return {
                    leadIn: cut.leadIn || undefined,
                    leadOut: cut.leadOut || undefined,
                    warnings: cut.leadValidation?.warnings || [],
                };
            }

            // Fall back to dynamic calculation if no valid cache
            console.log(
                `Calculating lead geometry dynamically for cut ${cut.name}`
            );

            // Get the chain for this cut - prefer cut chain if available
            let chain = cut.cutChain;

            // Fallback to original chain lookup for backward compatibility
            if (!chain) {
                chain = chains.find((c) => c.id === cut.chainId);
                if (!chain || chain.shapes.length === 0)
                    return { warnings: [] };

                // Apply cut direction ordering if using fallback chain
                if (cut.cutDirection === 'counterclockwise') {
                    chain = { ...chain, shapes: [...chain.shapes].reverse() };
                }
            }

            if (!chain || chain.shapes.length === 0) return { warnings: [] };

            // Get the part if the cut is part of a part
            let part = null;
            if (operation.targetType === 'parts') {
                part = findPartContainingChain(cut.chainId, parts);
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
            console.warn('Error calculating leads for cut:', cut.id, error);
            return { warnings: [`Error calculating leads: ${error}`] };
        }
    }

    /**
     * Draw lead geometry (lines/arcs) on canvas
     */
    function drawLeadGeometry(
        points: Point2D[],
        color: string,
        opacity: number = 1.0
    ) {
        if (points.length < 2) return;

        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = opacity;
        ctx.lineWidth = coordinator.screenToWorldDistance(leadLineWidth);
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

    /**
     * Determine if leads should be hidden during simulation
     */
    function shouldHideLeadDuringSimulation(cut: Cut): boolean {
        if (!isSimulating || currentStage !== 'simulate') return false;

        // Option 1: Hide all static leads during simulation
        // return true;

        // Option 2: Only hide leads for the currently executing cut
        return currentSimulationCut?.id === cut.id;

        // Option 3: Don't hide any leads (current behavior)
        // return false;
    }

    /**
     * Get lead opacity based on simulation state
     */
    function getLeadOpacity(cut: Cut, leadType: 'leadIn' | 'leadOut'): number {
        if (!isSimulating) {
            return leadType === 'leadIn' ? leadInOpacity : leadOutOpacity;
        }

        // During simulation, reduce opacity of static leads
        const baseOpacity =
            leadType === 'leadIn' ? leadInOpacity : leadOutOpacity;

        if (currentSimulationCut?.id === cut.id) {
            // Make leads for current cut more transparent
            return baseOpacity * 0.3;
        }

        // Keep other cut leads at normal opacity
        return baseOpacity;
    }

    /**
     * Set lead visualization mode for different stages
     */
    export function setVisualizationMode(
        mode: 'normal' | 'simulation' | 'hidden'
    ) {
        switch (mode) {
            case 'normal':
                showLeadIn = true;
                showLeadOut = true;
                leadInOpacity = 1.0;
                leadOutOpacity = 1.0;
                break;
            case 'simulation':
                showLeadIn = true;
                showLeadOut = true;
                leadInOpacity = 0.4;
                leadOutOpacity = 0.4;
                break;
            case 'hidden':
                showLeadIn = false;
                showLeadOut = false;
                break;
        }
    }

    /**
     * Update simulation state
     */
    export function updateSimulationState(
        playing: boolean,
        progress: number,
        currentCut: Cut | null
    ) {
        isSimulating = playing;
        simulationProgress = progress;
        currentSimulationCut = currentCut;
    }
</script>

<!-- This component is logic-only, no template needed -->
