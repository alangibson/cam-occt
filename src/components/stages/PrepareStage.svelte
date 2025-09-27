<script lang="ts">
    import { detectShapeChains } from '$lib/algorithms/chain-detection/chain-detection';
    import {
        analyzeChainTraversal,
        normalizeChain,
    } from '$lib/algorithms/chain-normalization/chain-normalization';
    import { detectCutDirection } from '$lib/algorithms/cut-direction/cut-direction';
    import { decomposePolylines } from '$lib/algorithms/decompose-polylines/decompose-polylines';
    import { joinColinearLines } from '$lib/algorithms/join-colinear-lines';
    import { optimizeStartPoints } from '$lib/algorithms/optimize-start-points/optimize-start-points';
    import {
        detectParts,
        type PartDetectionWarning,
    } from '$lib/algorithms/part-detection/part-detection';
    import { translateToPositiveQuadrant } from '$lib/algorithms/translate-to-positive/translate-to-positive';
    import { isChainClosed } from '$lib/geometry/chain/functions';
    import { tessellateShape } from '$lib/geometry/shape';
    import {
        getShapeEndPoint,
        getShapeStartPoint,
    } from '$lib/geometry/shape/functions';
    import { chainStore } from '$lib/stores/chains/store';
    import { drawingStore } from '$lib/stores/drawing/store';
    import { overlayStore } from '$lib/stores/overlay/store';
    import { generateChainEndpoints } from '$lib/stores/overlay/functions';
    import { partStore } from '$lib/stores/parts/store';
    import { prepareStageStore } from '$lib/stores/prepare-stage/store';
    import { tessellationStore } from '$lib/stores/tessellation/store';
    import type { TessellationPoint } from '$lib/stores/tessellation/interfaces';
    import { workflowStore } from '$lib/stores/workflow/store';
    import { WorkflowStage } from '$lib/stores/workflow/enums';
    import { CutDirection } from '$lib/types/direction';
    import AccordionPanel from '../AccordionPanel.svelte';
    import LayersInfo from '../LayersInfo.svelte';
    import DrawingCanvasContainer from '../DrawingCanvasContainer.svelte';
    import type { Chain } from '$lib/geometry/chain/interfaces';

    // Props from WorkflowContainer for shared canvas
    export let sharedCanvas: typeof DrawingCanvasContainer;
    export let canvasStage: WorkflowStage;
    export let interactionMode: 'shapes' | 'chains' | 'paths';
    export let onChainClick: ((chainId: string) => void) | null = null;
    export let onPartClick: ((partId: string) => void) | null = null;
    export let onChainHover: ((chainId: string) => void) | null = null;
    export let onChainHoverEnd: (() => void) | null = null;
    export let onPartHover: ((partId: string) => void) | null = null;
    export let onPartHoverEnd: (() => void) | null = null;

    // Resizable columns state - initialize from store, update local variables during drag
    let leftColumnWidth = $prepareStageStore.leftColumnWidth;
    let rightColumnWidth = $prepareStageStore.rightColumnWidth;
    let isDraggingLeft = false;
    let isDraggingRight = false;
    let startX = 0;
    let startWidth = 0;

    // Chain detection parameters
    let isDetectingChains = false;
    let isDetectingParts = false;
    let isNormalizing = false;
    let isOptimizingStarts = false;

    // Algorithm parameters - use store for persistence
    $: algorithmParams = $prepareStageStore.algorithmParams;

    // Helper functions to update algorithm parameters
    function updateJoinColinearLinesTolerance(value: number) {
        prepareStageStore.updateAlgorithmParam('joinColinearLines', {
            tolerance: value,
        });
    }

    function updateChainDetectionTolerance(value: number) {
        prepareStageStore.updateAlgorithmParam('chainDetection', {
            tolerance: value,
        });
    }

    function _updateNormalizationTolerance(value: number) {
        prepareStageStore.updateAlgorithmParam('chainNormalization', {
            traversalTolerance: value,
        });
    }

    function _updateNormalizationGap(value: number) {
        prepareStageStore.updateAlgorithmParam('chainNormalization', {
            maxTraversalAttempts: value,
        });
    }

    function _updateStartPointOptimizationEnabled(_value: boolean) {
        // This function is not used anymore as splitPosition is a string, not boolean
        // Keeping for compatibility but will be removed later
    }

    function _updateStartPointOptimizationDistance(value: number) {
        prepareStageStore.updateAlgorithmParam('startPointOptimization', {
            tolerance: value,
        });
    }

    function _updatePartDetectionTolerance(_value: number) {
        // Part detection doesn't have a tolerance parameter
        // This function should not be used
    }

    function updateTessellationCirclePoints(value: number) {
        prepareStageStore.updateAlgorithmParam('partDetection', {
            circleTessellationPoints: value,
        });
    }

    function updateTessellationMinArcPoints(value: number) {
        prepareStageStore.updateAlgorithmParam('partDetection', {
            minArcTessellationPoints: value,
        });
    }

    function updateTessellationArcPrecision(value: number) {
        prepareStageStore.updateAlgorithmParam('partDetection', {
            arcTessellationDensity: value,
        });
    }

    function updateNormalizationTraversalTolerance(value: number) {
        prepareStageStore.updateAlgorithmParam('chainNormalization', {
            traversalTolerance: value,
        });
    }

    function updateNormalizationMaxAttempts(value: number) {
        prepareStageStore.updateAlgorithmParam('chainNormalization', {
            maxTraversalAttempts: value,
        });
    }

    function updateStartPointOptimizationSplitPosition(value: string) {
        prepareStageStore.updateAlgorithmParam('startPointOptimization', {
            splitPosition: value as 'midpoint',
        });
    }

    function updateStartPointOptimizationTolerance(value: number) {
        prepareStageStore.updateAlgorithmParam('startPointOptimization', {
            tolerance: value,
        });
    }

    function updatePartDetectionDecimalPrecision(value: number) {
        prepareStageStore.updateAlgorithmParam('partDetection', {
            decimalPrecision: value,
        });
    }

    function updatePartDetectionTessellationEnabled(value: boolean) {
        prepareStageStore.updateAlgorithmParam('partDetection', {
            enableTessellation: value,
        });
    }

    // Reactive chain and part data
    $: detectedChains = $chainStore.chains;
    $: detectedParts = $partStore.parts;
    $: partWarnings = $partStore.warnings;

    // Update Prepare stage overlay when chains are detected (but not during normalization, and only when on prepare stage)
    $: if (
        $workflowStore.currentStage === WorkflowStage.PREPARE &&
        !isNormalizing &&
        detectedChains.length > 0
    ) {
        updateChainOverlays(detectedChains);
    } else if (
        $workflowStore.currentStage === WorkflowStage.PREPARE &&
        !isNormalizing
    ) {
        overlayStore.clearChainEndpoints(WorkflowStage.PREPARE);
    }

    // Update Prepare stage overlay when tessellation changes (only when on prepare stage)
    $: if (
        $workflowStore.currentStage === WorkflowStage.PREPARE &&
        $tessellationStore.isActive &&
        $tessellationStore.points.length > 0
    ) {
        // Convert tessellation store points to overlay format
        const tessellationPoints = $tessellationStore.points.map((point) => ({
            x: point.x,
            y: point.y,
            shapeId: point.shapeId, // Use existing shapeId from tessellation store
            chainId: point.chainId,
        }));
        overlayStore.setTessellationPoints(
            WorkflowStage.PREPARE,
            tessellationPoints
        );
    } else if ($workflowStore.currentStage === WorkflowStage.PREPARE) {
        overlayStore.clearTessellationPoints(WorkflowStage.PREPARE);
    }

    // Chain normalization analysis - use store for persistence
    $: chainNormalizationResults = $prepareStageStore.chainNormalizationResults;

    // Helper function to update overlays based on visualization preferences
    function updateChainOverlays(chains: Chain[]) {
        if ($workflowStore.currentStage !== WorkflowStage.PREPARE) return;

        // Generate and filter chain endpoints
        const allEndpoints = generateChainEndpoints(chains);
        let filteredEndpoints: typeof allEndpoints = [];

        if (
            $prepareStageStore.showChainStartPoints ||
            $prepareStageStore.showChainEndPoints
        ) {
            filteredEndpoints = allEndpoints.filter((endpoint) => {
                if (
                    endpoint.type === 'start' &&
                    $prepareStageStore.showChainStartPoints
                ) {
                    return true;
                }
                if (
                    endpoint.type === 'end' &&
                    $prepareStageStore.showChainEndPoints
                ) {
                    return true;
                }
                return false;
            });
        }

        overlayStore.setChainEndpoints(
            WorkflowStage.PREPARE,
            filteredEndpoints
        );
        // Tangent lines are now handled by the ChainRenderer
    }

    // Chain selection state
    $: selectedChainId = $chainStore.selectedChainId;
    $: highlightedChainId = $chainStore.highlightedChainId;
    $: hoveredPartId = $partStore.hoveredPartId;
    $: selectedPartId = $partStore.selectedPartId;
    $: selectedChain = selectedChainId
        ? detectedChains.find((chain) => chain.id === selectedChainId)
        : null;
    $: selectedChainAnalysis = selectedChainId
        ? chainNormalizationResults.find(
              (result) => result.chainId === selectedChainId
          )
        : null;

    // Tessellation state

    // Chain detection state
    $: chainsDetected = detectedChains.length > 0;

    // Normalization state - check if original state exists AND chains are detected
    $: normalizationApplied =
        chainsDetected &&
        $prepareStageStore.originalShapesBeforeNormalization !== null &&
        $prepareStageStore.originalChainsBeforeNormalization !== null;

    // Optimization state - check if original state exists AND chains are detected
    $: optimizationApplied =
        chainsDetected &&
        $prepareStageStore.originalShapesBeforeOptimization !== null &&
        $prepareStageStore.originalChainsBeforeOptimization !== null;

    // Parts detection state - use store flag AND chains must be detected
    $: partsDetectionApplied =
        chainsDetected && $prepareStageStore.partsDetected;

    // Auto-analyze chains for traversal issues when chains change
    $: {
        if (detectedChains.length > 0) {
            const newResults = analyzeChainTraversal(
                detectedChains,
                algorithmParams.chainNormalization
            );
            prepareStageStore.setChainNormalizationResults(newResults);
        } else {
            prepareStageStore.clearChainNormalizationResults();
            chainStore.selectChain(null);
        }
    }

    // Update overlays when visibility settings change
    $: if (
        $workflowStore.currentStage === WorkflowStage.PREPARE &&
        detectedChains.length > 0 &&
        ($prepareStageStore.showChainStartPoints !== undefined ||
            $prepareStageStore.showChainEndPoints !== undefined ||
            $prepareStageStore.showChainTangentLines !== undefined)
    ) {
        updateChainOverlays(detectedChains);
    }

    // Collect all issues from chain normalization
    $: chainTraversalIssues = chainNormalizationResults.flatMap((result) =>
        result.issues.map((issue) => ({
            ...issue,
            chainCanTraverse: result.canTraverse,
            chainDescription: result.description,
        }))
    );

    function handleNext() {
        workflowStore.completeStage(WorkflowStage.PREPARE);
        workflowStore.setStage(WorkflowStage.PROGRAM);
    }

    function handleDetectChains() {
        if (chainsDetected && !isDetectingChains) {
            // Restore drawing to the earliest saved state
            // Priority: normalization first (if available), then optimization, then current state
            if ($prepareStageStore.originalShapesBeforeNormalization !== null) {
                const originalState =
                    prepareStageStore.restoreOriginalStateFromNormalization();
                if (originalState) {
                    drawingStore.replaceAllShapes(originalState.shapes);
                    console.log(
                        'Restored drawing to state before normalization'
                    );
                }
            } else if (
                $prepareStageStore.originalShapesBeforeOptimization !== null
            ) {
                const originalState =
                    prepareStageStore.restoreOriginalStateFromOptimization();
                if (originalState) {
                    drawingStore.replaceAllShapes(originalState.shapes);
                    console.log(
                        'Restored drawing to state before optimization'
                    );
                }
            }

            // Clear chains and all dependent state
            chainStore.clearChains();
            partStore.clearParts();
            tessellationStore.clearTessellation();
            prepareStageStore.clearChainNormalizationResults();
            prepareStageStore.clearOriginalNormalizationState();
            prepareStageStore.clearOriginalOptimizationState();
            prepareStageStore.setPartsDetected(false);
            overlayStore.clearChainEndpoints(WorkflowStage.PREPARE);
            overlayStore.clearTessellationPoints(WorkflowStage.PREPARE);
            chainStore.selectChain(null);
            console.log('Cleared all chains and dependent state');
            return;
        }

        isDetectingChains = true;

        try {
            // Get current drawing shapes from drawing store
            const currentDrawing = $drawingStore.drawing;
            if (!currentDrawing || !currentDrawing.shapes) {
                console.warn('No drawing available for chain detection');
                chainStore.setChains([]);
                return;
            }

            // Update tolerance in store
            chainStore.setTolerance(algorithmParams.chainDetection.tolerance);

            // Detect chains and update store
            const chains = detectShapeChains(currentDrawing.shapes, {
                tolerance: algorithmParams.chainDetection.tolerance,
            });
            chainStore.setChains(chains);

            console.log(
                `Detected ${chains.length} chains with ${chains.reduce((sum, chain) => sum + chain.shapes.length, 0)} total shapes`
            );
        } catch (error) {
            console.error('Error detecting chains:', error);
            chainStore.setChains([]);
        } finally {
            isDetectingChains = false;
        }
    }

    async function handleNormalizeChains() {
        // Handle clear operation if normalization has been applied
        if (normalizationApplied && !isNormalizing) {
            const originalState =
                prepareStageStore.restoreOriginalStateFromNormalization();
            if (originalState) {
                // Restore original shapes to drawing
                drawingStore.replaceAllShapes(originalState.shapes);

                // Restore original chains
                chainStore.setChains(originalState.chains);

                // Clear the saved original state
                prepareStageStore.clearOriginalNormalizationState();

                // Update overlays
                if ($workflowStore.currentStage === WorkflowStage.PREPARE) {
                    updateChainOverlays(originalState.chains);
                }

                console.log('Restored original chains before normalization');
                return;
            }
        }

        const currentDrawing = $drawingStore.drawing;
        if (!currentDrawing || !currentDrawing.shapes) {
            console.warn('No drawing available to normalize');
            return;
        }

        if (detectedChains.length === 0) {
            console.warn('No chains detected. Please detect chains first.');
            return;
        }

        isNormalizing = true;

        try {
            // Save original state before normalization
            prepareStageStore.saveOriginalStateForNormalization(
                currentDrawing.shapes,
                detectedChains
            );

            // Normalize all chains
            const normalizedChains = detectedChains.map((chain) =>
                normalizeChain(chain, algorithmParams.chainNormalization)
            );

            // Flatten normalized chains back to shapes
            const normalizedShapes = normalizedChains.flatMap(
                (chain) => chain.shapes
            );

            // Update the drawing store with normalized shapes
            drawingStore.replaceAllShapes(normalizedShapes);

            // Re-detect chains after normalization to update the chain store
            const newChains = detectShapeChains(normalizedShapes, {
                tolerance: algorithmParams.chainDetection.tolerance,
            });
            chainStore.setChains(newChains);

            // Force update of overlay after a short delay to ensure drawing is updated (only when on prepare stage)
            setTimeout(() => {
                if ($workflowStore.currentStage === WorkflowStage.PREPARE) {
                    if (newChains.length > 0) {
                        updateChainOverlays(newChains);
                        console.log(
                            `Updated overlays after normalization for ${newChains.length} chains.`
                        );
                    } else {
                        overlayStore.clearChainEndpoints(WorkflowStage.PREPARE);
                    }
                }
                isNormalizing = false; // Reset flag after overlay is updated
            }, 50); // Small delay to ensure all stores are updated

            console.log(
                `Normalized chains. Re-detected ${newChains.length} chains.`
            );
        } catch (error) {
            console.error('Error during chain normalization:', error);
            isNormalizing = false; // Reset flag on error
        }
    }

    async function handleOptimizeStarts() {
        // Handle clear operation if optimization has been applied
        if (optimizationApplied && !isOptimizingStarts) {
            const originalState =
                prepareStageStore.restoreOriginalStateFromOptimization();
            if (originalState) {
                // Restore original shapes to drawing
                drawingStore.replaceAllShapes(originalState.shapes);

                // Restore original chains
                chainStore.setChains(originalState.chains);

                // Clear the saved original state
                prepareStageStore.clearOriginalOptimizationState();

                // Update overlays
                if ($workflowStore.currentStage === WorkflowStage.PREPARE) {
                    updateChainOverlays(originalState.chains);
                }

                console.log('Restored original chains before optimization');
                return;
            }
        }

        const currentDrawing = $drawingStore.drawing;
        if (!currentDrawing || !currentDrawing.shapes) {
            console.warn('No drawing available to optimize');
            return;
        }

        if (detectedChains.length === 0) {
            console.warn('No chains detected. Please detect chains first.');
            return;
        }

        isOptimizingStarts = true;

        try {
            // Save original state before optimization
            prepareStageStore.saveOriginalStateForOptimization(
                currentDrawing.shapes,
                detectedChains
            );

            // Optimize start points for all chains
            const optimizedShapes = optimizeStartPoints(
                detectedChains,
                algorithmParams.startPointOptimization
            );

            // Update the drawing store with optimized shapes
            drawingStore.replaceAllShapes(optimizedShapes);

            // Re-detect chains after optimization to update the chain store
            const newChains = detectShapeChains(optimizedShapes, {
                tolerance: algorithmParams.chainDetection.tolerance,
            });
            chainStore.setChains(newChains);

            // Force update of overlay after a short delay to ensure drawing is updated (only when on prepare stage)
            setTimeout(() => {
                if ($workflowStore.currentStage === WorkflowStage.PREPARE) {
                    if (newChains.length > 0) {
                        updateChainOverlays(newChains);
                        console.log(
                            `Updated overlays after optimization for ${newChains.length} chains.`
                        );
                    } else {
                        overlayStore.clearChainEndpoints(WorkflowStage.PREPARE);
                    }
                }
                isOptimizingStarts = false; // Reset flag after overlay is updated
            }, 50); // Small delay to ensure all stores are updated

            console.log(
                `Optimized start points. Re-detected ${newChains.length} chains.`
            );
        } catch (error) {
            console.error('Error during start point optimization:', error);
            isOptimizingStarts = false; // Reset flag on error
        }
    }

    async function handleDetectParts() {
        // Handle clear operation if parts have been detected
        if (partsDetectionApplied && !isDetectingParts) {
            // Clear parts and reset detection state
            partStore.clearParts();
            prepareStageStore.setPartsDetected(false);

            // Clear tessellation if it was enabled
            tessellationStore.clearTessellation();

            console.log('Cleared detected parts');
            return;
        }

        if (detectedChains.length === 0) {
            console.warn('No chains detected. Please detect chains first.');
            return;
        }

        isDetectingParts = true;

        try {
            // Add warnings for open chains first
            const openChainWarnings: PartDetectionWarning[] = [];
            for (const chain of detectedChains) {
                if (
                    !isChainClosed(
                        chain,
                        algorithmParams.chainDetection.tolerance
                    )
                ) {
                    const firstShape = chain.shapes[0];
                    const lastShape = chain.shapes[chain.shapes.length - 1];
                    const firstStart = getShapeStartPoint(firstShape);
                    const lastEnd = getShapeEndPoint(lastShape);

                    if (firstStart && lastEnd) {
                        openChainWarnings.push({
                            type: 'overlapping_boundary',
                            chainId: chain.id,
                            message: `Chain ${chain.id} is open. Start: (${firstStart.x.toFixed(2)}, ${firstStart.y.toFixed(2)}), End: (${lastEnd.x.toFixed(2)}, ${lastEnd.y.toFixed(2)})`,
                        });
                    }
                }
            }

            const partResult = await detectParts(
                detectedChains,
                algorithmParams.chainDetection.tolerance,
                algorithmParams.partDetection
            );

            // Combine open chain warnings with part detection warnings
            const allWarnings = [...openChainWarnings, ...partResult.warnings];
            partStore.setParts(partResult.parts, allWarnings);

            // Mark parts as detected in the store
            prepareStageStore.setPartsDetected(true);

            // Handle tessellation if enabled
            if (algorithmParams.partDetection.enableTessellation) {
                // Generate tessellation points
                const tessellationPoints: TessellationPoint[] = [];

                for (const chain of detectedChains) {
                    for (
                        let shapeIndex = 0;
                        shapeIndex < chain.shapes.length;
                        shapeIndex++
                    ) {
                        const shape = chain.shapes[shapeIndex];
                        const shapePoints = tessellateShape(
                            shape,
                            algorithmParams.partDetection
                        );

                        for (
                            let pointIndex = 0;
                            pointIndex < shapePoints.length;
                            pointIndex++
                        ) {
                            const point = shapePoints[pointIndex];
                            tessellationPoints.push({
                                x: point.x,
                                y: point.y,
                                chainId: chain.id,
                                shapeId: `${chain.id}-shape-${shapeIndex}`,
                            });
                        }
                    }
                }

                tessellationStore.setTessellation(tessellationPoints);
                console.log(
                    `Generated ${tessellationPoints.length} tessellation points for ${detectedChains.length} chains`
                );
            } else {
                // Clear tessellation if disabled
                tessellationStore.clearTessellation();
            }

            console.log(
                `Detected ${partResult.parts.length} parts with ${allWarnings.length} warnings`
            );
        } catch (error) {
            console.error('Error detecting parts:', error);
            partStore.setParts([], []);
            prepareStageStore.setPartsDetected(false);
            tessellationStore.clearTessellation();
        } finally {
            isDetectingParts = false;
        }
    }

    function handleDecomposePolylines() {
        const drawing = $drawingStore.drawing;
        if (!drawing || !drawing.shapes || drawing.shapes.length === 0) {
            alert('No drawing loaded or no shapes to decompose.');
            return;
        }

        const decomposedShapes = decomposePolylines(drawing.shapes);
        drawingStore.replaceAllShapes(decomposedShapes);
    }

    function handleTranslateToPositive() {
        const drawing = $drawingStore.drawing;
        if (!drawing || !drawing.shapes || drawing.shapes.length === 0) {
            alert('No drawing loaded or no shapes to translate.');
            return;
        }

        const translatedShapes = translateToPositiveQuadrant(drawing.shapes);
        drawingStore.replaceAllShapes(translatedShapes);
    }

    function handleJoinColinearLines() {
        const drawing = $drawingStore.drawing;
        if (!drawing || !drawing.shapes || drawing.shapes.length === 0) {
            alert('No drawing loaded or no shapes to join.');
            return;
        }

        try {
            // First detect chains from current shapes
            const chains = detectShapeChains(drawing.shapes, {
                tolerance: algorithmParams.chainDetection.tolerance,
            });

            // Join collinear lines in the chains using the configured parameters
            const joinedChains = joinColinearLines(
                chains,
                algorithmParams.joinColinearLines
            );

            // Extract all shapes from the joined chains
            const allJoinedShapes = joinedChains.flatMap(
                (chain) => chain.shapes
            );

            // Update the drawing with the joined shapes
            drawingStore.replaceAllShapes(allJoinedShapes);

            console.log(
                `Line joining complete. Original: ${drawing.shapes.length} shapes, Joined: ${allJoinedShapes.length} shapes`
            );
        } catch (error) {
            console.error('Error joining colinear lines:', error);
            alert('Error joining colinear lines. Check console for details.');
        }
    }

    // Apply all actions in order
    async function handleApplyAll() {
        // Apply each action in order, checking conditions dynamically
        const drawing = $drawingStore.drawing;
        if (!drawing || !drawing.shapes || drawing.shapes.length === 0) {
            console.log('No drawing available');
            return;
        }

        console.log('Applying: Decompose Polylines');
        handleDecomposePolylines();

        console.log('Applying: Join Co-linear Lines');
        handleJoinColinearLines();

        console.log('Applying: Translate to Positive');
        handleTranslateToPositive();

        // Detect chains if not already detected
        if (!chainsDetected) {
            console.log('Applying: Detect Chains');
            handleDetectChains();

            // Wait a bit for chain detection to complete
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Check if chains were detected and apply subsequent actions
        if (detectedChains.length > 0) {
            // Normalize chains if not already normalized
            if (!normalizationApplied) {
                console.log('Applying: Normalize Chains');
                handleNormalizeChains();

                // Wait a bit for normalization to complete
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            // Optimize starts if not already optimized
            if (!optimizationApplied) {
                console.log('Applying: Optimize Starts');
                handleOptimizeStarts();

                // Wait a bit for optimization to complete
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            // Detect parts if not already detected
            if (!partsDetectionApplied) {
                console.log('Applying: Detect Parts');
                handleDetectParts();
            }
        }
    }

    // Clear all actions in reverse order
    function handleClearAll() {
        // List of actions to clear in reverse order
        const clearActions = [];

        // Add clear actions based on current state
        if (partsDetectionApplied) {
            clearActions.push({
                name: 'Clear Parts',
                handler: handleDetectParts,
            });
        }
        if (optimizationApplied) {
            clearActions.push({
                name: 'Clear Optimization',
                handler: handleOptimizeStarts,
            });
        }
        if (normalizationApplied) {
            clearActions.push({
                name: 'Clear Normalization',
                handler: handleNormalizeChains,
            });
        }
        if (chainsDetected) {
            clearActions.push({
                name: 'Clear Chains',
                handler: handleDetectChains,
            });
        }

        // Apply each clear action
        for (const action of clearActions) {
            console.log(`Clearing: ${action.name}`);
            action.handler();
        }
    }

    // Auto-complete prepare stage when chains or parts are detected
    $: if (detectedChains.length > 0 || detectedParts.length > 0) {
        workflowStore.completeStage(WorkflowStage.PREPARE);
    }

    // Column widths are now persisted via the prepare stage store - no need for localStorage

    // Save column widths to store
    function saveColumnWidths() {
        prepareStageStore.setColumnWidths(leftColumnWidth, rightColumnWidth);
    }

    // Left column resize handlers
    function handleLeftResizeStart(e: MouseEvent) {
        isDraggingLeft = true;
        startX = e.clientX;
        startWidth = leftColumnWidth;
        document.addEventListener('mousemove', handleLeftResize);
        document.addEventListener('mouseup', handleLeftResizeEnd);
        e.preventDefault();
    }

    function handleLeftResize(e: MouseEvent) {
        if (!isDraggingLeft) return;
        const deltaX = e.clientX - startX;
        const newWidth = Math.max(200, Math.min(600, startWidth + deltaX)); // Min 200px, max 600px
        leftColumnWidth = newWidth;
    }

    function handleLeftResizeEnd() {
        isDraggingLeft = false;
        document.removeEventListener('mousemove', handleLeftResize);
        document.removeEventListener('mouseup', handleLeftResizeEnd);
        saveColumnWidths();
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
    function handleLeftKeydown(e: KeyboardEvent) {
        if (e.key === 'ArrowLeft') {
            leftColumnWidth = Math.max(200, leftColumnWidth - 10);
            saveColumnWidths();
            e.preventDefault();
        } else if (e.key === 'ArrowRight') {
            leftColumnWidth = Math.min(600, leftColumnWidth + 10);
            saveColumnWidths();
            e.preventDefault();
        }
    }

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

<div class="program-stage">
    <div
        class="program-layout"
        class:no-select={isDraggingLeft || isDraggingRight}
    >
        <!-- Left Column -->
        <div class="left-column" style="width: {leftColumnWidth}px;">
            <!-- Left resize handle -->
            <button
                class="resize-handle resize-handle-right"
                onmousedown={handleLeftResizeStart}
                onkeydown={handleLeftKeydown}
                class:dragging={isDraggingLeft}
                aria-label="Resize left panel (Arrow keys to adjust)"
                type="button"
            ></button>

            <AccordionPanel title="Layers" isExpanded={true}>
                <LayersInfo />
            </AccordionPanel>

            <AccordionPanel title="Parts" isExpanded={true}>
                {#if detectedParts.length > 0}
                    <div class="parts-list">
                        {#each detectedParts as part, index (part.id)}
                            <div
                                class="part-item {selectedPartId === part.id
                                    ? 'selected'
                                    : ''} {hoveredPartId === part.id
                                    ? 'hovered'
                                    : ''}"
                                role="button"
                                tabindex="0"
                                onclick={() =>
                                    onPartClick && onPartClick(part.id)}
                                onkeydown={(e) =>
                                    e.key === 'Enter' &&
                                    onPartClick &&
                                    onPartClick(part.id)}
                                onmouseenter={() =>
                                    onPartHover && onPartHover(part.id)}
                                onmouseleave={() =>
                                    onPartHoverEnd && onPartHoverEnd()}
                            >
                                <div class="part-header">
                                    <span class="part-name"
                                        >Part {index + 1}</span
                                    >
                                    <span class="part-info"
                                        >{part.holes.length} holes</span
                                    >
                                </div>
                                <div class="part-details">
                                    <div class="shell-info">
                                        <span class="shell-label">Shell:</span>
                                        <span class="chain-ref"
                                            >{part.shell.chain.shapes.length} shapes</span
                                        >
                                    </div>
                                    {#if part.holes.length > 0}
                                        <div class="holes-info">
                                            <span class="holes-label"
                                                >Holes:</span
                                            >
                                            {#each part.holes as hole, holeIndex (hole.id)}
                                                <div class="hole-item">
                                                    <span class="hole-ref"
                                                        >Hole {holeIndex + 1}: {hole
                                                            .chain.shapes
                                                            .length} shapes</span
                                                    >
                                                </div>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div class="empty-state">
                        <p>
                            No parts detected yet. Click "Detect Parts" to
                            analyze chains.
                        </p>
                    </div>
                {/if}
            </AccordionPanel>

            <AccordionPanel title="Chains" isExpanded={true}>
                {#if detectedChains.length > 0}
                    <div class="chain-summary">
                        {#each chainNormalizationResults as result (result.chainId)}
                            <div
                                class="chain-summary-item {selectedChainId ===
                                result.chainId
                                    ? 'selected'
                                    : ''} {highlightedChainId === result.chainId
                                    ? 'highlighted'
                                    : ''}"
                                role="button"
                                tabindex="0"
                                onclick={() =>
                                    onChainClick &&
                                    onChainClick(result.chainId)}
                                onkeydown={(e) =>
                                    e.key === 'Enter' &&
                                    onChainClick &&
                                    onChainClick(result.chainId)}
                                onmouseenter={() =>
                                    onChainHover &&
                                    onChainHover(result.chainId)}
                                onmouseleave={() =>
                                    onChainHoverEnd && onChainHoverEnd()}
                            >
                                <div class="chain-header">
                                    <span class="chain-name"
                                        >Chain {result.chainId.split(
                                            '-'
                                        )[1]}</span
                                    >
                                    <div class="chain-indicators">
                                        <span
                                            class="chain-status {(() => {
                                                const chain =
                                                    detectedChains.find(
                                                        (c) =>
                                                            c.id ===
                                                            result.chainId
                                                    );
                                                return chain &&
                                                    isChainClosed(
                                                        chain,
                                                        algorithmParams
                                                            .chainDetection
                                                            .tolerance
                                                    )
                                                    ? 'closed'
                                                    : 'open';
                                            })()}"
                                        >
                                            {(() => {
                                                const chain =
                                                    detectedChains.find(
                                                        (c) =>
                                                            c.id ===
                                                            result.chainId
                                                    );
                                                return chain &&
                                                    isChainClosed(
                                                        chain,
                                                        algorithmParams
                                                            .chainDetection
                                                            .tolerance
                                                    )
                                                    ? 'Closed'
                                                    : 'Open';
                                            })()}
                                        </span>
                                        <span
                                            class="traversal-status {result.canTraverse
                                                ? 'can-traverse'
                                                : 'cannot-traverse'}"
                                        >
                                            {result.canTraverse ? '✓' : '✗'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <div class="empty-state">
                        <p>
                            No chains detected yet. Click "Detect Chains" to
                            analyze shapes.
                        </p>
                    </div>
                {/if}
            </AccordionPanel>

            <AccordionPanel title="Next Stage" isExpanded={true}>
                <div class="next-stage-content">
                    <button class="next-button" onclick={handleNext}>
                        Next: Program Cuts
                    </button>
                    <p class="next-help">
                        Set cutting parameters and generate tool paths.
                    </p>
                </div>
            </AccordionPanel>
        </div>

        <!-- Center Column -->
        <div class="center-column">
            <svelte:component
                this={sharedCanvas}
                currentStage={canvasStage}
                {interactionMode}
                {onChainClick}
                {onPartClick}
            />
        </div>

        <!-- Right Column -->
        <div class="right-column" style="width: {rightColumnWidth}px;">
            <!-- Right resize handle -->
            <button
                class="resize-handle resize-handle-left"
                onmousedown={handleRightResizeStart}
                onkeydown={handleRightKeydown}
                class:dragging={isDraggingRight}
                aria-label="Resize right panel (Arrow keys to adjust)"
                type="button"
            ></button>

            <AccordionPanel title="Prepare" isExpanded={true}>
                <svelte:fragment slot="header-button">
                    <button
                        class="header-action-button apply-all-button"
                        onclick={() => handleApplyAll()}
                        disabled={!$drawingStore.drawing}
                        title="Apply all actions in order"
                    >
                        Apply
                    </button>
                    <button
                        class="header-action-button clear-all-button"
                        onclick={handleClearAll}
                        disabled={!chainsDetected &&
                            !normalizationApplied &&
                            !optimizationApplied &&
                            !partsDetectionApplied}
                        title="Clear all actions in reverse order"
                    >
                        Clear
                    </button>
                </svelte:fragment>
                <!-- Decompose Polylines -->
                <details class="param-group-details">
                    <summary class="param-group-summary">
                        <span class="action-title">Decompose Polylines</span>
                        <button
                            class="apply-button"
                            onclick={(e) => {
                                e.stopPropagation();
                                handleDecomposePolylines();
                            }}
                            disabled={!$drawingStore.drawing}
                        >
                            Apply
                        </button>
                    </summary>
                    <div class="param-group-content">
                        <div class="prepare-action-description">
                            Converts complex polylines into individual line and
                            arc segments for better processing.
                        </div>
                    </div>
                </details>

                <!-- Join Co-linear Lines -->
                <details class="param-group-details">
                    <summary class="param-group-summary">
                        <span class="action-title">Join Co-linear Lines</span>
                        <button
                            class="apply-button"
                            onclick={(e) => {
                                e.stopPropagation();
                                handleJoinColinearLines();
                            }}
                            disabled={!$drawingStore.drawing}
                        >
                            Apply
                        </button>
                    </summary>
                    <div class="param-group-content">
                        <div class="prepare-action-description">
                            Combines adjacent line segments that are perfectly
                            aligned into single lines to simplify geometry.
                        </div>
                        <label class="param-label">
                            Collinearity Tolerance:
                            <input
                                type="number"
                                value={algorithmParams.joinColinearLines
                                    .tolerance}
                                oninput={(e) =>
                                    updateJoinColinearLinesTolerance(
                                        parseFloat(e.currentTarget.value)
                                    )}
                                min="0.001"
                                max="1.0"
                                step="0.001"
                                class="param-input"
                                title="Tolerance for determining if lines are collinear."
                            />
                            <div class="param-description">
                                Maximum deviation from perfect collinearity for
                                lines to be considered joinable. Smaller values
                                require more precise alignment. Larger values
                                allow joining of slightly misaligned line
                                segments.
                            </div>
                        </label>
                    </div>
                </details>

                <!-- Translate to Positive -->
                <details class="param-group-details">
                    <summary class="param-group-summary">
                        <span class="action-title">Translate to Positive</span>
                        <button
                            class="apply-button"
                            onclick={(e) => {
                                e.stopPropagation();
                                handleTranslateToPositive();
                            }}
                            disabled={!$drawingStore.drawing}
                        >
                            Apply
                        </button>
                    </summary>
                    <div class="param-group-content">
                        <div class="prepare-action-description">
                            Moves all shapes so the drawing origin is in the
                            positive quadrant (bottom-left corner).
                        </div>
                    </div>
                </details>

                <!-- Detect Chains -->
                <details class="param-group-details">
                    <summary class="param-group-summary">
                        <span class="action-title">Detect Chains</span>
                        <button
                            class="apply-button"
                            class:clear-button={chainsDetected &&
                                !isDetectingChains}
                            onclick={(e) => {
                                e.stopPropagation();
                                handleDetectChains();
                            }}
                            disabled={isDetectingChains}
                        >
                            {isDetectingChains
                                ? 'Detecting...'
                                : chainsDetected
                                  ? 'Clear'
                                  : 'Apply'}
                        </button>
                    </summary>
                    <div class="param-group-content">
                        <div class="prepare-action-description">
                            Analyzes shapes to find connected sequences that
                            form continuous cutting paths.
                        </div>
                        <label class="param-label">
                            Connection Tolerance:
                            <input
                                type="number"
                                value={algorithmParams.chainDetection.tolerance}
                                oninput={(e) =>
                                    updateChainDetectionTolerance(
                                        parseFloat(e.currentTarget.value)
                                    )}
                                min="0.001"
                                max="10"
                                step="0.001"
                                class="param-input"
                                title="Distance tolerance for connecting shapes into chains."
                            />
                            <div class="param-description">
                                Maximum distance between shape endpoints to be
                                considered connected. Higher values will connect
                                shapes that are further apart, potentially
                                creating longer chains. Lower values require
                                more precise endpoint alignment.
                            </div>
                        </label>
                    </div>
                </details>

                <!-- Normalize Chains -->
                <details class="param-group-details">
                    <summary class="param-group-summary">
                        <span class="action-title">Normalize Chains</span>
                        <button
                            class="apply-button"
                            class:clear-button={normalizationApplied &&
                                !isNormalizing}
                            onclick={(e) => {
                                e.stopPropagation();
                                handleNormalizeChains();
                            }}
                            disabled={isNormalizing ||
                                detectedChains.length === 0}
                        >
                            {isNormalizing
                                ? 'Normalizing...'
                                : normalizationApplied
                                  ? 'Clear'
                                  : 'Apply'}
                        </button>
                    </summary>
                    <div class="param-group-content">
                        <div class="prepare-action-description">
                            Ensures all shapes in chains are oriented
                            consistently for proper traversal.
                        </div>
                        <label class="param-label">
                            Traversal Tolerance:
                            <input
                                type="number"
                                value={algorithmParams.chainNormalization
                                    .traversalTolerance}
                                oninput={(e) =>
                                    updateNormalizationTraversalTolerance(
                                        parseFloat(e.currentTarget.value)
                                    )}
                                min="0.001"
                                max="1.0"
                                step="0.001"
                                class="param-input"
                                title="Tolerance for floating point comparison in traversal analysis."
                            />
                            <div class="param-description">
                                Precision tolerance for checking if shape
                                endpoints align during chain traversal analysis.
                                Smaller values require more precise alignment
                                between consecutive shapes. Used to determine if
                                chains can be traversed end-to-start without
                                gaps.
                            </div>
                        </label>

                        <label class="param-label">
                            Max Traversal Attempts:
                            <input
                                type="number"
                                value={algorithmParams.chainNormalization
                                    .maxTraversalAttempts}
                                oninput={(e) =>
                                    updateNormalizationMaxAttempts(
                                        parseFloat(e.currentTarget.value)
                                    )}
                                min="1"
                                max="10"
                                step="1"
                                class="param-input"
                                title="Maximum number of traversal attempts per chain."
                            />
                            <div class="param-description">
                                Limits how many different starting points the
                                algorithm tries when analyzing chain traversal.
                                Higher values are more thorough but slower for
                                complex chains. Lower values improve performance
                                but may miss valid traversal paths.
                            </div>
                        </label>
                    </div>
                </details>

                <!-- Optimize Starts -->
                <details class="param-group-details">
                    <summary class="param-group-summary">
                        <span class="action-title">Optimize Starts</span>
                        <button
                            class="apply-button"
                            class:clear-button={optimizationApplied &&
                                !isOptimizingStarts}
                            onclick={(e) => {
                                e.stopPropagation();
                                handleOptimizeStarts();
                            }}
                            disabled={isOptimizingStarts ||
                                detectedChains.length === 0}
                        >
                            {isOptimizingStarts
                                ? 'Optimizing...'
                                : optimizationApplied
                                  ? 'Clear'
                                  : 'Apply'}
                        </button>
                    </summary>
                    <div class="param-group-content">
                        <div class="prepare-action-description">
                            Adjusts chain starting points to minimize rapid
                            movement and cutting time.
                        </div>
                        <label class="param-label">
                            Split Position:
                            <select
                                value={algorithmParams.startPointOptimization
                                    .splitPosition}
                                onchange={(e) =>
                                    updateStartPointOptimizationSplitPosition(
                                        e.currentTarget.value
                                    )}
                                class="param-input"
                                title="Position along the shape where to create the split point."
                            >
                                <option value="midpoint">Midpoint</option>
                            </select>
                            <div class="param-description">
                                Position along the selected shape where the
                                start point optimization will split the
                                geometry. Currently only midpoint splitting is
                                supported for consistent cutting behavior.
                            </div>
                        </label>

                        <label class="param-label">
                            Optimization Tolerance:
                            <input
                                type="number"
                                value={algorithmParams.startPointOptimization
                                    .tolerance}
                                oninput={(e) =>
                                    updateStartPointOptimizationTolerance(
                                        parseFloat(e.currentTarget.value)
                                    )}
                                min="0.001"
                                max="10"
                                step="0.001"
                                class="param-input"
                                title="Tolerance for optimization operations including chain closure detection."
                            />
                            <div class="param-description">
                                Distance tolerance used for determining chain
                                closure and optimization operations. Higher
                                values are more permissive for connecting
                                shapes. Lower values require more precise
                                geometric alignment.
                            </div>
                        </label>
                    </div>
                </details>

                <!-- Detect Parts -->
                <details class="param-group-details">
                    <summary class="param-group-summary">
                        <span class="action-title">Detect Parts</span>
                        <button
                            class="apply-button"
                            class:clear-button={partsDetectionApplied &&
                                !isDetectingParts}
                            onclick={(e) => {
                                e.stopPropagation();
                                handleDetectParts();
                            }}
                            disabled={isDetectingParts ||
                                detectedChains.length === 0}
                        >
                            {isDetectingParts
                                ? 'Detecting...'
                                : partsDetectionApplied
                                  ? 'Clear'
                                  : 'Apply'}
                        </button>
                    </summary>
                    <div class="param-group-content">
                        <div class="prepare-action-description">
                            Identifies parts (outer shells with inner holes)
                            from closed chains for advanced cutting operations.
                        </div>
                        <label class="param-label">
                            Circle Points:
                            <input
                                type="number"
                                value={algorithmParams.partDetection
                                    .circleTessellationPoints}
                                oninput={(e) =>
                                    updateTessellationCirclePoints(
                                        parseFloat(e.currentTarget.value)
                                    )}
                                min="8"
                                max="128"
                                step="1"
                                class="param-input"
                                title="Number of points to tessellate circles into. Higher = better precision but slower."
                            />
                            <div class="param-description">
                                Number of straight line segments used to
                                approximate circles for geometric operations.
                                Higher values provide better accuracy for
                                containment detection but slower performance.
                                Increase for complex files with precision
                                issues.
                            </div>
                        </label>

                        <label class="param-label">
                            Min Arc Points:
                            <input
                                type="number"
                                value={algorithmParams.partDetection
                                    .minArcTessellationPoints}
                                oninput={(e) =>
                                    updateTessellationMinArcPoints(
                                        parseFloat(e.currentTarget.value)
                                    )}
                                min="4"
                                max="64"
                                step="1"
                                class="param-input"
                                title="Minimum number of points for arc tessellation."
                            />
                            <div class="param-description">
                                Minimum number of points for arc tessellation,
                                regardless of arc length. Ensures even very
                                small arcs have adequate geometric
                                representation. Higher values improve precision
                                for tiny arc segments.
                            </div>
                        </label>

                        <label class="param-label">
                            Arc Precision:
                            <input
                                type="number"
                                value={algorithmParams.partDetection
                                    .arcTessellationDensity}
                                oninput={(e) =>
                                    updateTessellationArcPrecision(
                                        parseFloat(e.currentTarget.value)
                                    )}
                                min="0.01"
                                max="0.5"
                                step="0.01"
                                class="param-input"
                                title="Arc tessellation density factor. Smaller = more points."
                            />
                            <div class="param-description">
                                Controls how finely arcs are divided into line
                                segments (radians per point). Smaller values
                                create more points and better precision. Larger
                                values use fewer points for faster processing
                                but less accuracy.
                            </div>
                        </label>

                        <label class="param-label">
                            Decimal Precision:
                            <input
                                type="number"
                                value={algorithmParams.partDetection
                                    .decimalPrecision}
                                oninput={(e) =>
                                    updatePartDetectionDecimalPrecision(
                                        parseFloat(e.currentTarget.value)
                                    )}
                                min="1"
                                max="6"
                                step="1"
                                class="param-input"
                                title="Decimal precision for coordinate rounding."
                            />
                            <div class="param-description">
                                Number of decimal places for coordinate rounding
                                to avoid floating-point errors. Higher values
                                preserve more precision but may cause numerical
                                instability. Lower values improve robustness but
                                may lose fine geometric details.
                            </div>
                        </label>

                        <label class="param-label">
                            <input
                                type="checkbox"
                                checked={algorithmParams.partDetection
                                    .enableTessellation}
                                onchange={(e) =>
                                    updatePartDetectionTessellationEnabled(
                                        e.currentTarget.checked
                                    )}
                                class="param-checkbox"
                                title="Show tessellation visualization points during parts detection."
                            />
                            Enable Tessellation Visualization
                            <div class="param-description">
                                Shows visualization points along chain paths for
                                analysis and debugging during parts detection.
                                This helps visualize how shapes are being
                                processed for containment analysis.
                            </div>
                        </label>
                    </div>
                </details>
            </AccordionPanel>
            <AccordionPanel
                title="Chain"
                isExpanded={selectedChain && selectedChainAnalysis
                    ? true
                    : false}
            >
                {#if selectedChain && selectedChainAnalysis}
                    <div class="chain-detail">
                        <div class="chain-detail-header">
                            <span class="chain-id">{selectedChain.id}</span>
                            <span
                                class="traversal-status {selectedChainAnalysis.canTraverse
                                    ? 'can-traverse'
                                    : 'cannot-traverse'}"
                            >
                                {selectedChainAnalysis.canTraverse
                                    ? '✓ Traversable'
                                    : '✗ Not Traversable'}
                            </span>
                        </div>
                        <div class="chain-properties">
                            <div class="property">
                                <span class="property-label">Status:</span>
                                <span
                                    class="property-value {isChainClosed(
                                        selectedChain,
                                        algorithmParams.chainDetection.tolerance
                                    )
                                        ? 'closed'
                                        : 'open'}"
                                >
                                    {isChainClosed(
                                        selectedChain,
                                        algorithmParams.chainDetection.tolerance
                                    )
                                        ? 'Closed'
                                        : 'Open'}
                                </span>
                            </div>
                            <div class="property">
                                <span class="property-label">Winding:</span>
                                <span class="property-value">
                                    {(() => {
                                        const direction = detectCutDirection(
                                            selectedChain,
                                            algorithmParams.chainDetection
                                                .tolerance
                                        );
                                        return direction ===
                                            CutDirection.CLOCKWISE
                                            ? 'CW'
                                            : direction ===
                                                CutDirection.COUNTERCLOCKWISE
                                              ? 'CCW'
                                              : 'N/A';
                                    })()}
                                </span>
                            </div>
                            <div class="property">
                                <span class="property-label">Issues:</span>
                                <span class="property-value"
                                    >{selectedChainAnalysis.issues.length}</span
                                >
                            </div>
                        </div>
                        <div class="chain-shapes-list">
                            <h4 class="shapes-title">
                                Shapes in Chain ({selectedChain.shapes.length}):
                            </h4>
                            {#each selectedChain.shapes as shape, index (`${shape.id}-${index}`)}
                                {@const startPoint = getShapeStartPoint(shape)}
                                {@const endPoint = getShapeEndPoint(shape)}
                                <div class="shape-item">
                                    <div class="shape-header">
                                        <span class="shape-index"
                                            >{index + 1}.</span
                                        >
                                        <span class="shape-type"
                                            >{shape.type}</span
                                        >
                                        <span class="shape-id"
                                            >({shape.id})</span
                                        >
                                    </div>
                                    <div class="shape-points">
                                        <div class="point-info">
                                            <span class="point-label"
                                                >Start:</span
                                            >
                                            <span class="point-coords"
                                                >({startPoint.x.toFixed(2)}, {startPoint.y.toFixed(
                                                    2
                                                )})</span
                                            >
                                        </div>
                                        <div class="point-info">
                                            <span class="point-label">End:</span
                                            >
                                            <span class="point-coords"
                                                >({endPoint.x.toFixed(2)}, {endPoint.y.toFixed(
                                                    2
                                                )})</span
                                            >
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                        {#if selectedChainAnalysis.issues.length > 0}
                            <div class="chain-issues">
                                <h4 class="issues-title">Issues:</h4>
                                {#each selectedChainAnalysis.issues as issue, issueIndex (issueIndex)}
                                    <div class="issue-item">
                                        <span class="issue-type"
                                            >{issue.type.replace(
                                                '_',
                                                ' '
                                            )}</span
                                        >
                                        <span class="issue-description"
                                            >{issue.description}</span
                                        >
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {:else}
                    <div class="empty-state">
                        <p>No chain selected. Click a chain to see details.</p>
                    </div>
                {/if}
            </AccordionPanel>

            {#if partWarnings.length > 0}
                <AccordionPanel
                    title="Part Detection Warnings"
                    isExpanded={true}
                >
                    <div class="warnings-list">
                        {#each partWarnings as warning, warningIndex (warningIndex)}
                            <div class="warning-item">
                                <div class="warning-icon">⚠️</div>
                                <div class="warning-content">
                                    <div class="warning-type">
                                        {warning.type.replace('_', ' ')}
                                    </div>
                                    <div class="warning-message">
                                        {warning.message}
                                    </div>
                                    <div class="warning-chain">
                                        Chain ID: {warning.chainId}
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </AccordionPanel>
            {/if}

            {#if chainTraversalIssues.length > 0}
                <AccordionPanel title="Problems" isExpanded={true}>
                    <div class="traversal-info">
                        <p class="traversal-description">
                            Chains should be traversable from start to end, with
                            each shape connecting end-to-start with the next
                            shape. Issues found:
                        </p>
                    </div>
                    <div class="warnings-list">
                        {#each chainTraversalIssues as issue, chainIssueIndex (chainIssueIndex)}
                            <div class="warning-item traversal-warning">
                                <div class="warning-icon">🔗</div>
                                <div class="warning-content">
                                    <div class="warning-type">
                                        {issue.type.replace('_', ' ')}
                                    </div>
                                    <div class="warning-message">
                                        {issue.description}
                                    </div>
                                    <div class="warning-details">
                                        <div class="warning-chain">
                                            Chain ID: {issue.chainId}
                                        </div>
                                        <div class="warning-shapes">
                                            Shapes: {issue.shapeIndex1 + 1} and {issue.shapeIndex2 +
                                                1}
                                        </div>
                                        <div class="warning-point">
                                            Point: ({issue.point1.x.toFixed(3)}, {issue.point1.y.toFixed(
                                                3
                                            )})
                                        </div>
                                    </div>
                                    <div class="traversal-status">
                                        Can traverse: {issue.chainCanTraverse
                                            ? 'Yes'
                                            : 'No'}
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </AccordionPanel>
            {/if}

            <AccordionPanel title="Show" isExpanded={true}>
                <div class="show-panel-content">
                    <label class="show-checkbox-label">
                        <input
                            type="checkbox"
                            checked={$prepareStageStore.showChainStartPoints}
                            onchange={(e) =>
                                prepareStageStore.setShowChainStartPoints(
                                    e.currentTarget.checked
                                )}
                            class="show-checkbox"
                        />
                        Chain Start Points
                    </label>
                    <label class="show-checkbox-label">
                        <input
                            type="checkbox"
                            checked={$prepareStageStore.showChainEndPoints}
                            onchange={(e) =>
                                prepareStageStore.setShowChainEndPoints(
                                    e.currentTarget.checked
                                )}
                            class="show-checkbox"
                        />
                        Chain End Points
                    </label>
                    <label class="show-checkbox-label">
                        <input
                            type="checkbox"
                            checked={$prepareStageStore.showChainTangentLines}
                            onchange={(e) =>
                                prepareStageStore.setShowChainTangentLines(
                                    e.currentTarget.checked
                                )}
                            class="show-checkbox"
                        />
                        Chain Tangent Lines
                    </label>
                </div>
            </AccordionPanel>

            <!-- Hidden for now -->
            <!-- <div class="panel">
        <h3 class="panel-title">Tool Path Information</h3>
        <p class="placeholder-text">
          Tool path generation and optimization features will be implemented here.
        </p>
        <ul class="info-list">
          <li>Total cutting length: <strong>--</strong></li>
          <li>Estimated cut time: <strong>--</strong></li>
          <li>Number of pierces: <strong>--</strong></li>
          <li>Tool path optimization: <strong>Enabled</strong></li>
        </ul>
      </div> -->
        </div>
    </div>
</div>

<style>
    .program-stage {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: #f8f9fa;
    }

    .program-layout {
        display: flex;
        flex: 1;
        overflow: hidden;
    }

    .left-column {
        background-color: #f5f5f5;
        border-right: 1px solid #e5e7eb;
        padding: 1rem;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        min-height: 0; /* Allow flex child to shrink */
        flex-shrink: 0; /* Prevent column from shrinking */
        position: relative; /* For resize handle positioning */
    }

    .center-column {
        flex: 1;
        display: flex;
        flex-direction: column;
        background-color: white;
    }

    .right-column {
        background-color: #f5f5f5;
        border-left: 1px solid #e5e7eb;
        padding: 1rem;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        min-height: 0; /* Allow flex child to shrink */
        flex-shrink: 0; /* Prevent column from shrinking */
        position: relative; /* For resize handle positioning */
    }

    /* Removed .panel styles - now handled by AccordionPanel component */

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

    /* Removed .next-stage-panel - now handled by next-stage-content within AccordionPanel */

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

    /* Prepare action title and apply button styles */
    .action-title {
        font-size: 0.875rem;
        font-weight: 500;
        color: #374151;
        flex: 1;
    }

    .apply-button {
        padding: 0.25rem 0.75rem;
        background-color: rgb(0, 83, 135);
        color: white;
        border: none;
        border-radius: 0.25rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.75rem;
        flex-shrink: 0;
        margin-left: auto;
        margin-right: 2rem;
    }

    .apply-button:hover:not(:disabled) {
        background-color: rgb(0, 83, 135);
    }

    .apply-button:disabled {
        background-color: #9ca3af;
        cursor: not-allowed;
        color: #6b7280;
    }

    .apply-button.clear-button {
        background-color: rgb(133, 18, 0);
    }

    .apply-button.clear-button:hover:not(:disabled) {
        background-color: rgb(133, 18, 0);
    }

    .prepare-action-description {
        font-size: 0.75rem;
        color: #6b7280;
        line-height: 1.4;
        margin: 0;
    }

    /* .input-label removed - tolerance input removed from toolbar */

    /* .tolerance-input removed - moved to Algorithm Parameters */

    /* .tolerance-input:focus removed - moved to Algorithm Parameters */

    /* Toolbar styles removed - buttons moved to Prepare box */

    /* Parts list styles - .panel-title now handled by AccordionPanel component */

    .parts-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .part-item {
        padding: 0.75rem;
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: all 0.2s ease;
        user-select: none;
    }

    .part-item:hover {
        background-color: #f1f5f9;
        border-color: #cbd5e1;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .part-item.selected {
        background-color: #fef3c7;
        border-color: #f59e0b;
    }

    .part-item.hovered {
        background-color: #fef9e7;
        border-color: #fbbf24;
    }

    .part-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .part-name {
        font-weight: 600;
        color: rgb(0, 83, 135);
        font-size: 0.875rem;
    }

    .part-info {
        font-size: 0.75rem;
        color: #6b7280;
        background-color: #e5e7eb;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
    }

    .part-details {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.75rem;
    }

    .shell-info,
    .holes-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .shell-label,
    .holes-label {
        font-weight: 500;
        color: #374151;
    }

    .chain-ref,
    .hole-ref {
        color: #6b7280;
        margin-left: 0.5rem;
    }

    .hole-item {
        margin-left: 0.5rem;
    }

    /* Warning styles - panel styles now handled by AccordionPanel component */

    .warnings-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .warning-item {
        display: flex;
        gap: 0.75rem;
        padding: 0.75rem;
        background-color: #fffbeb;
        border: 1px solid #fed7aa;
        border-radius: 0.375rem;
    }

    .warning-icon {
        font-size: 1.25rem;
        flex-shrink: 0;
    }

    .warning-content {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .warning-type {
        font-weight: 600;
        color: #f59e0b;
        font-size: 0.875rem;
        text-transform: capitalize;
    }

    .warning-message {
        color: #78716c;
        font-size: 0.875rem;
        line-height: 1.4;
    }

    .warning-chain {
        color: #a8a29e;
        font-size: 0.75rem;
        font-family: monospace;
    }

    /* Chain traversal warning styles - panel styles now handled by AccordionPanel component */

    .traversal-info {
        margin-bottom: 1rem;
    }

    .traversal-description {
        font-size: 0.875rem;
        color: #6b7280;
        line-height: 1.4;
        margin: 0;
    }

    .traversal-warning {
        background-color: #fef2f2;
        border-color: #fecaca;
    }

    .warning-details {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin-top: 0.5rem;
    }

    .warning-shapes,
    .warning-point {
        color: #6b7280;
        font-size: 0.75rem;
        font-family: monospace;
    }

    .traversal-status {
        font-size: 0.75rem;
        font-weight: 600;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        margin-top: 0.5rem;
        display: inline-block;
        width: fit-content;
    }

    .traversal-warning .traversal-status {
        background-color: #fef2f2;
        border: 1px solid #fecaca;
        color: rgb(133, 18, 0);
    }

    /* Chain summary styles */
    .chain-summary {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .chain-summary-item {
        padding: 0.75rem;
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: all 0.2s ease;
        user-select: none;
    }

    .chain-summary-item:hover {
        background-color: #f1f5f9;
        border-color: #cbd5e1;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .chain-summary-item.selected {
        background-color: #fef3c7;
        border-color: #f59e0b;
    }

    .chain-summary-item.highlighted {
        background-color: #fef9e7;
        border-color: #fbbf24;
    }

    .chain-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .chain-indicators {
        display: flex;
        gap: 0.5rem;
        align-items: center;
    }

    .chain-name {
        font-weight: 500;
        color: #374151;
    }

    .chain-status {
        font-size: 0.75rem;
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
        font-weight: 500;
    }

    .chain-status.closed {
        background-color: #e6f2f0;
        color: #166534;
    }

    .chain-status.open {
        background-color: #fef3c7;
        color: #92400e;
    }

    .chain-id {
        font-weight: 600;
        color: rgb(0, 83, 135);
        font-size: 0.875rem;
        font-family: monospace;
    }

    .traversal-status.can-traverse {
        color: rgb(0, 133, 84);
        font-weight: bold;
    }

    .traversal-status.cannot-traverse {
        color: rgb(133, 18, 0);
        font-weight: bold;
    }

    /* Empty state styles */
    .empty-state {
        padding: 1rem;
        text-align: center;
        color: #6b7280;
        font-style: italic;
        background-color: #f9fafb;
        border: 1px dashed #d1d5db;
        border-radius: 0.375rem;
    }

    .empty-state p {
        margin: 0;
        font-size: 0.875rem;
    }

    /* Chain detail panel styles - panel styles now handled by AccordionPanel component */

    .chain-detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px solid #e5e7eb;
    }

    .chain-detail-header .chain-id {
        font-weight: 600;
        color: rgb(0, 83, 135);
        font-size: 1rem;
        font-family: monospace;
    }

    .chain-detail-header .traversal-status {
        font-size: 0.875rem;
        font-weight: 600;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
    }

    .chain-properties {
        display: flex;
        gap: 1rem;
        margin-bottom: 1rem;
    }

    .property {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .property-label {
        font-size: 0.75rem;
        font-weight: 500;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .property-value {
        font-size: 0.875rem;
        font-weight: 600;
        color: #374151;
    }

    .property-value.closed {
        color: rgb(0, 133, 84); /* Green for closed chains */
    }

    .property-value.open {
        color: rgb(133, 18, 0); /* Red for open chains */
    }

    .shapes-title,
    .issues-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: #374151;
        margin: 0 0 0.5rem 0;
    }

    .chain-shapes-list {
        margin-bottom: 1rem;
    }

    .shape-item {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.5rem;
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.25rem;
        margin-bottom: 0.25rem;
        font-size: 0.75rem;
    }

    .shape-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .shape-points {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin-left: 1.5rem;
    }

    .point-info {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }

    .point-label {
        font-weight: 500;
        color: #6b7280;
        min-width: 2.5rem;
    }

    .point-coords {
        font-family: monospace;
        color: #374151;
        background-color: #f3f4f6;
        padding: 0.125rem 0.25rem;
        border-radius: 0.125rem;
        font-size: 0.7rem;
    }

    .shape-index {
        font-weight: 600;
        color: #6b7280;
        min-width: 1.5rem;
    }

    .shape-type {
        font-weight: 500;
        color: #374151;
        text-transform: capitalize;
    }

    .shape-id {
        color: #6b7280;
        font-family: monospace;
    }

    .chain-issues {
        background-color: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 0.375rem;
        padding: 0.75rem;
    }

    .issue-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin-bottom: 0.5rem;
    }

    .issue-item:last-child {
        margin-bottom: 0;
    }

    .issue-type {
        font-size: 0.75rem;
        font-weight: 600;
        color: rgb(133, 18, 0);
        text-transform: capitalize;
    }

    .issue-description {
        font-size: 0.75rem;
        color: #6b7280;
        line-height: 1.4;
    }

    /* Algorithm parameters styles - panel styles now handled by AccordionPanel component */

    .param-group-details {
        background-color: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 0.375rem;
        margin-bottom: 0.75rem;
        overflow: hidden;
    }

    .param-group-details:last-child {
        margin-bottom: 0;
    }

    .param-group-summary {
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: #374151;
        cursor: pointer;
        background-color: #f1f5f9;
        border-bottom: 1px solid #e2e8f0;
        transition: background-color 0.2s ease;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .param-group-summary:hover {
        background-color: #e2e8f0;
    }

    .param-group-summary::marker {
        content: none;
    }

    .param-group-summary::-webkit-details-marker {
        display: none;
    }

    .param-group-summary::after {
        content: '';
        width: 8px;
        height: 12px;
        background-image: url("data:image/svg+xml,%3Csvg width='8' height='12' viewBox='0 0 8 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 6L1 11' stroke='%23374151' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: center;
        transform: rotate(0deg);
        transition: transform 0.2s ease;
        flex-shrink: 0;
    }

    .param-group-details[open] .param-group-summary::after {
        transform: rotate(90deg);
    }

    .param-group-content {
        padding: 0.75rem;
        background-color: white;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .param-label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.75rem;
        font-weight: 500;
        color: #374151;
    }

    .param-input {
        padding: 0.375rem 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        font-size: 0.75rem;
        background-color: white;
        transition: border-color 0.2s ease;
        width: 100%;
    }

    .param-input:focus {
        outline: none;
        border-color: #8b5cf6;
        box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
    }

    .param-checkbox {
        margin-right: 0.5rem;
        width: auto;
    }

    .param-description {
        font-size: 0.7rem;
        color: #6b7280;
        line-height: 1.3;
        margin-top: 0.25rem;
        font-style: italic;
    }

    /* Header action button styles */
    .header-action-button {
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        font-weight: 500;
        border: none;
        border-radius: 0.25rem;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .apply-all-button {
        background-color: rgb(0, 83, 135);
        color: white;
    }

    .apply-all-button:hover:not(:disabled) {
        background-color: rgb(0, 83, 135);
    }

    .apply-all-button:disabled {
        background-color: #9ca3af;
        cursor: not-allowed;
        color: #6b7280;
    }

    .clear-all-button {
        background-color: rgb(133, 18, 0);
        color: white;
    }

    .clear-all-button:hover:not(:disabled) {
        background-color: rgb(133, 18, 0);
    }

    .clear-all-button:disabled {
        background-color: #9ca3af;
        cursor: not-allowed;
        color: #6b7280;
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

    .resize-handle-right {
        right: -3px; /* Half of width to center on border */
    }

    .resize-handle-left {
        left: -3px; /* Half of width to center on border */
    }

    /* Prevent text selection during resize */
    .program-layout.no-select {
        user-select: none;
    }

    /* Show panel styles */
    .show-panel-content {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .show-checkbox-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: #374151;
        cursor: pointer;
        user-select: none;
    }

    .show-checkbox {
        width: 1rem;
        height: 1rem;
        cursor: pointer;
    }

    @media (max-width: 1200px) {
        .left-column,
        .right-column {
            width: 240px;
        }
    }

    @media (max-width: 768px) {
        .program-layout {
            flex-direction: column;
        }

        .left-column,
        .right-column {
            width: 100%;
            height: auto;
            max-height: 200px;
        }

        .center-column {
            flex: 1;
            min-height: 400px;
        }
    }
</style>
