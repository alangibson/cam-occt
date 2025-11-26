/**
 * Auto-preprocessing functionality
 *
 * Applies preprocessing steps automatically after file import based on user settings
 */

import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings/store';
import { drawingStore } from '$lib/stores/drawing/store';
import { prepareStageStore } from '$lib/stores/prepare-stage/store';
import { PreprocessingStep } from '$lib/config/settings/enums';
import { decomposePolylines } from '$lib/algorithms/decompose-polylines/decompose-polylines';
import { joinColinearLines } from '$lib/algorithms/join-colinear-lines';
import { translateToPositiveQuadrant } from '$lib/algorithms/translate-to-positive/translate-to-positive';
import { detectShapeChains } from '$lib/cam/chain/chain-detection';
import { optimizeStartPoints } from '$lib/algorithms/optimize-start-points/optimize-start-points';
import type { AlgorithmParameters } from '$lib/preprocessing/algorithm-parameters';
import { Shape } from '$lib/cam/shape/classes';

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
            const chainsForJoin = detectShapeChains(
                drawing.shapes.map((s) => new Shape(s)),
                {
                    tolerance: algorithmParams.chainDetection.tolerance,
                }
            );

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

        case PreprocessingStep.OptimizeStarts:
            console.log('Applying: Optimize Starts');
            const currentDrawing4 = get(drawingStore).drawing;
            if (!currentDrawing4) {
                console.warn('No drawing available. Skipping optimization.');
                return;
            }

            // Get chains from drawing layers
            const detectedChains2 = Object.values(
                currentDrawing4.layers
            ).flatMap((layer) => layer.chains);
            if (detectedChains2.length === 0) {
                console.warn('No chains detected. Skipping optimization.');
                return;
            }

            if (currentDrawing4.shapes) {
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

                // Chains auto-regenerate from layers after shapes are replaced
                const updatedDrawing2 = get(drawingStore).drawing;
                const optimizedChains = updatedDrawing2
                    ? Object.values(updatedDrawing2.layers).flatMap(
                          (layer) => layer.chains
                      )
                    : [];

                console.log(
                    `Optimized start points. Re-detected ${optimizedChains.length} chains.`
                );
            }
            break;

        default:
            console.warn(`Unknown preprocessing step: ${step}`);
    }
}
