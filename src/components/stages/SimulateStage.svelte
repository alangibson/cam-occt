<script lang="ts">
    /**
     * SimulateStage Component
     *
     * This component provides 3D cutting simulation with support for offset paths.
     * When paths have calculated offsets (from kerf compensation), the simulation
     * automatically uses the offset geometry for:
     * - Tool head movement and animation
     * - Distance and timing calculations
     * - Lead-in/out calculations
     *
     * The visual rendering shows:
     * - Offset paths as solid green lines (when present)
     * - Original paths as dashed green reference lines
     * - Automatic fallback to original paths when no offset exists
     */
    import AccordionPanel from '../AccordionPanel.svelte';
    import ThreeColumnLayout from '../ThreeColumnLayout.svelte';
    import { workflowStore } from '$lib/stores/workflow/store';
    import { WorkflowStage } from '$lib/stores/workflow/enums';
    import { pathStore } from '$lib/stores/paths/store';
    import { rapidStore } from '$lib/stores/rapids/store';
    import { chainStore } from '$lib/stores/chains/store';
    import { drawingStore } from '$lib/stores/drawing/store';
    import { toolStore } from '$lib/stores/tools/store';
    import { overlayStore } from '$lib/stores/overlay/store';
    import { partStore } from '$lib/stores/parts/store';
    import {
        hasValidCachedLeads,
        getCachedLeadGeometry,
    } from '$lib/utils/lead-persistence-utils';
    import { onMount, onDestroy } from 'svelte';
    import {
        type Shape,
        type Point2D,
        type Line,
        type Arc,
        type Circle,
        type Polyline,
        type Ellipse,
        GeometryType,
    } from '$lib/types';
    import type { Spline } from '$lib/geometry/spline';
    import type { Chain } from '$lib/geometry/chain/interfaces';
    import type { Path } from '$lib/stores/paths/interfaces';
    import type { Rapid } from '$lib/algorithms/optimize-cut-order/optimize-cut-order';
    import type { Tool } from '$lib/stores/tools/interfaces';
    import type { ChainStore } from '$lib/stores/chains/interfaces';
    import type { DrawingState } from '$lib/stores/drawing/interfaces';
    import type { PartStore } from '$lib/stores/parts/interfaces';
    import { getSplinePointAt, tessellateSpline } from '$lib/geometry/spline';
    import { polylineToPoints } from '$lib/geometry/polyline';
    import { getShapePointAt } from '$lib/geometry/shape/functions';
    import { calculateLeads } from '$lib/algorithms/leads/lead-calculation';
    import { getDefaults } from '$lib/config';
    import { type LeadConfig } from '$lib/algorithms/leads/interfaces';
    import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
    import { LeadType } from '$lib/types/direction';
    import { findPartContainingChain } from '$lib/algorithms/part-detection/chain-part-interactions';
    import { convertLeadGeometryToPoints } from '$lib/algorithms/leads/functions';
    import DrawingCanvasContainer from '../DrawingCanvasContainer.svelte';

    // Props from WorkflowContainer for shared canvas
    export let sharedCanvas: typeof DrawingCanvasContainer;
    export let canvasStage: WorkflowStage;
    export let interactionMode: 'shapes' | 'chains' | 'paths';
    export let onChainClick: ((chainId: string) => void) | null = null;
    export let onPartClick: ((partId: string) => void) | null = null;

    // Resizable columns state
    let rightColumnWidth = 280; // Default width in pixels
    let isDraggingRight = false;
    let startX = 0;
    let startWidth = 0;

    // Simulation state
    let animationFrame: number | null = null;
    let isDestroyed = false;

    // Simulation state
    let isPlaying = false;
    let isPaused = false;
    let currentTime = 0;
    let totalTime = 0;
    let currentProgress = 0;
    let currentOperation = 'Ready';
    let lastFrameTime = 0;
    let simulationSpeed = 1; // 1x real-time default

    // Tool head position and animation data
    let toolHeadPosition: Point2D = { x: 0, y: 0 };

    // Animation data
    let animationSteps: Array<{
        type: 'rapid' | 'cut';
        path: Path | null;
        rapid: Rapid | null;
        startTime: number;
        endTime: number;
        distance: number;
        rapidRate?: number; // For rapid movements
    }> = [];

    // Store subscriptions
    let pathStoreState: { paths: Path[] } | null = null;
    let rapidStoreState: { rapids: Rapid[] } | null = null;
    let chainStoreState: ChainStore | null = null;
    let drawingState: DrawingState | null = null;
    let toolStoreState: Tool[] | null = null;
    let partStoreState: PartStore | null = null;

    // Statistics
    let totalCutDistance = 0;
    let totalRapidDistance = 0;
    let pierceCount = 0;
    let estimatedCutTime = 0;

    // Helper function to get feedRate from tool or use default, accounting for hole underspeed
    function getFeedRateForPath(path: Path): number {
        let baseFeedRate = 1000; // Default feed rate

        if (path.toolId && toolStoreState) {
            const tool = toolStoreState.find((t: Tool) => t.id === path.toolId);
            if (tool?.feedRate) {
                baseFeedRate = tool.feedRate;
            }
        }

        // Apply hole underspeed if applicable
        if (
            path.isHole &&
            path.holeUnderspeedPercent !== undefined &&
            path.holeUnderspeedPercent < 100
        ) {
            return baseFeedRate * (path.holeUnderspeedPercent / 100);
        }

        return baseFeedRate;
    }

    // Reactive formatted statistics for display - updates when drawingState or values change
    $: formattedCutDistance = drawingState
        ? formatDistance(totalCutDistance)
        : '0.0';
    $: formattedRapidDistance = drawingState
        ? formatDistance(totalRapidDistance)
        : '0.0';
    $: displayUnit = drawingState?.displayUnit || 'mm';

    // Unsubscribe functions
    let unsubscribers: Array<() => void> = [];

    function handleNext() {
        workflowStore.completeStage(WorkflowStage.SIMULATE);
        workflowStore.setStage(WorkflowStage.EXPORT);
    }

    // Update tool head overlay when position changes
    $: if (toolHeadPosition) {
        overlayStore.setToolHead(WorkflowStage.SIMULATE, toolHeadPosition);
    }

    // Auto-complete simulate stage when simulation data is available
    $: if (
        (pathStoreState?.paths && pathStoreState.paths.length > 0) ||
        (rapidStoreState?.rapids && rapidStoreState.rapids.length > 0)
    ) {
        workflowStore.completeStage(WorkflowStage.SIMULATE);
    }

    // Setup store subscriptions
    function setupStoreSubscriptions() {
        // Clear any existing subscriptions
        unsubscribers.forEach((fn) => fn());
        unsubscribers = [];

        unsubscribers.push(
            pathStore.subscribe((state) => {
                pathStoreState = state;
            })
        );

        unsubscribers.push(
            rapidStore.subscribe((state) => {
                rapidStoreState = state;
            })
        );

        unsubscribers.push(
            chainStore.subscribe((state) => {
                chainStoreState = state;
            })
        );

        unsubscribers.push(
            drawingStore.subscribe((state) => {
                drawingState = state;
            })
        );

        unsubscribers.push(
            toolStore.subscribe((state) => {
                toolStoreState = state;
            })
        );

        unsubscribers.push(
            partStore.subscribe((state) => {
                partStoreState = state;
            })
        );
    }

    // Initialize simulation data
    function initializeSimulation() {
        if (!pathStoreState || !rapidStoreState) return;

        buildAnimationSteps();
        resetSimulation();
    }

    // Build animation steps from paths and rapids
    function buildAnimationSteps() {
        animationSteps = [];
        let currentTime = 0;

        // Reset statistics
        totalCutDistance = 0;
        totalRapidDistance = 0;
        pierceCount = 0;
        estimatedCutTime = 0;

        // Get ordered paths and rapids
        const orderedPaths = pathStoreState
            ? [...pathStoreState.paths].sort((a, b) => a.order - b.order)
            : [];
        const rapids = rapidStoreState ? rapidStoreState.rapids : [];

        // Count pierces (one per path)
        pierceCount = orderedPaths.length;

        // Find starting position (first rapid start or first path start)
        if (rapids.length > 0) {
            toolHeadPosition = { ...rapids[0].start };
        } else if (orderedPaths.length > 0) {
            toolHeadPosition = getPathStartPoint(orderedPaths[0]);
        }

        // Process paths and rapids in sequence
        // Note: The optimization algorithm generates rapids to connect between paths
        // Rapids array should have one rapid before each path (rapids.length == paths.length)
        for (let i = 0; i < orderedPaths.length; i++) {
            const path = orderedPaths[i];

            // Add rapid before this path if it exists
            // Rapids are generated to move from previous position to this path's start
            if (i < rapids.length) {
                const rapid = rapids[i];
                const rapidDistance = Math.sqrt(
                    Math.pow(rapid.end.x - rapid.start.x, 2) +
                        Math.pow(rapid.end.y - rapid.start.y, 2)
                );
                const rapidRate = getRapidRateForPath(path); // Get rapid rate from path's tool
                const rapidTime = (rapidDistance / rapidRate) * 60; // Convert to seconds

                // Update statistics
                totalRapidDistance += rapidDistance;

                animationSteps.push({
                    type: 'rapid',
                    path: null,
                    rapid,
                    startTime: currentTime,
                    endTime: currentTime + rapidTime,
                    distance: rapidDistance,
                    rapidRate: rapidRate,
                });

                currentTime += rapidTime;
            }

            // Add cut path
            const pathDistance = getPathDistance(path);
            const feedRate = getFeedRateForPath(path); // Get feed rate from tool
            const cutTime = (pathDistance / feedRate) * 60; // Convert to seconds (feedRate is units/min)

            // Update statistics
            totalCutDistance += pathDistance;
            estimatedCutTime += cutTime;

            animationSteps.push({
                type: 'cut',
                path,
                rapid: null,
                startTime: currentTime,
                endTime: currentTime + cutTime,
                distance: pathDistance,
            });

            currentTime += cutTime;
        }

        totalTime = currentTime;
    }

    // Get rapid rate from DefaultsManager (automatically unit-aware)
    function getRapidRateForPath(_path: Path): number {
        return getDefaults().cam.rapidRate;
    }

    /**
     * Get starting point of a path, accounting for lead-in and offset.
     * When a path has calculated offset geometry (from kerf compensation),
     * this function uses the offset shapes instead of the original chain shapes.
     * Falls back to original chain shapes when no offset exists.
     * @param path - The path to get the starting point for
     * @returns The starting point coordinates
     */
    function getPathStartPoint(path: Path): Point2D {
        // Use execution chain if available (contains shapes in correct execution order)
        let shapes = path.cutChain?.shapes;

        // Fallback to offset shapes or original chain for backward compatibility
        if (!shapes) {
            shapes =
                path.offset?.offsetShapes ||
                chainStoreState?.chains?.find(
                    (c: Chain) => c.id === path.chainId
                )?.shapes;
        }

        if (!shapes || shapes.length === 0) return { x: 0, y: 0 };

        // Check if path has lead-in
        if (
            path.leadInConfig?.type &&
            path.leadInConfig.type !== 'none' &&
            path.leadInConfig.length &&
            path.leadInConfig.length > 0
        ) {
            // First try to use cached lead geometry
            if (hasValidCachedLeads(path)) {
                const cached = getCachedLeadGeometry(path);
                if (cached.leadIn) {
                    const cachedLeadInPoints = convertLeadGeometryToPoints(
                        cached.leadIn
                    );
                    if (cachedLeadInPoints.length > 0) {
                        // Return the first point of the cached lead-in (start of lead-in)
                        return cachedLeadInPoints[0];
                    }
                }
            }

            // Fallback to calculating if no valid cache
            try {
                // Find the part that contains this chain
                const part = findPartForChain(path.chainId);

                // Use offset shapes if available
                const chain = chainStoreState?.chains?.find(
                    (c: Chain) => c.id === path.chainId
                );
                if (!chain) return { x: 0, y: 0 };

                const chainForLeads = path.offset
                    ? { ...chain, shapes: path.offset.offsetShapes }
                    : chain;

                const leadInConfig: LeadConfig = path.leadInConfig || {
                    type: LeadType.NONE,
                    length: 0,
                    flipSide: false,
                    angle: 0,
                };
                const leadOutConfig: LeadConfig = path.leadOutConfig || {
                    type: LeadType.NONE,
                    length: 0,
                    flipSide: false,
                    angle: 0,
                };

                const leadResult = calculateLeads(
                    chainForLeads,
                    leadInConfig,
                    leadOutConfig,
                    path.cutDirection,
                    part
                );

                if (leadResult.leadIn) {
                    // Convert geometry to points and return the first point (start of lead-in)
                    const points = convertLeadGeometryToPoints(
                        leadResult.leadIn
                    );
                    if (points.length > 0) {
                        return points[0];
                    }
                }
            } catch (error) {
                console.warn(
                    'Failed to calculate lead-in for path:',
                    path.name,
                    error
                );
            }
        }

        // Fallback to chain start point
        const firstShape = shapes[0];
        // Simplified shape start point calculation
        const line = firstShape.geometry as Line;
        return line.start || { x: 0, y: 0 };
    }

    // Helper function to find the part that contains a given chain
    function findPartForChain(chainId: string): DetectedPart | undefined {
        return findPartContainingChain(chainId, partStoreState?.parts || []);
    }

    /**
     * Calculate total distance of a path, including lead-in and lead-out.
     * Uses offset shapes when available (from kerf compensation),
     * otherwise falls back to original chain shapes.
     * @param path - The path to calculate distance for
     * @returns Total path distance including leads
     */
    function getPathDistance(path: Path): number {
        // Use execution chain if available
        let shapes = path.cutChain?.shapes;
        const chain = chainStoreState?.chains?.find(
            (c: Chain) => c.id === path.chainId
        );

        // Fallback for backward compatibility
        if (!shapes) {
            if (!chain) return 0;
            shapes =
                path.offset?.offsetShapes ||
                path.cutChain?.shapes ||
                chain.shapes;
        }

        // Calculate chain distance
        let chainDistance = 0;
        if (shapes) {
            for (const shape of shapes) {
                chainDistance += getShapeLength(shape);
            }
        }

        // Add lead distances if present
        let leadInDistance = 0;
        let leadOutDistance = 0;

        try {
            if (
                (path.leadInConfig?.type &&
                    path.leadInConfig.type !== 'none' &&
                    path.leadInConfig.length &&
                    path.leadInConfig.length > 0) ||
                (path.leadOutConfig?.type &&
                    path.leadOutConfig.type !== 'none' &&
                    path.leadOutConfig.length &&
                    path.leadOutConfig.length > 0)
            ) {
                // First try to use cached lead geometry
                if (hasValidCachedLeads(path)) {
                    const cached = getCachedLeadGeometry(path);
                    if (cached.leadIn) {
                        const cachedLeadInPoints = convertLeadGeometryToPoints(
                            cached.leadIn
                        );
                        if (cachedLeadInPoints.length > 1) {
                            leadInDistance =
                                calculatePolylineLength(cachedLeadInPoints);
                        }
                    }
                    if (cached.leadOut) {
                        const cachedLeadOutPoints = convertLeadGeometryToPoints(
                            cached.leadOut
                        );
                        if (cachedLeadOutPoints.length > 1) {
                            leadOutDistance =
                                calculatePolylineLength(cachedLeadOutPoints);
                        }
                    }
                } else {
                    // Fallback to calculating if no valid cache
                    const part = findPartForChain(path.chainId);

                    const leadInConfig: LeadConfig = path.leadInConfig || {
                        type: LeadType.NONE,
                        length: 0,
                        flipSide: false,
                        angle: 0,
                    };
                    const leadOutConfig: LeadConfig = path.leadOutConfig || {
                        type: LeadType.NONE,
                        length: 0,
                        flipSide: false,
                        angle: 0,
                    };

                    const chainForLeads =
                        path.offset && chain
                            ? {
                                  ...chain,
                                  shapes: path.offset.offsetShapes,
                              }
                            : chain;

                    if (chainForLeads) {
                        const leadResult = calculateLeads(
                            chainForLeads,
                            leadInConfig,
                            leadOutConfig,
                            path.cutDirection,
                            part
                        );

                        if (leadResult.leadIn) {
                            const points = convertLeadGeometryToPoints(
                                leadResult.leadIn
                            );
                            if (points.length > 1) {
                                leadInDistance =
                                    calculatePolylineLength(points);
                            }
                        }
                        if (leadResult.leadOut) {
                            const points = convertLeadGeometryToPoints(
                                leadResult.leadOut
                            );
                            if (points.length > 1) {
                                leadOutDistance =
                                    calculatePolylineLength(points);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.warn(
                'Failed to calculate lead distances for path:',
                path.name,
                error
            );
        }

        return leadInDistance + chainDistance + leadOutDistance;
    }

    // Calculate length of a shape (simplified but functional)
    function getShapeLength(shape: Shape): number {
        switch (shape.type) {
            case GeometryType.LINE:
                const line = shape.geometry as Line;
                return Math.sqrt(
                    Math.pow(line.end.x - line.start.x, 2) +
                        Math.pow(line.end.y - line.start.y, 2)
                );
            case GeometryType.CIRCLE:
                const circle = shape.geometry as Circle;
                return 2 * Math.PI * circle.radius;
            case GeometryType.ARC:
                const arc = shape.geometry as Arc;
                const angleRange = Math.abs(arc.endAngle - arc.startAngle); // Angles are in radians
                return angleRange * arc.radius; // Arc length = radius * angle (in radians)
            case GeometryType.POLYLINE:
                const polyline = shape.geometry as Polyline;
                const polylinePoints = polylineToPoints(polyline);
                let polylineDistance = 0;
                for (let i = 0; i < polylinePoints.length - 1; i++) {
                    const p1 = polylinePoints[i];
                    const p2 = polylinePoints[i + 1];
                    polylineDistance += Math.sqrt(
                        Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
                    );
                }
                return polylineDistance;
            case GeometryType.SPLINE:
                const spline = shape.geometry as Spline;
                try {
                    // Calculate arc length by sampling the NURBS curve
                    const samples = tessellateSpline(spline, {
                        numSamples: 100,
                    }).points; // Use 100 samples for accurate length
                    let splineLength = 0;
                    for (let i = 0; i < samples.length - 1; i++) {
                        const p1 = samples[i];
                        const p2 = samples[i + 1];
                        splineLength += Math.sqrt(
                            Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
                        );
                    }
                    return splineLength;
                } catch {
                    // Fallback: calculate distance between fit points or control points
                    if (spline.fitPoints && spline.fitPoints.length > 1) {
                        let fallbackLength = 0;
                        for (let i = 0; i < spline.fitPoints.length - 1; i++) {
                            const p1 = spline.fitPoints[i];
                            const p2 = spline.fitPoints[i + 1];
                            fallbackLength += Math.sqrt(
                                Math.pow(p2.x - p1.x, 2) +
                                    Math.pow(p2.y - p1.y, 2)
                            );
                        }
                        return fallbackLength;
                    } else if (
                        spline.controlPoints &&
                        spline.controlPoints.length > 1
                    ) {
                        let fallbackLength = 0;
                        for (
                            let i = 0;
                            i < spline.controlPoints.length - 1;
                            i++
                        ) {
                            const p1 = spline.controlPoints[i];
                            const p2 = spline.controlPoints[i + 1];
                            fallbackLength += Math.sqrt(
                                Math.pow(p2.x - p1.x, 2) +
                                    Math.pow(p2.y - p1.y, 2)
                            );
                        }
                        return fallbackLength;
                    }
                    return 100; // Final fallback
                }
            case GeometryType.ELLIPSE:
                const ellipse = shape.geometry as Ellipse;
                // Calculate major and minor axis lengths
                const majorAxisLength = Math.sqrt(
                    ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
                        ellipse.majorAxisEndpoint.y *
                            ellipse.majorAxisEndpoint.y
                );
                const minorAxisLength =
                    majorAxisLength * ellipse.minorToMajorRatio;

                // Check if it's a full ellipse or elliptical arc
                if (
                    typeof ellipse.startParam === 'number' &&
                    typeof ellipse.endParam === 'number'
                ) {
                    // It's an elliptical arc - use Ramanujan's approximation for the arc portion
                    const paramSpan = Math.abs(
                        ellipse.endParam - ellipse.startParam
                    );
                    const fullEllipsePerimeter =
                        Math.PI *
                        (3 * (majorAxisLength + minorAxisLength) -
                            Math.sqrt(
                                (3 * majorAxisLength + minorAxisLength) *
                                    (majorAxisLength + 3 * minorAxisLength)
                            ));
                    return fullEllipsePerimeter * (paramSpan / (2 * Math.PI));
                } else {
                    // It's a full ellipse - use Ramanujan's approximation for ellipse perimeter
                    return (
                        Math.PI *
                        (3 * (majorAxisLength + minorAxisLength) -
                            Math.sqrt(
                                (3 * majorAxisLength + minorAxisLength) *
                                    (majorAxisLength + 3 * minorAxisLength)
                            ))
                    );
                }
            default:
                return 100; // Default fallback
        }
    }

    // Reset simulation to beginning
    function resetSimulation() {
        isPlaying = false;
        isPaused = false;
        currentTime = 0;
        currentProgress = 0;
        currentOperation = 'Ready';
        lastFrameTime = 0;

        // Reset tool head to starting position
        if (animationSteps.length > 0) {
            const firstStep = animationSteps[0];
            if (firstStep.type === 'rapid' && firstStep.rapid) {
                toolHeadPosition = { ...firstStep.rapid.start };
            } else if (firstStep.type === 'cut' && firstStep.path) {
                toolHeadPosition = getPathStartPoint(firstStep.path);
            }
        } else {
            toolHeadPosition = { x: 0, y: 0 };
        }
    }

    // Simulation controls
    function playSimulation() {
        if (isPaused) {
            isPaused = false;
            lastFrameTime = 0; // Reset frame time when resuming
        } else if (!isPlaying) {
            isPlaying = true;
            lastFrameTime = 0; // Reset frame time when starting
        }
        animate();
    }

    function pauseSimulation() {
        isPaused = true;
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
    }

    function stopSimulation() {
        isPlaying = false;
        isPaused = false;
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
        resetSimulation();
    }

    // Animation loop
    function animate() {
        if (!isPlaying || isPaused || isDestroyed) return;

        const now = performance.now() / 1000; // Convert to seconds
        if (lastFrameTime === 0) {
            lastFrameTime = now;
        }

        const deltaTime = now - lastFrameTime;
        lastFrameTime = now;
        currentTime += deltaTime * simulationSpeed;

        if (currentTime >= totalTime) {
            // Animation complete
            currentTime = totalTime;
            currentProgress = 100;
            currentOperation = 'Complete';
            isPlaying = false;
            workflowStore.completeStage(WorkflowStage.SIMULATE);
            return;
        }

        // Update tool head position and current operation
        updateToolHeadPosition();

        // Update progress
        currentProgress = totalTime > 0 ? (currentTime / totalTime) * 100 : 0;

        animationFrame = requestAnimationFrame(() => animate());
    }

    // Update tool head position based on current time
    function updateToolHeadPosition() {
        const currentStep = animationSteps.find(
            (step) =>
                currentTime >= step.startTime && currentTime <= step.endTime
        );

        if (!currentStep) return;

        const stepProgress =
            (currentTime - currentStep.startTime) /
            (currentStep.endTime - currentStep.startTime);

        if (currentStep.type === 'rapid' && currentStep.rapid) {
            const rapidRate = currentStep.rapidRate || 3000;
            currentOperation = `Rapid Movement (${rapidRate} units/min)`;
            const rapid = currentStep.rapid;
            toolHeadPosition = {
                x: rapid.start.x + (rapid.end.x - rapid.start.x) * stepProgress,
                y: rapid.start.y + (rapid.end.y - rapid.start.y) * stepProgress,
            };
        } else if (currentStep.type === 'cut' && currentStep.path) {
            currentOperation = `Cutting (${getFeedRateForPath(currentStep.path)} units/min)`;
            updateToolHeadOnPath(currentStep.path, stepProgress);
        }
    }

    /**
     * Update tool head position along a cutting path, including lead-in and lead-out.
     * This function handles paths with offset geometry from kerf compensation,
     * automatically using offset shapes when available and falling back to
     * original chain shapes when no offset exists.
     * @param path - The path being simulated
     * @param progress - Progress along the path (0-1)
     */
    function updateToolHeadOnPath(path: Path, progress: number) {
        // Use execution chain if available
        let shapes = path.cutChain?.shapes;
        let chain = path.cutChain;

        // Fallback for backward compatibility
        if (!shapes) {
            chain = chainStoreState?.chains?.find(
                (c: Chain) => c.id === path.chainId
            );
            if (!chain) return;
            shapes =
                path.offset?.offsetShapes ||
                path.cutChain?.shapes ||
                chain.shapes;
        }

        if (!shapes || shapes.length === 0) return;

        // Get lead geometry if available
        let leadInGeometry: Point2D[] = [];
        let leadOutGeometry: Point2D[] = [];

        try {
            if (
                (path.leadInConfig?.type &&
                    path.leadInConfig.type !== 'none' &&
                    path.leadInConfig.length &&
                    path.leadInConfig.length > 0) ||
                (path.leadOutConfig?.type &&
                    path.leadOutConfig.type !== 'none' &&
                    path.leadOutConfig.length &&
                    path.leadOutConfig.length > 0)
            ) {
                // First try to use cached lead geometry
                if (hasValidCachedLeads(path)) {
                    const cached = getCachedLeadGeometry(path);
                    if (cached.leadIn) {
                        const cachedLeadInPoints = convertLeadGeometryToPoints(
                            cached.leadIn
                        );
                        if (cachedLeadInPoints.length > 1) {
                            leadInGeometry = cachedLeadInPoints;
                        }
                    }
                    if (cached.leadOut) {
                        const cachedLeadOutPoints = convertLeadGeometryToPoints(
                            cached.leadOut
                        );
                        if (cachedLeadOutPoints.length > 1) {
                            leadOutGeometry = cachedLeadOutPoints;
                        }
                    }
                } else {
                    // Fallback to calculating if no valid cache
                    const part = findPartForChain(path.chainId);

                    const leadInConfig: LeadConfig = path.leadInConfig || {
                        type: LeadType.NONE,
                        length: 0,
                        flipSide: false,
                        angle: 0,
                    };
                    const leadOutConfig: LeadConfig = path.leadOutConfig || {
                        type: LeadType.NONE,
                        length: 0,
                        flipSide: false,
                        angle: 0,
                    };

                    const chainForLeads =
                        path.offset && chain
                            ? {
                                  ...chain,
                                  shapes: path.offset.offsetShapes,
                              }
                            : chain;

                    if (chainForLeads) {
                        const leadResult = calculateLeads(
                            chainForLeads,
                            leadInConfig,
                            leadOutConfig,
                            path.cutDirection,
                            part
                        );

                        if (leadResult.leadIn) {
                            const points = convertLeadGeometryToPoints(
                                leadResult.leadIn
                            );
                            if (points.length > 1) {
                                leadInGeometry = points;
                            }
                        }
                        if (leadResult.leadOut) {
                            const points = convertLeadGeometryToPoints(
                                leadResult.leadOut
                            );
                            if (points.length > 1) {
                                leadOutGeometry = points;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.warn(
                'Failed to calculate leads for simulation:',
                path.name,
                error
            );
        }

        // Calculate lengths
        const leadInLength = calculatePolylineLength(leadInGeometry);
        const chainLength =
            chain && shapes ? getChainDistance({ ...chain, shapes }) : 0; // Use offset shapes if available
        const leadOutLength = calculatePolylineLength(leadOutGeometry);
        const totalLength = leadInLength + chainLength + leadOutLength;

        const targetDistance = totalLength * progress;

        // Determine which section we're in
        if (targetDistance <= leadInLength && leadInGeometry.length > 1) {
            // We're in the lead-in
            const leadInProgress =
                leadInLength > 0 ? targetDistance / leadInLength : 0;
            toolHeadPosition = getPositionOnPolyline(
                leadInGeometry,
                leadInProgress
            );
        } else if (
            targetDistance <= leadInLength + chainLength &&
            chain &&
            shapes
        ) {
            // We're in the main chain
            const chainTargetDistance = targetDistance - leadInLength;
            const chainProgress =
                chainLength > 0 ? chainTargetDistance / chainLength : 0;
            toolHeadPosition = getPositionOnChain(
                { ...chain, shapes },
                chainProgress
            );
        } else {
            // We're in the lead-out
            const leadOutTargetDistance =
                targetDistance - leadInLength - chainLength;
            const leadOutProgress =
                leadOutLength > 0 ? leadOutTargetDistance / leadOutLength : 0;
            toolHeadPosition = getPositionOnPolyline(
                leadOutGeometry,
                leadOutProgress
            );
        }
    }

    // Calculate the length of a polyline (for leads)
    function calculatePolylineLength(points: Point2D[]): number {
        if (points.length < 2) return 0;

        let length = 0;
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            length += Math.sqrt(
                Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
            );
        }
        return length;
    }

    // Get position along a polyline (for leads)
    function getPositionOnPolyline(
        points: Point2D[],
        progress: number
    ): Point2D {
        if (points.length === 0) return { x: 0, y: 0 };
        if (points.length === 1) return points[0];

        progress = Math.max(0, Math.min(1, progress));

        const totalLength = calculatePolylineLength(points);
        const targetDistance = totalLength * progress;

        let currentDistance = 0;
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const segmentLength = Math.sqrt(
                Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
            );

            if (currentDistance + segmentLength >= targetDistance) {
                const segmentProgress =
                    segmentLength > 0
                        ? (targetDistance - currentDistance) / segmentLength
                        : 0;
                return {
                    x: p1.x + (p2.x - p1.x) * segmentProgress,
                    y: p1.y + (p2.y - p1.y) * segmentProgress,
                };
            }
            currentDistance += segmentLength;
        }

        return points[points.length - 1];
    }

    // Get position along a chain (original chain geometry)
    function getPositionOnChain(chain: Chain, progress: number): Point2D {
        const totalLength = getChainDistance(chain);
        const targetDistance = totalLength * progress;

        // Use shapes in the order they appear in the chain (already correct for execution chains)
        const shapes = chain.shapes;

        let currentDistance = 0;
        for (const shape of shapes) {
            const shapeLength = getShapeLength(shape);
            if (currentDistance + shapeLength >= targetDistance) {
                // Tool head is on this shape
                const shapeProgress =
                    shapeLength > 0
                        ? (targetDistance - currentDistance) / shapeLength
                        : 0;
                return getPositionOnShape(shape, shapeProgress);
            }
            currentDistance += shapeLength;
        }

        // Fallback to last shape end
        if (shapes.length > 0) {
            const lastShape = shapes[shapes.length - 1];
            return getPositionOnShape(lastShape, 1.0);
        }

        return { x: 0, y: 0 };
    }

    // Calculate total distance of a chain
    function getChainDistance(chain: Chain): number {
        let totalDistance = 0;
        for (const shape of chain.shapes) {
            totalDistance += getShapeLength(shape);
        }
        return totalDistance;
    }

    // Get position along a shape at given progress (0-1) - simplified
    function getPositionOnShape(shape: Shape, progress: number): Point2D {
        progress = Math.max(0, Math.min(1, progress)); // Clamp to 0-1

        switch (shape.type) {
            case GeometryType.LINE:
                const line = shape.geometry as Line;
                // Natural direction: go from start to end
                return {
                    x: line.start.x + (line.end.x - line.start.x) * progress,
                    y: line.start.y + (line.end.y - line.start.y) * progress,
                };
            case GeometryType.CIRCLE:
                // Use natural direction
                return getShapePointAt(shape, progress);
            case GeometryType.ARC:
                // Use natural direction
                return getShapePointAt(shape, progress);
            case GeometryType.POLYLINE:
                const polyline = shape.geometry as Polyline;
                const polylinePoints = polylineToPoints(polyline);
                if (polylinePoints.length < 2)
                    return polylinePoints[0] || { x: 0, y: 0 };

                // Use natural direction for polylines
                const points = polylinePoints;

                // Find which segment we're on
                const totalLength = getShapeLength(shape);
                const targetDistance = totalLength * progress;

                let currentDistance = 0;
                for (let i = 0; i < points.length - 1; i++) {
                    const p1 = points[i];
                    const p2 = points[i + 1];
                    const segmentLength = Math.sqrt(
                        Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
                    );

                    if (currentDistance + segmentLength >= targetDistance) {
                        const segmentProgress =
                            (targetDistance - currentDistance) / segmentLength;
                        return {
                            x: p1.x + (p2.x - p1.x) * segmentProgress,
                            y: p1.y + (p2.y - p1.y) * segmentProgress,
                        };
                    }
                    currentDistance += segmentLength;
                }
                return points[points.length - 1];
            case GeometryType.SPLINE:
                const splineGeom = shape.geometry as Spline;
                try {
                    // Use NURBS evaluation to get position at progress along curve
                    return getSplinePointAt(splineGeom, progress);
                } catch {
                    // Fallback: interpolate between fit points or control points
                    if (
                        splineGeom.fitPoints &&
                        splineGeom.fitPoints.length > 1
                    ) {
                        const totalLength = getShapeLength(shape);
                        const targetDistance = totalLength * progress;

                        let currentDistance = 0;
                        for (
                            let i = 0;
                            i < splineGeom.fitPoints.length - 1;
                            i++
                        ) {
                            const p1 = splineGeom.fitPoints[i];
                            const p2 = splineGeom.fitPoints[i + 1];
                            const segmentLength = Math.sqrt(
                                Math.pow(p2.x - p1.x, 2) +
                                    Math.pow(p2.y - p1.y, 2)
                            );

                            if (
                                currentDistance + segmentLength >=
                                targetDistance
                            ) {
                                const segmentProgress =
                                    (targetDistance - currentDistance) /
                                    segmentLength;
                                return {
                                    x: p1.x + (p2.x - p1.x) * segmentProgress,
                                    y: p1.y + (p2.y - p1.y) * segmentProgress,
                                };
                            }
                            currentDistance += segmentLength;
                        }
                        return splineGeom.fitPoints[
                            splineGeom.fitPoints.length - 1
                        ];
                    } else if (
                        splineGeom.controlPoints &&
                        splineGeom.controlPoints.length > 1
                    ) {
                        // Simple linear interpolation through control points as final fallback
                        const index = Math.floor(
                            progress * (splineGeom.controlPoints.length - 1)
                        );
                        const localProgress =
                            progress * (splineGeom.controlPoints.length - 1) -
                            index;
                        const p1 = splineGeom.controlPoints[index];
                        const p2 =
                            splineGeom.controlPoints[
                                Math.min(
                                    index + 1,
                                    splineGeom.controlPoints.length - 1
                                )
                            ];
                        return {
                            x: p1.x + (p2.x - p1.x) * localProgress,
                            y: p1.y + (p2.y - p1.y) * localProgress,
                        };
                    }
                    return { x: 0, y: 0 }; // Final fallback
                }
            case GeometryType.ELLIPSE:
                const ellipse = shape.geometry as Ellipse;
                // Calculate major and minor axis lengths
                const majorAxisLength = Math.sqrt(
                    ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
                        ellipse.majorAxisEndpoint.y *
                            ellipse.majorAxisEndpoint.y
                );
                const minorAxisLength =
                    majorAxisLength * ellipse.minorToMajorRatio;
                const majorAxisAngle = Math.atan2(
                    ellipse.majorAxisEndpoint.y,
                    ellipse.majorAxisEndpoint.x
                );

                let param: number;
                if (
                    typeof ellipse.startParam === 'number' &&
                    typeof ellipse.endParam === 'number'
                ) {
                    // It's an elliptical arc - use natural direction
                    param =
                        ellipse.startParam +
                        (ellipse.endParam - ellipse.startParam) * progress;
                } else {
                    // It's a full ellipse - use natural direction
                    param = progress * 2 * Math.PI;
                }

                // Calculate point on canonical ellipse (axes aligned)
                const canonicalX = majorAxisLength * Math.cos(param);
                const canonicalY = minorAxisLength * Math.sin(param);

                // Rotate by major axis angle and translate to center
                const cos = Math.cos(majorAxisAngle);
                const sin = Math.sin(majorAxisAngle);

                return {
                    x: ellipse.center.x + canonicalX * cos - canonicalY * sin,
                    y: ellipse.center.y + canonicalX * sin + canonicalY * cos,
                };
            default:
                return { x: 0, y: 0 };
        }
    }

    // Tool head drawing will be added as an overlay to the shared canvas
    // This removes the need for custom drawing functions

    // Format time in MM:SS format
    function formatTime(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // Format distance with units
    function formatDistance(distance: number): string {
        if (!drawingState?.drawing) return '0.0';
        const displayUnit = drawingState.displayUnit || 'mm';

        // Convert from drawing units to display units if needed
        let displayDistance = distance;
        if (drawingState.drawing.units !== displayUnit) {
            // Convert between mm and inch
            if (drawingState.drawing.units === 'mm' && displayUnit === 'inch') {
                displayDistance = distance / 25.4;
            } else if (
                drawingState.drawing.units === 'inch' &&
                displayUnit === 'mm'
            ) {
                displayDistance = distance * 25.4;
            }
        }

        return displayDistance.toFixed(1);
    }

    // Load column widths from localStorage on mount
    onMount(() => {
        const savedRightWidth = localStorage.getItem(
            'metalheadcam-simulate-right-column-width'
        );

        if (savedRightWidth) {
            rightColumnWidth = parseInt(savedRightWidth, 10);
        }

        // Initialize simulation
        setupStoreSubscriptions();
        initializeSimulation();
    });

    onDestroy(() => {
        // Mark component as destroyed
        isDestroyed = true;

        // Cancel animation frame
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }

        // Unsubscribe from all stores
        unsubscribers.forEach((fn) => fn());
        unsubscribers = [];
    });

    // Save column widths to localStorage
    function saveColumnWidths() {
        localStorage.setItem(
            'metalheadcam-simulate-right-column-width',
            rightColumnWidth.toString()
        );
    }

    // Right column resize handlers
    function handleRightResizeStart(e: MouseEvent) {
        isDraggingRight = true;
        startX = e.clientX;
        startWidth = rightColumnWidth;
        document.addEventListener('mousemove', handleRightResize);
        document.addEventListener('mouseup', handleRightResizeEnd);
        e.preventDefault();
    }

    function handleRightResize(e: MouseEvent) {
        if (!isDraggingRight) return;
        const deltaX = startX - e.clientX; // Reverse delta for right column
        const newWidth = Math.max(200, Math.min(600, startWidth + deltaX)); // Min 200px, max 600px
        rightColumnWidth = newWidth;
    }

    function handleRightResizeEnd() {
        isDraggingRight = false;
        document.removeEventListener('mousemove', handleRightResize);
        document.removeEventListener('mouseup', handleRightResizeEnd);
        saveColumnWidths();
    }

    // Keyboard support for resize handles
    function handleRightKeydown(e: KeyboardEvent) {
        if (e.key === 'ArrowLeft') {
            rightColumnWidth = Math.min(600, rightColumnWidth + 10);
            saveColumnWidths();
            e.preventDefault();
        } else if (e.key === 'ArrowRight') {
            rightColumnWidth = Math.max(200, rightColumnWidth - 10);
            saveColumnWidths();
            e.preventDefault();
        }
    }
</script>

<ThreeColumnLayout
    leftColumnStorageKey="simulate-left-column"
    rightColumnStorageKey="simulate-right-column"
    leftColumnWidth={0}
    {rightColumnWidth}
>
    <!-- Left column empty with 0 width -->
    <svelte:fragment slot="left"></svelte:fragment>

    <!-- Center Column - 3D Simulation Viewport -->
    <svelte:fragment slot="center">
        <div class="simulation-header">
            <div class="simulation-controls">
                <button
                    class="control-btn"
                    on:click={playSimulation}
                    disabled={isPlaying && !isPaused}
                >
                    <span>▶️</span> Play
                </button>
                <button
                    class="control-btn"
                    on:click={pauseSimulation}
                    disabled={!isPlaying || isPaused}
                >
                    <span>⏸️</span> Pause
                </button>
                <button
                    class="control-btn"
                    on:click={stopSimulation}
                    disabled={!isPlaying && !isPaused}
                >
                    <span>⏹️</span> Stop
                </button>
                <div class="speed-control">
                    <label for="speed-select">Speed:</label>
                    <select
                        id="speed-select"
                        bind:value={simulationSpeed}
                        class="speed-select"
                    >
                        <option value={0.1}>0.1x</option>
                        <option value={0.5}>0.5x</option>
                        <option value={1}>1x (Real-time)</option>
                        <option value={5}>5x</option>
                        <option value={10}>10x</option>
                    </select>
                </div>
            </div>
        </div>
        <svelte:component
            this={sharedCanvas}
            currentStage={canvasStage}
            {interactionMode}
            {onChainClick}
            {onPartClick}
        />
        <div class="simulation-progress">
            <div class="progress-info">
                <span
                    >Progress: <strong>{currentProgress.toFixed(1)}%</strong
                    ></span
                >
                <span
                    >Time: <strong
                        >{formatTime(currentTime)} / {formatTime(
                            totalTime
                        )}</strong
                    ></span
                >
                <span
                    >Current Operation: <strong>{currentOperation}</strong
                    ></span
                >
            </div>
            <div class="progress-bar">
                <div
                    class="progress-fill"
                    style="width: {currentProgress}%"
                ></div>
            </div>
        </div>
    </svelte:fragment>

    <!-- Right Column - Simulation Stats and Controls -->
    <svelte:fragment slot="right">
        <!-- Right resize handle -->
        <button
            class="resize-handle resize-handle-left"
            on:mousedown={handleRightResizeStart}
            on:keydown={handleRightKeydown}
            class:dragging={isDraggingRight}
            aria-label="Resize right panel (Arrow keys to adjust)"
            type="button"
        ></button>
        <AccordionPanel title="Cut Statistics" isExpanded={true}>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">Total Length:</span>
                    <span class="stat-value"
                        >{formattedCutDistance} {displayUnit}</span
                    >
                </div>
                <div class="stat-item">
                    <span class="stat-label">Cut Time:</span>
                    <span class="stat-value"
                        >{formatTime(estimatedCutTime)}</span
                    >
                </div>
                <div class="stat-item">
                    <span class="stat-label">Pierce Count:</span>
                    <span class="stat-value">{pierceCount}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Rapid Distance:</span>
                    <span class="stat-value"
                        >{formattedRapidDistance} {displayUnit}</span
                    >
                </div>
            </div>
        </AccordionPanel>

        <AccordionPanel title="Next Stage" isExpanded={true}>
            <div class="next-stage-content">
                <button class="next-button" on:click={handleNext}>
                    Next: Export G-code
                </button>
                <p class="next-help">
                    Simulation complete! Ready to generate and export G-code.
                </p>
            </div>
        </AccordionPanel>
    </svelte:fragment>
</ThreeColumnLayout>

<style>
    /* Layout handled by ThreeColumnLayout */

    .simulation-header {
        padding: 1rem 2rem;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        background-color: #f5f5f5;
    }

    .simulation-controls {
        display: flex;
        gap: 0.5rem;
        align-items: center;
    }

    .speed-control {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-left: 1rem;
        font-size: 0.875rem;
        color: #374151;
    }

    .speed-select {
        padding: 0.25rem 0.5rem;
        background: white;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        cursor: pointer;
    }

    .control-btn {
        padding: 0.5rem 1rem;
        background: white;
        color: #374151;
        border: 1px solid #d1d5db;
        border-radius: 0.375rem;
        cursor: pointer;
        font-size: 0.875rem;
        transition: all 0.2s ease;
    }

    .control-btn:hover:not(:disabled) {
        background: #f9fafb;
        border-color: #9ca3af;
    }

    .control-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .simulation-progress {
        padding: 1rem 2rem;
        border-top: 1px solid #e5e7eb;
        background-color: #f5f5f5;
    }

    .progress-info {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.5rem;
        font-size: 0.875rem;
        color: #6b7280;
    }

    .progress-bar {
        height: 4px;
        background: #e5e7eb;
        border-radius: 2px;
        overflow: hidden;
    }

    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, rgb(0, 133, 84), rgb(0, 133, 84));
        transition: width 0.3s ease;
    }

    /* Removed .panel and .panel-title styles - now handled by AccordionPanel component */

    .next-stage-content {
        background: linear-gradient(
            135deg,
            rgb(0, 83, 135) 0%,
            rgb(0, 83, 135) 100%
        );
        color: white;
        border-radius: 0.5rem;
        padding: 1rem;
    }

    .stats-grid {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .stat-item {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0;
        border-bottom: 1px solid #e5e7eb;
    }

    .stat-item:last-child {
        border-bottom: none;
    }

    .stat-label {
        color: #6b7280;
    }

    .stat-value {
        color: #374151;
        font-weight: 600;
    }

    /* Removed .next-stage-panel styles - now handled by next-stage-content within AccordionPanel */

    .next-button {
        width: 100%;
        padding: 0.75rem 1rem;
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 0.375rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-bottom: 0.5rem;
    }

    .next-button:hover {
        background: rgba(255, 255, 255, 0.3);
        border-color: rgba(255, 255, 255, 0.5);
    }

    .next-help {
        margin: 0;
        font-size: 0.875rem;
        color: rgba(255, 255, 255, 0.9);
        line-height: 1.4;
    }

    /* Resize handle styles */
    .resize-handle {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 6px;
        cursor: col-resize;
        background: transparent;
        border: none;
        padding: 0;
        z-index: 10;
        transition: background-color 0.2s ease;
    }

    .resize-handle:hover {
        background-color: rgb(0, 83, 135);
        opacity: 0.3;
    }

    .resize-handle.dragging {
        background-color: rgb(0, 83, 135);
        opacity: 0.5;
    }

    .resize-handle-left {
        left: -3px; /* Half of width to center on border */
    }

    /* Prevent text selection during resize - handled by ThreeColumnLayout */
</style>
