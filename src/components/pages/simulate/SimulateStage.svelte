<script lang="ts">
    /**
     * SimulateStage Component
     *
     * This component provides 3D cutting simulation with support for offset cuts.
     * When cuts have calculated offsets (from kerf compensation), the simulation
     * automatically uses the offset geometry for:
     * - Tool head movement and animation
     * - Distance and timing calculations
     * - Lead-in/out calculations
     *
     * The visual rendering shows:
     * - Offset cuts as solid green lines (when present)
     * - Original cuts as dashed green reference lines
     * - Automatic fallback to original cuts when no offset exists
     */
    import AccordionPanel from '$components/panels/AccordionPanel.svelte';
    import SimulatePanel from '$components/panels/SimulatePanel.svelte';
    import ThreeColumnLayout from '$components/layout/ThreeColumnLayout.svelte';
    import { workflowStore } from '$lib/stores/workflow/store.svelte';
    import { WorkflowStage } from '$lib/stores/workflow/enums';
    import { planStore } from '$lib/stores/plan/store.svelte';
    import { drawingStore } from '$lib/stores/drawing/store.svelte';
    import { toolStore } from '$lib/stores/tools/store.svelte';
    import { overlayStore } from '$lib/stores/overlay/store.svelte';
    import { settingsStore } from '$lib/stores/settings/store.svelte';
    import { onMount, onDestroy, untrack } from 'svelte';
    import type { Point2D } from '$lib/geometry/point/interfaces';
    import type { Line } from '$lib/geometry/line/interfaces';
    import type { ShapeData } from '$lib/cam/shape/interfaces';
    import type { ChainData } from '$lib/cam/chain/interfaces';
    import type { CutData } from '$lib/cam/cut/interfaces';
    import { Cut } from '$lib/cam/cut/classes.svelte';
    import type { Rapid } from '$lib/cam/rapid/interfaces';
    import { calculateLeads } from '$lib/cam/lead/lead-calculation';
    import { type LeadConfig } from '$lib/cam/lead/interfaces';
    import { MeasurementSystem } from '$lib/config/settings/enums';
    import { Part } from '$lib/cam/part/classes.svelte';
    import { LeadType } from '$lib/cam/lead/enums';
    import { convertLeadGeometryToPoints } from '$lib/cam/lead/functions';
    import DrawingCanvasContainer from '$components/layout/DrawingCanvasContainer.svelte';
    import { Unit } from '$lib/config/units/units';
    import { OperationAction } from '$lib/cam/operation/enums';
    import { DEFAULT_SPOT_DURATION } from '$lib/config/defaults/operation-defaults';
    import {
        getCachedLeadGeometry,
        hasValidCachedLeads,
    } from '$lib/cam/cut/lead-persistence';
    import { Chain } from '$lib/cam/chain/classes.svelte';
    import { Shape } from '$lib/cam/shape/classes';
    import {
        convertDistanceToDisplayUnit,
        getFeedRateForCut,
        calculatePolylineLength,
        getPositionOnPolyline,
        getShapeLength,
        getChainDistance,
        getPositionOnChain,
        findPartForChain,
        formatTime,
        formatDistance,
    } from './functions';

    // Props from WorkflowContainer for shared canvas
    let {
        sharedCanvas,
        canvasStage,
        onChainClick = null,
        onPartClick = null,
    }: {
        sharedCanvas: typeof DrawingCanvasContainer;
        canvasStage: WorkflowStage;
        onChainClick?: ((chainId: string) => void) | null;
        onPartClick?: ((partId: string) => void) | null;
    } = $props();

    // Resizable columns state
    let rightColumnWidth = $state(280); // Default width in pixels
    let isDraggingRight = $state(false);
    let startX = $state(0);
    let startWidth = $state(0);

    // Simulation state
    let animationFrame: number | null = $state(null);
    let isDestroyed = $state(false);

    // Simulation state
    let isPlaying = $state(false);
    let isPaused = $state(false);
    let currentTime = $state(0);
    let totalTime = $state(0);
    let currentProgress = $state(0);
    let currentOperation = $state('Ready');
    let lastFrameTime = $state(0);
    let simulationSpeed = $state(1); // 1x real-time default
    let isTorchOn = $state(false); // Torch status indicator

    // Tool head position and animation data
    let toolHeadPosition: Point2D = $state({ x: 0, y: 0 });

    // Animation data
    let animationSteps: Array<{
        type: 'rapid' | 'cut';
        cut: CutData | null;
        rapid: Rapid | null;
        startTime: number;
        endTime: number;
        distance: number;
        rapidRate?: number; // For rapid movements
    }> = [];

    // Store state
    const toolStoreState = $derived(toolStore.tools);
    const settingsStoreState = $derived(
        settingsStore.settings ? { settings: settingsStore.settings } : null
    );

    // Chains derived from drawing layers
    const chains = $derived(
        drawingStore.drawing
            ? Object.values(drawingStore.drawing.layers).flatMap(
                  (layer) => layer.chains
              )
            : []
    );

    // Statistics
    let totalCutDistance = $state(0);
    let totalRapidDistance = $state(0);
    let pierceCount = $state(0);
    let estimatedCutTime = $state(0);

    // Reactive formatted statistics for display - updates when drawingStore or values change
    const formattedCutDistance = $derived(
        drawingStore.drawing ? formatDistance(totalCutDistance) : '0.0'
    );
    const formattedRapidDistance = $derived(
        drawingStore.drawing ? formatDistance(totalRapidDistance) : '0.0'
    );
    const displayUnit = $derived(
        (drawingStore.displayUnit || 'mm') as 'mm' | 'inch'
    );

    function handleNext() {
        workflowStore.completeStage(WorkflowStage.SIMULATE);
        workflowStore.setStage(WorkflowStage.EXPORT);
    }

    // Update tool head overlay when position changes
    $effect(() => {
        if (toolHeadPosition) {
            untrack(() =>
                overlayStore.setToolHead(
                    WorkflowStage.SIMULATE,
                    toolHeadPosition
                )
            );
        }
    });

    // Auto-complete simulate stage when simulation data is available
    $effect(() => {
        if (planStore.plan.cuts && planStore.plan.cuts.length > 0) {
            untrack(() => workflowStore.completeStage(WorkflowStage.SIMULATE));
        }
    });

    // Rebuild animation steps when rapid rate changes
    $effect(() => {
        if (settingsStoreState?.settings.camSettings.rapidRate && planStore) {
            untrack(() => buildAnimationSteps());
        }
    });

    // Initialize simulation data
    function initializeSimulation() {
        if (!planStore.plan.cuts) return;

        buildAnimationSteps();
        resetSimulation();
    }

    // Build animation steps from cuts and rapids
    function buildAnimationSteps() {
        animationSteps = [];
        let currentTime = 0;

        // Reset statistics
        totalCutDistance = 0;
        totalRapidDistance = 0;
        pierceCount = 0;
        estimatedCutTime = 0;

        // Get ordered cuts and extract rapids from them
        const orderedCuts = planStore.plan.cuts
            ? [...planStore.plan.cuts].sort((a, b) => a.order - b.order)
            : [];
        const rapids = orderedCuts
            .map((cut) => cut.rapidIn)
            .filter((rapid) => rapid !== undefined);

        // Count pierces (one per cut)
        pierceCount = orderedCuts.length;

        // Find starting position (first rapid start or first cut start)
        if (rapids.length > 0) {
            toolHeadPosition = { ...rapids[0].start };
        } else if (orderedCuts.length > 0) {
            toolHeadPosition = getCutStartPoint(orderedCuts[0]);
        }

        // Process cuts and rapids in sequence
        // Note: The optimization algorithm generates rapids to connect between cuts
        // Rapids array should have one rapid before each cut (rapids.length == cuts.length)
        for (let i = 0; i < orderedCuts.length; i++) {
            const cut = orderedCuts[i];

            // Add rapid before this cut if it exists
            // Rapids are generated to move from previous position to this cut's start
            if (i < rapids.length) {
                const rapid = rapids[i];
                const rapidDistance = Math.sqrt(
                    Math.pow(rapid.end.x - rapid.start.x, 2) +
                        Math.pow(rapid.end.y - rapid.start.y, 2)
                );
                const rapidRate = getRapidRateForCut(cut); // Get rapid rate from cut's tool

                // Convert rapid distance to display units for time calculation
                const drawingUnits = drawingStore.drawing?.units;
                const rapidDistanceInDisplayUnits =
                    convertDistanceToDisplayUnit(
                        rapidDistance,
                        drawingUnits === 'mm' || drawingUnits === 'inch'
                            ? drawingUnits
                            : 'mm',
                        displayUnit
                    );
                const rapidTime =
                    (rapidDistanceInDisplayUnits / rapidRate) * 60; // Convert to seconds

                // Update statistics (keep in display units)
                totalRapidDistance += rapidDistanceInDisplayUnits;

                animationSteps.push({
                    type: 'rapid',
                    cut: null,
                    rapid,
                    startTime: currentTime,
                    endTime: currentTime + rapidTime,
                    distance: rapidDistance,
                    rapidRate: rapidRate,
                });

                currentTime += rapidTime;
            }

            // Add cut
            let cutTime: number;
            let cutDistanceInDisplayUnits: number;
            let cutDistance: number;

            // Check if this is a spot operation
            if (cut.action === OperationAction.SPOT) {
                // For spot operations, use spotDuration directly (convert ms to seconds)
                // Use DEFAULT_SPOT_DURATION if not specified or 0, matching Operation class behavior
                const spotDurationMs =
                    cut.spotDuration || DEFAULT_SPOT_DURATION;
                cutTime = spotDurationMs / 1000;
                cutDistanceInDisplayUnits = 0; // Spots don't contribute to cut distance
                cutDistance = 0; // Spots have no distance
            } else {
                // For regular cuts, calculate time from distance and feed rate
                cutDistance = getCutDistance(cut);
                const feedRate = getFeedRateForCut(
                    cut,
                    displayUnit,
                    toolStoreState
                ); // Get feed rate from tool

                // Convert cut distance to display units for time calculation
                const drawingUnitsForCut = drawingStore.drawing?.units;
                cutDistanceInDisplayUnits = convertDistanceToDisplayUnit(
                    cutDistance,
                    drawingUnitsForCut === 'mm' || drawingUnitsForCut === 'inch'
                        ? drawingUnitsForCut
                        : 'mm',
                    displayUnit
                );
                cutTime = (cutDistanceInDisplayUnits / feedRate) * 60; // Convert to seconds (feedRate is units/min)
            }

            // Update statistics (keep in display units)
            totalCutDistance += cutDistanceInDisplayUnits;
            estimatedCutTime += cutTime;

            animationSteps.push({
                type: 'cut',
                cut,
                rapid: null,
                startTime: currentTime,
                endTime: currentTime + cutTime,
                distance: cutDistance,
            });

            currentTime += cutTime;
        }

        totalTime = currentTime;
    }

    // Get rapid rate from settings store and convert to display units
    function getRapidRateForCut(_cut: CutData): number {
        if (!settingsStoreState) return 3000; // Fallback

        // Get rapid rate from settings (stored in measurement system units)
        const rapidRateInMeasurementSystemUnits =
            settingsStoreState.settings.camSettings.rapidRate;
        const measurementSystem = settingsStoreState.settings.measurementSystem;

        if (!drawingStore.drawing) return rapidRateInMeasurementSystemUnits;

        const measurementSystemUnit =
            measurementSystem === MeasurementSystem.Metric
                ? Unit.MM
                : Unit.INCH;
        const displayUnitEnum = displayUnit === 'mm' ? Unit.MM : Unit.INCH;

        // If units match, no conversion needed
        if (measurementSystemUnit === displayUnitEnum) {
            return rapidRateInMeasurementSystemUnits;
        }

        // Convert between mm and inch
        if (
            measurementSystemUnit === Unit.MM &&
            displayUnitEnum === Unit.INCH
        ) {
            return rapidRateInMeasurementSystemUnits / 25.4;
        } else if (
            measurementSystemUnit === Unit.INCH &&
            displayUnitEnum === Unit.MM
        ) {
            return rapidRateInMeasurementSystemUnits * 25.4;
        }

        return rapidRateInMeasurementSystemUnits;
    }

    /**
     * Get starting point of a cut, accounting for lead-in and offset.
     * When a cut has calculated offset geometry (from kerf compensation),
     * this function uses the offset shapes instead of the original chain shapes.
     * Falls back to original chain shapes when no offset exists.
     * @param cut - The cut to get the starting point for
     * @returns The starting point coordinates
     */
    function getCutStartPoint(cut: CutData): Point2D {
        // Use execution chain if available (contains shapes in correct execution order)
        let shapes = cut.chain?.shapes;

        // Fallback to offset shapes or original chain for backward compatibility
        if (!shapes) {
            const offsetShapes = cut.offset?.offsetShapes;
            const chainShapes = chains.find(
                (c: ChainData) => c.id === cut.sourceChainId
            )?.shapes;
            if (offsetShapes) {
                shapes = offsetShapes.map((s) => new Shape(s.toData()));
            } else if (chainShapes) {
                shapes = chainShapes.map((s) => new Shape(s));
            }
        }

        if (!shapes || shapes.length === 0) return { x: 0, y: 0 };

        // Check if cut has lead-in
        if (
            cut.leadInConfig?.type &&
            cut.leadInConfig.type !== 'none' &&
            cut.leadInConfig.length &&
            cut.leadInConfig.length > 0
        ) {
            // First try to use cached lead geometry
            if (hasValidCachedLeads(new Cut(cut))) {
                const cached = getCachedLeadGeometry(new Cut(cut));
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
                const drawing = drawingStore.drawing;
                const parts = drawing
                    ? Object.values(drawing.layers).flatMap(
                          (layer) => layer.parts
                      )
                    : [];
                const part = findPartForChain(cut.sourceChainId, parts);

                // Use offset shapes if available
                const chain = chains.find(
                    (c: ChainData) => c.id === cut.sourceChainId
                );
                if (!chain) return { x: 0, y: 0 };

                const chainForLeads = cut.offset
                    ? new Chain({
                          ...chain.toData(),
                          shapes: cut.offset.offsetShapes.map((s) =>
                              s.toData()
                          ),
                      })
                    : chain;

                const leadInConfig: LeadConfig = cut.leadInConfig || {
                    type: LeadType.NONE,
                    length: 0,
                    flipSide: false,
                    angle: 0,
                };
                const leadOutConfig: LeadConfig = cut.leadOutConfig || {
                    type: LeadType.NONE,
                    length: 0,
                    flipSide: false,
                    angle: 0,
                };

                const leadResult = calculateLeads(
                    chainForLeads,
                    leadInConfig,
                    leadOutConfig,
                    cut.direction,
                    part ? new Part(part) : undefined,
                    cut.normal
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
                    'Failed to calculate lead-in for cut:',
                    cut.name,
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

    /**
     * Calculate total distance of a cut, including lead-in and lead-out.
     * Uses offset shapes when available (from kerf compensation),
     * otherwise falls back to original chain shapes.
     * @param cut - The cut to calculate distance for
     * @returns Total cut distance including leads
     */
    function getCutDistance(cut: CutData): number {
        // Use execution chain if available
        let shapes = cut.chain?.shapes;
        const chain = chains.find((c: ChainData) => c.id === cut.sourceChainId);

        // Fallback for backward compatibility
        if (!shapes) {
            if (!chain) return 0;
            const offsetShapes = cut.offset?.offsetShapes;
            if (offsetShapes) {
                shapes = offsetShapes.map((s) => new Shape(s.toData()));
            } else {
                shapes = chain.shapes.map((s) => new Shape(s));
            }
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
                (cut.leadInConfig?.type &&
                    cut.leadInConfig.type !== 'none' &&
                    cut.leadInConfig.length &&
                    cut.leadInConfig.length > 0) ||
                (cut.leadOutConfig?.type &&
                    cut.leadOutConfig.type !== 'none' &&
                    cut.leadOutConfig.length &&
                    cut.leadOutConfig.length > 0)
            ) {
                // First try to use cached lead geometry
                if (hasValidCachedLeads(new Cut(cut))) {
                    const cached = getCachedLeadGeometry(new Cut(cut));
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
                    const drawing = drawingStore.drawing;
                    const parts = drawing
                        ? Object.values(drawing.layers).flatMap(
                              (layer) => layer.parts
                          )
                        : [];
                    const part = findPartForChain(cut.sourceChainId, parts);

                    const leadInConfig: LeadConfig = cut.leadInConfig || {
                        type: LeadType.NONE,
                        length: 0,
                        flipSide: false,
                        angle: 0,
                    };
                    const leadOutConfig: LeadConfig = cut.leadOutConfig || {
                        type: LeadType.NONE,
                        length: 0,
                        flipSide: false,
                        angle: 0,
                    };

                    const chainForLeads: Chain | undefined =
                        cut.offset && chain
                            ? new Chain({
                                  ...chain.toData(),
                                  shapes: cut.offset.offsetShapes.map((s) =>
                                      s.toData()
                                  ),
                              })
                            : chain;

                    if (chainForLeads) {
                        const leadResult = calculateLeads(
                            chainForLeads,
                            leadInConfig,
                            leadOutConfig,
                            cut.direction,
                            part ? new Part(part) : undefined,
                            cut.normal
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
                'Failed to calculate lead distances for cut:',
                cut.name,
                error
            );
        }

        return leadInDistance + chainDistance + leadOutDistance;
    }

    // Reset simulation to beginning
    function resetSimulation() {
        isPlaying = false;
        isPaused = false;
        currentTime = 0;
        currentProgress = 0;
        currentOperation = 'Ready';
        lastFrameTime = 0;
        isTorchOn = false;

        // Reset tool head to starting position
        if (animationSteps.length > 0) {
            const firstStep = animationSteps[0];
            if (firstStep.type === 'rapid' && firstStep.rapid) {
                toolHeadPosition = { ...firstStep.rapid.start };
            } else if (firstStep.type === 'cut' && firstStep.cut) {
                toolHeadPosition = getCutStartPoint(firstStep.cut);
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
            // If simulation is complete, reset before playing
            if (currentTime >= totalTime) {
                resetSimulation();
            }
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
            isTorchOn = false;
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

        if (!currentStep) {
            // No step found, torch should be off
            isTorchOn = false;
            return;
        }

        const stepProgress =
            (currentTime - currentStep.startTime) /
            (currentStep.endTime - currentStep.startTime);

        if (currentStep.type === 'rapid' && currentStep.rapid) {
            const rapidRate = currentStep.rapidRate || 3000;
            currentOperation = `Rapid Movement (${rapidRate} ${displayUnit}/min)`;
            isTorchOn = false; // Torch is off during rapids
            const rapid = currentStep.rapid;
            toolHeadPosition = {
                x: rapid.start.x + (rapid.end.x - rapid.start.x) * stepProgress,
                y: rapid.start.y + (rapid.end.y - rapid.start.y) * stepProgress,
            };
        } else if (currentStep.type === 'cut' && currentStep.cut) {
            // Check if this is a spot operation
            if (currentStep.cut.action === OperationAction.SPOT) {
                const spotDuration =
                    currentStep.cut.spotDuration || DEFAULT_SPOT_DURATION;
                currentOperation = `Spot (${spotDuration}ms)`;
            } else {
                currentOperation = `Cutting (${getFeedRateForCut(currentStep.cut, displayUnit, toolStoreState)} ${displayUnit}/min)`;
            }
            isTorchOn = true; // Torch is on during cutting/spotting
            updateToolHeadOnCut(currentStep.cut, stepProgress);
        }
    }

    /**
     * Update tool head position along a cutting cut, including lead-in and lead-out.
     * This function handles cuts with offset geometry from kerf compensation,
     * automatically using offset shapes when available and falling back to
     * original chain shapes when no offset exists.
     * @param cut - The cut being simulated
     * @param progress - Progress along the cut (0-1)
     */
    function updateToolHeadOnCut(cut: CutData, progress: number) {
        // Special handling for spot operations - stay at the spot point
        if (cut.action === OperationAction.SPOT) {
            // Spot cuts have a cutChain with a single POINT shape at the centroid
            const spotPoint = cut.normalConnectionPoint;
            if (spotPoint) {
                toolHeadPosition = { ...spotPoint };
            }
            return;
        }

        // Use execution chain if available
        let chain: Chain | undefined = cut.chain
            ? new Chain(cut.chain)
            : undefined;
        let shapes = chain?.shapes;

        // Fallback for backward compatibility
        if (!shapes) {
            const chainData = chains.find(
                (c: ChainData) => c.id === cut.sourceChainId
            );
            if (!chainData) return;
            chain = new Chain(chainData);
            const offsetShapes = cut.offset?.offsetShapes;
            if (offsetShapes) {
                shapes = offsetShapes.map((s) => new Shape(s.toData()));
            } else {
                shapes = chainData.shapes.map((s) => new Shape(s));
            }
        }

        if (!shapes || shapes.length === 0) return;

        // Get lead geometry if available
        let leadInGeometry: Point2D[] = [];
        let leadOutGeometry: Point2D[] = [];

        try {
            if (
                (cut.leadInConfig?.type &&
                    cut.leadInConfig.type !== 'none' &&
                    cut.leadInConfig.length &&
                    cut.leadInConfig.length > 0) ||
                (cut.leadOutConfig?.type &&
                    cut.leadOutConfig.type !== 'none' &&
                    cut.leadOutConfig.length &&
                    cut.leadOutConfig.length > 0)
            ) {
                // First try to use cached lead geometry
                if (hasValidCachedLeads(new Cut(cut))) {
                    const cached = getCachedLeadGeometry(new Cut(cut));
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
                    const drawing = drawingStore.drawing;
                    const parts = drawing
                        ? Object.values(drawing.layers).flatMap(
                              (layer) => layer.parts
                          )
                        : [];
                    const part = findPartForChain(cut.sourceChainId, parts);

                    const leadInConfig: LeadConfig = cut.leadInConfig || {
                        type: LeadType.NONE,
                        length: 0,
                        flipSide: false,
                        angle: 0,
                    };
                    const leadOutConfig: LeadConfig = cut.leadOutConfig || {
                        type: LeadType.NONE,
                        length: 0,
                        flipSide: false,
                        angle: 0,
                    };

                    const chainForLeads =
                        cut.offset && chain
                            ? new Chain({
                                  ...chain.toData(),
                                  shapes: cut.offset.offsetShapes.map((s) =>
                                      s.toData()
                                  ),
                              })
                            : chain;

                    if (chainForLeads) {
                        const leadResult = calculateLeads(
                            chainForLeads,
                            leadInConfig,
                            leadOutConfig,
                            cut.direction,
                            part ? new Part(part) : undefined,
                            cut.normal
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
                cut.name,
                error
            );
        }

        // Calculate lengths
        const leadInLength = calculatePolylineLength(leadInGeometry);
        const chainLength =
            chain && shapes
                ? getChainDistance({
                      ...chain.toData(),
                      shapes: shapes.map((s: Shape | ShapeData) =>
                          'toData' in s ? s.toData() : s
                      ),
                  })
                : 0; // Use offset shapes if available
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
                {
                    ...chain.toData(),
                    shapes: shapes.map((s: Shape | ShapeData) =>
                        'toData' in s ? s.toData() : s
                    ),
                },
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

    // Tool head drawing will be added as an overlay to the shared canvas
    // This removes the need for custom drawing functions

    // Load column widths from localStorage on mount
    onMount(() => {
        const savedRightWidth = localStorage.getItem(
            'metalheadcam-simulate-right-column-width'
        );

        if (savedRightWidth) {
            rightColumnWidth = parseInt(savedRightWidth, 10);
        }

        // Initialize simulation
        initializeSimulation();
    });

    onDestroy(() => {
        // Mark component as destroyed
        isDestroyed = true;

        // Cancel animation frame
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
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
                    onclick={playSimulation}
                    disabled={isPlaying && !isPaused}
                >
                    <span>▶️</span> Play
                </button>
                <button
                    class="control-btn"
                    onclick={pauseSimulation}
                    disabled={!isPlaying || isPaused}
                >
                    <span>⏸️</span> Pause
                </button>
                <button
                    class="control-btn"
                    onclick={stopSimulation}
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
        {#if sharedCanvas}
            {@const SharedCanvas = sharedCanvas}
            <SharedCanvas
                currentStage={canvasStage}
                {onChainClick}
                {onPartClick}
            />
        {/if}
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
                <span class="torch-status">
                    Torch: <span
                        class="torch-indicator"
                        class:torch-on={isTorchOn}
                    ></span>
                </span>
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
            onmousedown={handleRightResizeStart}
            onkeydown={handleRightKeydown}
            class:dragging={isDraggingRight}
            aria-label="Resize right panel (Arrow keys to adjust)"
            type="button"
        ></button>
        <SimulatePanel />
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
                <button class="next-button" onclick={handleNext}>
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
        align-items: center;
        margin-bottom: 0.5rem;
        font-size: 0.875rem;
        color: #6b7280;
    }

    .torch-status {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .torch-indicator {
        display: inline-block;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 1px solid #000000;
        background-color: transparent;
        transition: background-color 0.2s ease;
    }

    .torch-indicator.torch-on {
        background-color: #ff0000;
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
