<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { drawingStore } from '$lib/stores/drawing/store';
    import { chainStore } from '$lib/stores/chains/store';
    import { partStore } from '$lib/stores/parts/store';
    import { planStore } from '$lib/stores/plan/store';
    import { cutStore } from '$lib/stores/cuts/store';
    import { operationsStore } from '$lib/stores/operations/store';
    import { tessellationStore } from '$lib/stores/tessellation/store';
    import { overlayStore } from '$lib/stores/overlay/store';
    import { rapidStore } from '$lib/stores/rapids/store';
    import { kerfStore } from '$lib/stores/kerfs/store';
    import { shapeVisualizationStore } from '$lib/stores/shape/store';
    import {
        leadStore,
        selectLead,
        toggleLeadSelection,
        clearLeadHighlight,
        highlightLead,
    } from '$lib/stores/leads/store';
    import { settingsStore } from '$lib/stores/settings/store';
    import { generateChainEndpoints } from '$lib/stores/chains/functions';
    import { generateShapePoints } from '$lib/stores/shape/functions';
    import {
        toggleRapidSelection,
        clearRapidSelection,
        clearRapidHighlight,
    } from '$lib/stores/rapids/functions';
    import {
        getShapeChainId,
        getChainShapeIds,
    } from '$lib/stores/chains/functions';
    import { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
    import type { ShapeData } from '$lib/geometry/shape/interfaces';
    import { WorkflowStage } from '$lib/stores/workflow/enums';
    import { SelectionMode } from '$lib/config/settings/enums';
    import { getPhysicalScaleFactor } from '$lib/config/units/units';
    import { RenderingPipeline } from '$lib/rendering/canvas/pipeline';
    import { HitTestType } from '$lib/rendering/canvas/utils/hit-test';
    import { getCanvasConfigForStage } from '$components/drawing/canvas-config';

    // Properties
    let {
        onChainClick = null,
        onPartClick = null,
        currentStage,
    }: {
        onChainClick?: ((chainId: string) => void) | null;
        onPartClick?: ((partId: string) => void) | null;
        currentStage: WorkflowStage;
    } = $props();

    // Canvas elements are now managed by RenderingPipeline/LayerManager
    let coordinator: CoordinateTransformer;
    // Renderers
    let renderingPipeline: RenderingPipeline = new RenderingPipeline();
    // Canvas Container
    let canvasContainer: HTMLElement;
    let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
    // Track previous mouse position for accurate delta calculation during dragging
    let previousDragPos: { x: number; y: number } | null = null;

    const drawing = $derived($drawingStore.drawing);
    const selectedShapes = $derived($drawingStore.selectedShapes);
    const hoveredShape = $derived($drawingStore.hoveredShape);
    const selectedOffsetShape = $derived($drawingStore.selectedOffsetShape);
    const zoomScale = $derived($drawingStore.scale);
    const panOffset = $derived($drawingStore.offset);
    const displayUnit = $derived($drawingStore.displayUnit);
    const layerVisibility = $derived($drawingStore.layerVisibility);
    const chains = $derived(
        drawing
            ? Object.values(drawing.layers).flatMap((layer) => layer.chains)
            : []
    );
    const selectedChainIds = $derived($chainStore.selectedChainIds);
    const highlightedChainId = $derived($chainStore.highlightedChainId);
    const parts = $derived(
        drawing
            ? Object.values(drawing.layers).flatMap((layer) => layer.parts)
            : []
    );
    const highlightedPartId = $derived($partStore.highlightedPartId);
    const hoveredPartId = $derived($partStore.hoveredPartId);
    const selectedPartIds = $derived($partStore.selectedPartIds);
    const cuts = $derived($planStore.plan.cuts);
    const cutsState = $derived($cutStore);
    const operations = $derived($operationsStore);
    // Only show chains as having cuts if their associated operations are enabled
    const chainsWithCuts = $derived(
        cuts && operations
            ? [
                  ...new Set(
                      cuts
                          .filter((cut) => {
                              // Find the operation for this cut
                              const operation = operations.find(
                                  (op) => op.id === cut.operationId
                              );
                              // Only include cut if operation exists and is enabled
                              return (
                                  operation && operation.enabled && cut.enabled
                              );
                          })
                          .map((c) => c.chainId)
                  ),
              ]
            : []
    );
    const selectedCutIds = $derived(cutsState?.selectedCutIds);
    const highlightedCutId = $derived(cutsState?.highlightedCutId);
    const tessellationState = $derived($tessellationStore);
    const overlayState = $derived($overlayStore);
    const currentOverlay = $derived(overlayState.overlays[currentStage]);
    // Extract rapids from cuts
    const rapids = $derived(
        cuts.map((cut) => cut.rapidIn).filter((rapid) => rapid !== undefined)
    );
    const showRapids = $derived($rapidStore.showRapids);
    const showRapidDirections = $derived($rapidStore.showRapidDirections);
    const selectedRapidIds = $derived($rapidStore.selectedRapidIds);
    const highlightedRapidId = $derived($rapidStore.highlightedRapidId);
    const shapeVisualization = $derived($shapeVisualizationStore);
    const showShapePaths = $derived(shapeVisualization.showShapePaths);
    const showShapeStartPoints = $derived(
        shapeVisualization.showShapeStartPoints
    );
    const showShapeEndPoints = $derived(shapeVisualization.showShapeEndPoints);
    const showShapeNormals = $derived(shapeVisualization.showShapeNormals);
    const showShapeWindingDirection = $derived(
        shapeVisualization.showShapeWindingDirection
    );
    const showShapeTangentLines = $derived(
        shapeVisualization.showShapeTangentLines
    );
    const showShapeTessellation = $derived(
        shapeVisualization.showShapeTessellation
    );
    const chainVisualization = $derived($chainStore);
    const showChainPaths = $derived(chainVisualization.showChainPaths);
    const showChainStartPoints = $derived(
        chainVisualization.showChainStartPoints
    );
    const showChainEndPoints = $derived(chainVisualization.showChainEndPoints);
    const showChainTangentLines = $derived(
        chainVisualization.showChainTangentLines
    );
    const showChainNormals = $derived(chainVisualization.showChainNormals);
    const showChainDirections = $derived(
        chainVisualization.showChainDirections
    );
    const showChainTessellation = $derived(
        chainVisualization.showChainTessellation
    );
    const showCutNormals = $derived(cutsState.showCutNormals);
    const showCutDirections = $derived(cutsState.showCutDirections);
    const showCutPaths = $derived(cutsState.showCutPaths);
    const showCutter = $derived($kerfStore.showCutter);
    const showCutStartPoints = $derived(cutsState.showCutStartPoints);
    const showCutEndPoints = $derived(cutsState.showCutEndPoints);
    const showCutTangentLines = $derived(cutsState.showCutTangentLines);
    const leadState = $derived($leadStore);
    const selectedLeadIds = $derived(leadState.selectedLeadIds);
    const highlightedLeadId = $derived(leadState.highlightedLeadId);
    const leadNormals = $derived(leadState.showLeadNormals);
    const leadPaths = $derived(leadState.showLeadPaths);
    const leadKerfs = $derived(leadState.showLeadKerfs);
    const kerfs = $derived($kerfStore.kerfs);
    const selectedKerfId = $derived($kerfStore.selectedKerfId);
    const highlightedKerfId = $derived($kerfStore.highlightedKerfId);
    const showKerfPaths = $derived($kerfStore.showKerfPaths);
    const selectionMode = $derived($settingsStore.settings.selectionMode);

    // Compute effective interaction mode based on selection mode and current stage
    const interactionMode = $derived.by(() => {
        // If selection mode is explicit (not auto), use it
        if (selectionMode === SelectionMode.Shape) {
            return 'shapes';
        } else if (selectionMode === SelectionMode.Chain) {
            return 'chains';
        } else if (selectionMode === SelectionMode.Part) {
            return 'chains'; // Parts use chain interaction
        } else if (selectionMode === SelectionMode.Cut) {
            return 'cuts';
        } else if (selectionMode === SelectionMode.Lead) {
            return 'leads';
        } else if (selectionMode === SelectionMode.Kerf) {
            return 'kerfs';
        } else if (selectionMode === SelectionMode.Rapid) {
            return 'rapids';
        } else {
            // Auto mode: use stage-based interaction
            switch (currentStage) {
                case WorkflowStage.PREPARE:
                case WorkflowStage.PROGRAM:
                    return 'chains';
                case WorkflowStage.SIMULATE:
                    return 'cuts';
                case WorkflowStage.EDIT:
                default:
                    return 'shapes';
            }
        }
    });

    // Calculate unit scale factor for proper unit display
    const unitScale = $derived(
        drawing ? getPhysicalScaleFactor(drawing.units, displayUnit) : 1
    );

    // Get canvas configuration for current stage
    const canvasConfig = $derived(
        getCanvasConfigForStage(currentStage, {
            onChainClick,
            onPartClick,
        })
    );

    // Universal overlay management - works for all stages
    $effect(() => {
        // This will trigger whenever any of these reactive values change
        const shouldUpdate =
            currentStage &&
            (shapeVisualization || chainVisualization || chains);
        if (shouldUpdate) {
            updateOverlaysForCurrentStage();
        }
    });

    // Universal overlay update function for any stage
    function updateOverlaysForCurrentStage() {
        if (!currentStage) return;

        // Handle shape points
        if (drawing && drawing.shapes) {
            const allShapes = drawing.shapes;
            const allShapePoints = generateShapePoints(
                allShapes,
                new Set(allShapes.map((s) => s.id))
            );
            let filteredShapePoints: typeof allShapePoints = [];

            if (
                shapeVisualization.showShapeStartPoints ||
                shapeVisualization.showShapeEndPoints
            ) {
                filteredShapePoints = allShapePoints.filter((point) => {
                    if (
                        point.type === 'start' &&
                        shapeVisualization.showShapeStartPoints
                    ) {
                        return true;
                    }
                    if (
                        point.type === 'end' &&
                        shapeVisualization.showShapeEndPoints
                    ) {
                        return true;
                    }
                    return false;
                });
            }

            overlayStore.setShapePoints(currentStage, filteredShapePoints);
        } else {
            overlayStore.clearShapePoints(currentStage);
        }

        // Handle chain endpoints
        if (chains.length > 0) {
            const allEndpoints = generateChainEndpoints(chains);
            let filteredEndpoints: typeof allEndpoints = [];

            if (
                chainVisualization.showChainStartPoints ||
                chainVisualization.showChainEndPoints
            ) {
                filteredEndpoints = allEndpoints.filter(
                    (
                        endpoint: import('$lib/stores/overlay/interfaces').ChainEndpoint
                    ) => {
                        if (
                            endpoint.type === 'start' &&
                            chainVisualization.showChainStartPoints
                        ) {
                            return true;
                        }
                        if (
                            endpoint.type === 'end' &&
                            chainVisualization.showChainEndPoints
                        ) {
                            return true;
                        }
                        return false;
                    }
                );
            }

            overlayStore.setChainEndpoints(currentStage, filteredEndpoints);
        } else {
            overlayStore.clearChainEndpoints(currentStage);
        }
    }

    // Update coordinate transformer when parameters change
    $effect(() => {
        if (coordinator) {
            coordinator.updateTransform(zoomScale, panOffset, unitScale);
        }
    });

    // Track offset calculation state changes
    const offsetCalculationHash = $derived(
        cuts && cuts.length > 0
            ? cuts
                  .map((cut) => ({
                      id: cut.id,
                      hasOffset: !!cut.offset,
                      offsetHash: cut.offset
                          ? JSON.stringify(
                                cut.offset.offsetShapes?.map(
                                    (s: ShapeData) => s.id
                                ) || []
                            )
                          : null,
                  }))
                  .join('|')
            : ''
    );

    // Geometry changes (shapes, drawing structure)
    $effect(() => {
        if (drawing) {
            renderingPipeline.updateState({
                drawing: drawing,
                selectionMode: selectionMode,
            });
        }
    });

    // Transform changes (pan, zoom, units)
    $effect(() => {
        if (
            zoomScale !== undefined &&
            panOffset !== undefined &&
            displayUnit !== undefined
        ) {
            renderingPipeline.updateState({
                transform: {
                    zoomScale: zoomScale,
                    panOffset: panOffset,
                    unitScale: unitScale,
                    coordinator: coordinator,
                },
            });
        }
    });

    // Selection, hover, and visibility changes
    // Reactive to all these values to trigger updates when any change
    $effect(() => {
        if (renderingPipeline) {
            renderingPipeline.updateState({
                selection: {
                    selectedShapes,
                    selectedChainIds,
                    highlightedChainId,
                    highlightedPartId,
                    selectedPartIds,
                    selectedCutIds: selectedCutIds,
                    highlightedCutId: highlightedCutId,
                    selectedRapidIds,
                    highlightedRapidId,
                    selectedLeadIds,
                    highlightedLeadId,
                    selectedKerfId,
                    highlightedKerfId,
                    selectedOffsetShape,
                    hoveredPartId,
                    hoveredShape,
                },
                visibility: {
                    layerVisibility: layerVisibility || {},
                    showRapids,
                    showRapidDirections,
                    showCuts: true,
                    showChains: true,
                    showParts: true,
                    showOverlays: true,
                    showShapePaths,
                    showShapeStartPoints,
                    showShapeEndPoints,
                    showShapeNormals,
                    showShapeWindingDirection,
                    showShapeTangentLines,
                    showShapeTessellation,
                    showChainPaths,
                    showChainStartPoints,
                    showChainEndPoints,
                    showChainTangentLines,
                    showChainNormals,
                    showChainDirections,
                    showChainTessellation,
                    showCutNormals,
                    showCutDirections,
                    showCutPaths,
                    showCutter,
                    showCutStartPoints,
                    showCutEndPoints,
                    showCutTangentLines,
                    showLeadNormals: leadNormals,
                    showLeadPaths: leadPaths,
                    showLeadKerfs: leadKerfs,
                    showKerfPaths,
                },
                respectLayerVisibility: canvasConfig.respectLayerVisibility,
            });
        }
    });

    // Cut and operation changes
    $effect(() => {
        if (cuts || cutsState || operations || offsetCalculationHash) {
            renderingPipeline.updateState({
                cuts: cuts || [],
                cutsState: cutsState,
                operations: operations,
                chainsWithCuts: chainsWithCuts,
            });
        }
    });

    // Overlay and stage changes
    $effect(() => {
        if (
            tessellationState !== undefined ||
            currentOverlay !== undefined ||
            currentStage !== undefined
        ) {
            renderingPipeline.updateState({
                overlays: overlayState?.overlays || {},
                currentOverlay: currentOverlay,
                stage: currentStage,
            });
        }
    });

    // Chains and parts data changes
    $effect(() => {
        if (chains || parts) {
            renderingPipeline.updateState({
                chains: chains || [],
                parts: parts || [],
            });
        }
    });

    // Rapids data changes
    $effect(() => {
        if (rapids !== undefined) {
            renderingPipeline.updateState({
                rapids: rapids || [],
            });
        }
    });

    // Kerfs data changes
    $effect(() => {
        if (kerfs !== undefined) {
            renderingPipeline.updateState({
                kerfs: kerfs || [],
            });
        }
    });

    onMount(() => {
        // Get container dimensions
        const rect = canvasContainer.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        // Update drawing store with canvas dimensions
        drawingStore.setCanvasDimensions(width, height);

        // Initialize rendering pipeline with multi-canvas support
        renderingPipeline.initialize(canvasContainer, width, height, {
            zoomScale,
            panOffset,
            unitScale,
        });

        // Get coordinate transformer from pipeline
        const newCoordinator = renderingPipeline.getCoordinator();
        if (newCoordinator) {
            coordinator = newCoordinator;
        }

        // Set up interaction callbacks instead of direct event listeners
        renderingPipeline.setInteractionCallbacks({
            onMouseDown: handleMouseDown,
            onMouseMove: handleMouseMove,
            onMouseUp: handleMouseUp,
            onMouseLeave: handleMouseUp,
            onWheel: handleWheel,
            onKeyDown: handleKeyDown,
            onContextMenu: handleContextMenu,
        });
    });

    onDestroy(() => {
        if (hoverTimeout !== null) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
        // Clean up rendering pipeline
        renderingPipeline.destroy();
    });

    //
    // Event handlers
    //

    function handleMouseDown(e: MouseEvent) {
        const interactionState = renderingPipeline.getInteractionState();
        if (!interactionState) return;

        // Use the actual event position for accurate hit testing
        const screenClickPos = { x: e.offsetX, y: e.offsetY };

        // Initialize drag tracking for panning
        if (e.button === 1 || e.button === 2) {
            previousDragPos = { x: e.offsetX, y: e.offsetY };
        }

        // Only handle shape selection with left mouse button
        if (e.button === 0) {
            // Use unified hit detection from rendering pipeline with actual click position
            const hitResult = renderingPipeline.hitScreen(screenClickPos);
            let shape = null;

            if (hitResult) {
                switch (hitResult.type) {
                    case HitTestType.RAPID:
                        // Handle rapid selection (allow in chains, rapids, and cuts modes)
                        if (
                            interactionMode === 'rapids' ||
                            interactionMode === 'cuts' ||
                            interactionMode === 'chains'
                        ) {
                            toggleRapidSelection(hitResult.id);
                            return; // Don't process other selections
                        }
                        break;

                    case HitTestType.SHAPE:
                        const metadata = hitResult.metadata;
                        shape = metadata?.shape;
                        break;

                    case HitTestType.CHAIN:
                        // Handle chain selection directly
                        if (interactionMode === 'chains' && onChainClick) {
                            const chainId = hitResult.id;

                            // Get all shapes in the chain
                            const chainShapeIds =
                                chains
                                    .find((c) => c.id === chainId)
                                    ?.shapes.map((s) => s.id) || [];

                            // Check if this chain is already selected
                            const chainAlreadySelected =
                                selectedChainIds.has(chainId);

                            if (e.ctrlKey || e.metaKey) {
                                // Multi-select mode: toggle chain selection
                                if (chainAlreadySelected) {
                                    chainStore.deselectChain(chainId);
                                    // Deselect shapes in this chain
                                    chainShapeIds.forEach((id: string) => {
                                        drawingStore.deselectShape(id);
                                    });
                                } else {
                                    chainStore.selectChain(chainId, true);
                                    // Select shapes in this chain
                                    chainShapeIds.forEach((id: string) => {
                                        drawingStore.selectShape(id, true);
                                    });
                                }
                            } else {
                                // Single select mode: clear others and select this one
                                drawingStore.clearSelection();
                                chainStore.selectChain(chainId, false);
                                // Select all shapes in the chain
                                chainShapeIds.forEach((id: string) => {
                                    drawingStore.selectShape(id, true);
                                });
                            }

                            // Call the callback
                            onChainClick(chainId);
                            return;
                        }
                        break;

                    case HitTestType.PART:
                        // Handle part selection in Program stage
                        if (interactionMode === 'chains' && onPartClick) {
                            const partId = hitResult.id;
                            const partAlreadySelected =
                                selectedPartIds.has(partId);

                            if (e.ctrlKey || e.metaKey) {
                                // Multi-select mode: toggle part selection
                                if (partAlreadySelected) {
                                    partStore.deselectPart(partId);
                                } else {
                                    partStore.selectPart(partId, true);
                                }
                            } else {
                                // Single select mode: clear others and select this one
                                if (!partAlreadySelected) {
                                    drawingStore.clearSelection();
                                    partStore.selectPart(partId, false);
                                }
                            }

                            // Call the external callback
                            onPartClick(partId);
                            return;
                        }
                        break;

                    case HitTestType.CUT:
                        // Handle cut endpoint selection
                        if (interactionMode === 'cuts') {
                            const cutId = hitResult.id;
                            const cutAlreadySelected =
                                selectedCutIds.has(cutId);

                            if (e.ctrlKey || e.metaKey) {
                                // Multi-select mode: toggle cut selection
                                cutStore.toggleCutSelection(cutId);
                            } else {
                                // Single select mode
                                if (cutAlreadySelected) {
                                    cutStore.selectCut(null); // Deselect if already selected
                                } else {
                                    cutStore.selectCut(cutId, false); // Clear others and select this one
                                }
                            }
                            return;
                        }
                        break;

                    case HitTestType.LEAD:
                        // Handle lead selection (allow in chains, leads, and cuts modes)
                        if (
                            interactionMode === 'leads' ||
                            interactionMode === 'cuts' ||
                            interactionMode === 'chains'
                        ) {
                            const leadId = hitResult.id;
                            const leadAlreadySelected =
                                selectedLeadIds.has(leadId);

                            if (e.ctrlKey || e.metaKey) {
                                // Multi-select mode: toggle lead selection
                                toggleLeadSelection(leadId);
                            } else {
                                // Single select mode
                                if (leadAlreadySelected) {
                                    selectLead(null); // Deselect if already selected
                                } else {
                                    selectLead(leadId, false); // Clear others and select this one
                                }
                            }
                            return;
                        }
                        break;

                    case HitTestType.KERF:
                        // Handle kerf selection
                        if (interactionMode === 'kerfs') {
                            const kerfId = hitResult.id;
                            // Clear other selections
                            cutStore.selectCut(null);
                            selectLead(null);
                            chainStore.selectChain(null);
                            partStore.selectPart(null);
                            drawingStore.clearSelection();
                            // Toggle kerf selection
                            if (selectedKerfId === kerfId) {
                                kerfStore.selectKerf(null); // Deselect if already selected
                            } else {
                                kerfStore.selectKerf(kerfId);
                            }
                            return;
                        }
                        break;
                }
            } else {
                // Clear selections when clicking on empty area
                if (
                    interactionMode === 'chains' &&
                    currentStage === 'program'
                ) {
                    drawingStore.clearOffsetShapeSelection();
                }
                shape = null;
            }

            if (shape) {
                if (interactionMode === 'shapes') {
                    // Edit mode - allow individual shape selection
                    if (!e.ctrlKey && !selectedShapes.has(shape.id)) {
                        drawingStore.clearSelection();
                    }
                    drawingStore.selectShape(shape, e.ctrlKey);
                } else if (interactionMode === 'chains') {
                    // Program mode - allow chain and part selection
                    const chainId = getShapeChainId(shape.id, chains, cuts);
                    if (chainId) {
                        // When clicking on a shape outline, always prefer chain selection
                        if (onChainClick) {
                            // Handle chain click
                            // Get all shapes in the chain
                            const chainShapeIds = getChainShapeIds(
                                shape.id,
                                chains
                            );

                            // Check if this chain is already selected
                            const chainAlreadySelected =
                                selectedChainIds.has(chainId);

                            if (e.ctrlKey || e.metaKey) {
                                // Multi-select mode: toggle chain selection
                                if (chainAlreadySelected) {
                                    chainStore.deselectChain(chainId);
                                    // Deselect shapes in this chain
                                    chainShapeIds.forEach((id) => {
                                        drawingStore.deselectShape(id);
                                    });
                                } else {
                                    chainStore.selectChain(chainId, true);
                                    // Select shapes in this chain
                                    chainShapeIds.forEach((id) => {
                                        drawingStore.selectShape(id, true);
                                    });
                                }
                            } else {
                                // Single select mode: clear others and select this one
                                drawingStore.clearSelection();
                                chainStore.selectChain(chainId, false);
                                // Select all shapes in the chain
                                chainShapeIds.forEach((id) => {
                                    drawingStore.selectShape(id, true);
                                });
                            }

                            onChainClick(chainId);
                        }
                    }
                } else if (interactionMode === 'cuts') {
                    // Simulation mode - only allow cut/rapid selection
                    const chainId = getShapeChainId(shape.id, chains, cuts);

                    // Check if this chain has a cut and handle cut selection
                    if (chainId && chainsWithCuts.includes(chainId)) {
                        // Find the cut for this chain
                        const cutForChain = cuts.find(
                            (c) => c.chainId === chainId
                        );
                        if (cutForChain) {
                            // Handle cut selection - don't select individual shapes
                            const cutAlreadySelected = selectedCutIds.has(
                                cutForChain.id
                            );

                            if (e.ctrlKey || e.metaKey) {
                                // Multi-select mode: toggle cut selection
                                cutStore.toggleCutSelection(cutForChain.id);
                            } else {
                                // Single select mode
                                if (cutAlreadySelected) {
                                    cutStore.selectCut(null); // Deselect if already selected
                                } else {
                                    cutStore.selectCut(cutForChain.id, false); // Clear others and select this one
                                }
                            }
                        }
                    }
                    // Don't select individual shapes in cuts mode
                }
            } else {
                // Clicked in empty space - check for part selection in Program stage
                if (interactionMode === 'chains' && onPartClick) {
                    // Part hit detection is already handled above in unified hit detection
                    // If we reach here, no part was hit
                }

                if (!e.ctrlKey) {
                    // Clear all selections when clicking in empty space
                    drawingStore.clearSelection();
                    chainStore.clearChainSelection();
                    partStore.clearHighlight();
                    partStore.selectPart(null);
                    cutStore.selectCut(null);
                    cutStore.clearHighlight();
                    clearRapidSelection();
                    clearRapidHighlight();
                    selectLead(null);
                    clearLeadHighlight();
                }
            }
        }
    }

    function handleMouseMove(e: MouseEvent) {
        const interactionState = renderingPipeline.getInteractionState();
        if (!interactionState) return;

        const { mousePos, isMouseDown, dragStart, mouseButton } =
            interactionState;
        const newMousePos = { x: e.offsetX, y: e.offsetY };

        if (isMouseDown && dragStart) {
            if (mouseButton === 0 && selectedShapes.size > 0) {
                // Move selected shapes with left mouse button
                const worldDelta = {
                    x: coordinator.screenToWorldDistance(
                        newMousePos.x - mousePos.x
                    ),
                    y: -coordinator.screenToWorldDistance(
                        newMousePos.y - mousePos.y
                    ),
                };

                drawingStore.moveShapes(Array.from(selectedShapes), worldDelta);
            } else if (mouseButton === 1 || mouseButton === 2) {
                // Pan view with middle or right mouse button
                // Use the tracked previous position for accurate delta calculation
                if (previousDragPos) {
                    const delta = {
                        x: newMousePos.x - previousDragPos.x,
                        y: newMousePos.y - previousDragPos.y,
                    };

                    const newPanOffset = {
                        x: panOffset.x + delta.x,
                        y: panOffset.y + delta.y,
                    };

                    drawingStore.setViewTransform(zoomScale, newPanOffset);

                    // Update previous position for next move event
                    previousDragPos = { x: newMousePos.x, y: newMousePos.y };
                }
            }
        } else {
            // Throttle hover detection to improve performance
            if (hoverTimeout !== null) {
                clearTimeout(hoverTimeout);
            }

            hoverTimeout = setTimeout(() => {
                // Handle hover detection when not dragging
                const hitResult = renderingPipeline.hitScreen(newMousePos);

                let hoveredShapeId = null;
                let hoveredChainId: string | null = null;
                let hoveredPartId: string | null = null;
                let hoveredCutId: string | null = null;
                let hoveredRapidId: string | null = null;
                let hoveredLeadId: string | null = null;
                let hoveredKerfId: string | null = null;

                if (hitResult) {
                    if (hitResult.type === HitTestType.CHAIN) {
                        // Direct chain hit - only allow if in chains mode
                        if (interactionMode === 'chains') {
                            hoveredChainId = hitResult.id;
                        }
                    } else if (hitResult.type === HitTestType.PART) {
                        // Direct part hit - only allow if in chains mode (parts use chain interaction)
                        if (interactionMode === 'chains') {
                            hoveredPartId = hitResult.id;
                        }
                    } else if (hitResult.type === HitTestType.CUT) {
                        // Direct cut hit - only allow if in cuts mode
                        if (interactionMode === 'cuts') {
                            hoveredCutId = hitResult.id;
                        }
                    } else if (hitResult.type === HitTestType.RAPID) {
                        // Direct rapid hit - allow in chains, rapids, and cuts modes
                        if (
                            interactionMode === 'rapids' ||
                            interactionMode === 'cuts' ||
                            interactionMode === 'chains'
                        ) {
                            hoveredRapidId = hitResult.id;
                        }
                    } else if (hitResult.type === HitTestType.LEAD) {
                        // Direct lead hit - allow in chains, leads, and cuts modes
                        if (
                            interactionMode === 'leads' ||
                            interactionMode === 'cuts' ||
                            interactionMode === 'chains'
                        ) {
                            hoveredLeadId = hitResult.id;
                        }
                    } else if (hitResult.type === HitTestType.KERF) {
                        // Direct kerf hit - only allow if in kerfs mode
                        if (interactionMode === 'kerfs') {
                            hoveredKerfId = hitResult.id;
                        }
                    } else if (hitResult.type === HitTestType.SHAPE) {
                        const metadata = hitResult.metadata;
                        const shape = metadata?.shape;
                        if (shape) {
                            // Filter hover based on selection mode
                            const allowHover =
                                selectionMode === 'auto' ||
                                selectionMode === 'shape';
                            if (allowHover) {
                                if (interactionMode === 'shapes') {
                                    // Edit mode - show hover for individual shapes
                                    hoveredShapeId = shape.id;
                                } else if (interactionMode === 'chains') {
                                    // Program mode - show hover for chains
                                    hoveredShapeId = shape.id;
                                    // Also highlight the chain this shape belongs to
                                    hoveredChainId = getShapeChainId(
                                        shape.id,
                                        chains
                                    );
                                } else if (interactionMode === 'cuts') {
                                    // Simulation mode - only hover shapes that are part of selectable cuts
                                    const chainId = getShapeChainId(
                                        shape.id,
                                        chains
                                    );
                                    if (
                                        chainId &&
                                        chainsWithCuts.includes(chainId)
                                    ) {
                                        hoveredShapeId = shape.id;
                                    }
                                }
                            }
                        }
                    }
                }

                drawingStore.setHoveredShape(hoveredShapeId);

                // Update chain highlight
                if (hoveredChainId !== highlightedChainId) {
                    chainStore.highlightChain(hoveredChainId);
                }

                // Update part hover/highlight
                if (hoveredPartId !== $partStore.hoveredPartId) {
                    partStore.hoverPart(hoveredPartId);
                }

                // Update cut highlight
                if (hoveredCutId !== highlightedCutId) {
                    cutStore.highlightCut(hoveredCutId);
                }

                // Update rapid highlight
                if (hoveredRapidId !== highlightedRapidId) {
                    rapidStore.highlightRapid(hoveredRapidId);
                }

                // Update lead highlight
                if (hoveredLeadId !== highlightedLeadId) {
                    highlightLead(hoveredLeadId);
                }

                // Update kerf highlight
                if (hoveredKerfId !== highlightedKerfId) {
                    kerfStore.setHighlightedKerf(hoveredKerfId);
                }

                hoverTimeout = null;
            }, 16); // ~60fps throttling (16ms)
        }
    }

    function handleMouseUp() {
        // InteractionManager handles the state, no need to manage it here
        // Clear drag tracking
        previousDragPos = null;
    }

    function handleWheel(e: globalThis.WheelEvent) {
        e.preventDefault();

        const interactionState = renderingPipeline.getInteractionState();
        if (!interactionState) return;

        const { mousePos } = interactionState;

        // Calculate new scale in 5% increments
        const currentPercent = Math.round(zoomScale * 100);
        const increment = e.deltaY > 0 ? -5 : 5;
        const newPercent = Math.max(5, currentPercent + increment); // Minimum 5% zoom
        const newZoomScale = newPercent / 100;

        // Zoom towards mouse position using coordinate transformer
        const newPanOffset = coordinator.calculateZoomOffset(
            mousePos,
            zoomScale,
            newZoomScale
        );

        drawingStore.setViewTransform(newZoomScale, newPanOffset);
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Delete' && selectedShapes.size > 0) {
            drawingStore.deleteSelected();
        }
    }

    function handleContextMenu(e: MouseEvent) {
        // Prevent browser context menu when right-clicking for drag operations
        e.preventDefault();
    }
</script>

<div
    bind:this={canvasContainer}
    class="canvas-container"
    role="img"
    aria-label="Drawing Canvas - Interactive CAD Drawing View"
></div>

<style>
    .canvas-container {
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
        cursor: crosshair;
        outline: none;
    }

    .canvas-container:active {
        cursor: move;
    }

    /* Multi-layer canvas styling - handled by Layer class */
    :global(.canvas-container canvas) {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none; /* Only interaction layer should receive events */
    }

    /* Allow pointer events only on interaction layer */
    :global(.canvas-container canvas[data-layer-id='interaction']) {
        pointer-events: auto;
        outline: none; /* Remove focus outline since layer is transparent */
    }
</style>
