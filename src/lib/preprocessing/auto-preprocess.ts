/**
 * Auto-preprocessing functionality
 *
 * Applies preprocessing steps automatically after file import based on user settings
 */

import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings/store';
import { drawingStore } from '$lib/stores/drawing/store';
import { chainStore } from '$lib/stores/chains/store';
import { partStore } from '$lib/stores/parts/store';
import { tessellationStore } from '$lib/stores/tessellation/store';
import { prepareStageStore } from '$lib/stores/prepare-stage/store';
import { PreprocessingStep } from '$lib/stores/settings/interfaces';
import { decomposePolylines } from '$lib/algorithms/decompose-polylines/decompose-polylines';
import { joinColinearLines } from '$lib/algorithms/join-colinear-lines';
import { translateToPositiveQuadrant } from '$lib/algorithms/translate-to-positive/translate-to-positive';
import { detectShapeChains } from '$lib/geometry/chain/chain-detection';
import {
    normalizeChain,
    analyzeChainTraversal,
} from '$lib/geometry/chain/chain-normalization';
import { optimizeStartPoints } from '$lib/algorithms/optimize-start-points/optimize-start-points';
import {
    detectParts,
    type PartDetectionWarning,
} from '$lib/cam/part/part-detection';
import { isChainClosed } from '$lib/geometry/chain/functions';
import {
    getShapeEndPoint,
    getShapeStartPoint,
    tessellateShape,
} from '$lib/geometry/shape/functions';
import type { TessellationPoint } from '$lib/stores/tessellation/interfaces';
import type { AlgorithmParameters } from '$lib/preprocessing/algorithm-parameters';

/**
 * Apply all enabled preprocessing steps in order
 */
const STEP_DELAY_MS = 50;

export async function applyAutoPreprocessing(): Promise<void> {
    const settings = get(settingsStore);
    const enabledSteps = settings.settings.enabledPreprocessingSteps;

    console.log(
        'Starting auto-preprocessing with enabled steps:',
        enabledSteps
    );

    // Get algorithm parameters from store
    const algorithmParams = get(prepareStageStore).algorithmParams;

    // Apply each enabled step in order
    for (const step of enabledSteps) {
        try {
            await applyPreprocessingStep(step, algorithmParams);
            // Add small delay to allow UI to update
            await new Promise((resolve) => setTimeout(resolve, STEP_DELAY_MS));
        } catch (error) {
            console.error(`Error applying preprocessing step ${step}:`, error);
            // Continue with other steps even if one fails
        }
    }

    console.log('Auto-preprocessing complete');
}

/**
 * Apply a single preprocessing step
 */
