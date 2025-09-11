<script lang="ts">
    import type { Path } from '$lib/stores/paths';
    import type { Operation } from '$lib/stores/operations';
    import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
    import {
        calculateLeads,
        type LeadInConfig,
        type LeadOutConfig,
    } from '$lib/algorithms/lead-calculation';
    import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
    import type { Point2D } from '$lib/types';
    import { LeadType } from '$lib/types/direction';
    import {
        getCachedLeadGeometry,
        hasValidCachedLeads,
    } from '$lib/utils/lead-persistence-utils';
    import { findPartContainingChain } from '$lib/utils/chain-part-interactions';

    // Props
    export let ctx: CanvasRenderingContext2D;
    export let coordinator: CoordinateTransformer;
    export let paths: Path[];
    export let operations: Operation[];
    export let parts: DetectedPart[];
    export let chains: any[]; // Add chains prop
    export let currentStage: string = 'program';
    export let isSimulating: boolean = false;
    export let simulationProgress: number = 0;
    export let currentSimulationPath: Path | null = null;

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
        if (!paths || paths.length === 0) return;

        paths.forEach((path) => {
            // Skip disabled paths or paths with disabled operations
            const operation = operations.find(
                (op) => op.id === path.operationId
            );
            if (!operation || !operation.enabled || !path.enabled) return;

            // During simulation, optionally hide leads for non-current paths
            if (isSimulating && shouldHideLeadDuringSimulation(path)) return;

            drawPathLeads(path, operation);
        });
    }

    /**
     * Draw leads for a specific path
     */
    function drawPathLeads(path: Path, operation: Operation) {
        // Skip if both leads are disabled
        if (path.leadInType === 'none' && path.leadOutType === 'none') return;

        // Calculate leads for this path
        const leadResult = calculatePathLeads(path, operation);
        if (!leadResult) return;

        // Draw lead-in
        if (
            showLeadIn &&
            leadResult.leadIn &&
            leadResult.leadIn.points.length > 1
        ) {
            const opacity = getLeadOpacity(path, 'leadIn');
            drawLeadGeometry(leadResult.leadIn.points, leadInColor, opacity);
        }

        // Draw lead-out
        if (
            showLeadOut &&
            leadResult.leadOut &&
            leadResult.leadOut.points.length > 1
        ) {
            const opacity = getLeadOpacity(path, 'leadOut');
            drawLeadGeometry(leadResult.leadOut.points, leadOutColor, opacity);
        }
    }

    /**
     * Calculate lead geometry for a path (with caching)
     */
    function calculatePathLeads(path: Path, operation: Operation) {
        try {
            // First check if we have valid cached lead geometry
            if (hasValidCachedLeads(path)) {
                const cached = getCachedLeadGeometry(path);
                console.log(`Using cached lead geometry for path ${path.name}`);
                return {
                    leadIn: cached.leadIn,
                    leadOut: cached.leadOut,
                    warnings: cached.validation?.warnings || [],
                };
            }

            // Fall back to dynamic calculation if no valid cache
            console.log(
                `Calculating lead geometry dynamically for path ${path.name}`
            );

            // Get the chain for this path - prefer cut chain if available
            let chain = path.cutChain;

            // Fallback to original chain lookup for backward compatibility
            if (!chain) {
                chain = chains.find((c) => c.id === path.chainId);
                if (!chain || chain.shapes.length === 0) return null;

                // Apply cut direction ordering if using fallback chain
                if (path.cutDirection === 'counterclockwise') {
                    chain = { ...chain, shapes: [...chain.shapes].reverse() };
                }
            }

            if (!chain || chain.shapes.length === 0) return null;

            // Get the part if the path is part of a part
            let part = null;
            if (operation.targetType === 'parts') {
                part = findPartContainingChain(path.chainId, parts);
            }

            // Get lead configurations with proper defaults
            const leadInConfig: LeadInConfig = {
                type: path.leadInType || LeadType.NONE,
                length: path.leadInLength || 0,
                flipSide: path.leadInFlipSide || false,
                angle: path.leadInAngle,
            };

            const leadOutConfig: LeadOutConfig = {
                type: path.leadOutType || LeadType.NONE,
                length: path.leadOutLength || 0,
                flipSide: path.leadOutFlipSide || false,
                angle: path.leadOutAngle,
            };

            // Calculate leads using correct signature
            const leadResult = calculateLeads(
                chain,
                leadInConfig,
                leadOutConfig,
                path.cutDirection,
                part || undefined
            );

            return leadResult;
        } catch (error) {
            console.warn('Error calculating leads for path:', path.id, error);
            return null;
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
    function shouldHideLeadDuringSimulation(path: Path): boolean {
        if (!isSimulating || currentStage !== 'simulate') return false;

        // Option 1: Hide all static leads during simulation
        // return true;

        // Option 2: Only hide leads for the currently executing path
        return currentSimulationPath?.id === path.id;

        // Option 3: Don't hide any leads (current behavior)
        // return false;
    }

    /**
     * Get lead opacity based on simulation state
     */
    function getLeadOpacity(
        path: Path,
        leadType: 'leadIn' | 'leadOut'
    ): number {
        if (!isSimulating) {
            return leadType === 'leadIn' ? leadInOpacity : leadOutOpacity;
        }

        // During simulation, reduce opacity of static leads
        const baseOpacity =
            leadType === 'leadIn' ? leadInOpacity : leadOutOpacity;

        if (currentSimulationPath?.id === path.id) {
            // Make leads for current path more transparent
            return baseOpacity * 0.3;
        }

        // Keep other path leads at normal opacity
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
        currentPath: Path | null
    ) {
        isSimulating = playing;
        simulationProgress = progress;
        currentSimulationPath = currentPath;
    }
</script>

<!-- This component is logic-only, no template needed -->