async function applyPreprocessingStep(
    step: PreprocessingStep,
    algorithmParams: AlgorithmParameters
): Promise<void> {
    const drawing = get(drawingStore).drawing;

    if (!drawing || !drawing.shapes || drawing.shapes.length === 0) {
        console.warn(`No drawing available for step ${step}`);
        return;
    }

    switch (step) {
        case PreprocessingStep.DecomposePolylines:
            console.log('Applying: Decompose Polylines');
            const decomposedShapes = decomposePolylines(drawing.shapes);
            drawingStore.replaceAllShapes(decomposedShapes);
            break;

        case PreprocessingStep.JoinColinearLines:
            console.log('Applying: Join Co-linear Lines');
            // First detect chains from current shapes
            const chainsForJoin = detectShapeChains(drawing.shapes, {
                tolerance: algorithmParams.chainDetection.tolerance,
            });

            // Join collinear lines in the chains
            const joinedChains = joinColinearLines(
                chainsForJoin,
                algorithmParams.joinColinearLines
            );

            // Extract all shapes from the joined chains
            const allJoinedShapes = joinedChains.flatMap(
                (chain) => chain.shapes
            );

            // Update the drawing with the joined shapes
            drawingStore.replaceAllShapes(allJoinedShapes);
            break;

        case PreprocessingStep.TranslateToPositive:
            console.log('Applying: Translate to Positive');
            const currentDrawing = get(drawingStore).drawing;
            if (currentDrawing && currentDrawing.shapes) {
                const translatedShapes = translateToPositiveQuadrant(
                    currentDrawing.shapes
                );
                drawingStore.replaceAllShapes(translatedShapes);
            }
            break;

        case PreprocessingStep.DetectChains:
            console.log('Applying: Detect Chains');
            const currentDrawing2 = get(drawingStore).drawing;
            if (currentDrawing2 && currentDrawing2.shapes) {
                // Update tolerance in store
                chainStore.setTolerance(
                    algorithmParams.chainDetection.tolerance
                );

                // Detect chains and update store
                const chains = detectShapeChains(currentDrawing2.shapes, {
                    tolerance: algorithmParams.chainDetection.tolerance,
                });
                chainStore.setChains(chains);

                console.log(`Detected ${chains.length} chains`);
            }
            break;

        case PreprocessingStep.NormalizeChains:
            console.log('Applying: Normalize Chains');
            const detectedChains = get(chainStore).chains;
            if (detectedChains.length === 0) {
                console.warn('No chains detected. Skipping normalization.');
                return;
            }

            const currentDrawing3 = get(drawingStore).drawing;
            if (currentDrawing3 && currentDrawing3.shapes) {
                // Save original state before normalization
                prepareStageStore.saveOriginalStateForNormalization(
                    currentDrawing3.shapes,
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

                // Re-detect chains after normalization
                const newChains = detectShapeChains(normalizedShapes, {
                    tolerance: algorithmParams.chainDetection.tolerance,
                });
                chainStore.setChains(newChains);

                // Update chain normalization analysis
                const newResults = analyzeChainTraversal(
                    newChains,
                    algorithmParams.chainNormalization
                );
                prepareStageStore.setChainNormalizationResults(newResults);

                console.log(
                    `Normalized chains. Re-detected ${newChains.length} chains.`
                );
            }
            break;

        case PreprocessingStep.OptimizeStarts:
            console.log('Applying: Optimize Starts');
            const detectedChains2 = get(chainStore).chains;
            if (detectedChains2.length === 0) {
                console.warn('No chains detected. Skipping optimization.');
                return;
            }

            const currentDrawing4 = get(drawingStore).drawing;
            if (currentDrawing4 && currentDrawing4.shapes) {
                // Save original state before optimization
                prepareStageStore.saveOriginalStateForOptimization(
                    currentDrawing4.shapes,
                    detectedChains2
                );

                // Optimize start points for all chains
                const optimizedShapes = optimizeStartPoints(
                    detectedChains2,
                    algorithmParams.startPointOptimization
                );

                // Update the drawing store with optimized shapes
                drawingStore.replaceAllShapes(optimizedShapes);

                // Re-detect chains after optimization
                const newChains = detectShapeChains(optimizedShapes, {
                    tolerance: algorithmParams.chainDetection.tolerance,
                });
                chainStore.setChains(newChains);

                console.log(
                    `Optimized start points. Re-detected ${newChains.length} chains.`
                );
            }
            break;

        case PreprocessingStep.DetectParts:
            console.log('Applying: Detect Parts');
            const detectedChains3 = get(chainStore).chains;
            if (detectedChains3.length === 0) {
                console.warn('No chains detected. Skipping part detection.');
                return;
            }

            // Add warnings for open chains first
            const openChainWarnings: PartDetectionWarning[] = [];
            for (const chain of detectedChains3) {
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
                detectedChains3,
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
                const tessellationPoints: TessellationPoint[] = [];

                for (const chain of detectedChains3) {
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
                    `Generated ${tessellationPoints.length} tessellation points`
                );
            }

            console.log(
                `Detected ${partResult.parts.length} parts with ${allWarnings.length} warnings`
            );
            break;

        default:
            console.warn(`Unknown preprocessing step: ${step}`);
    }
}
