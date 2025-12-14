/**
 * Auto-preprocessing functionality
 *
 * Applies preprocessing steps automatically after file import based on user settings
 */

import { settingsStore } from '$lib/stores/settings/store.svelte';
import { drawingStore } from '$lib/stores/drawing/store.svelte';
import { PreprocessingStep } from '$lib/config/settings/enums';
import { decomposePolylines } from '$lib/cam/preprocess/decompose-polylines/decompose-polylines';
import { deduplicateShapes } from '$lib/cam/preprocess/dedupe-shapes/functions';
import { joinColinearLines } from '$lib/cam/preprocess/join-colinear-lines';
import { translateToPositiveQuadrant } from '$lib/algorithms/translate-to-positive/translate-to-positive';
import { optimizeStartPoints } from '$lib/algorithms/optimize-start-points/optimize-start-points';
import type { AlgorithmParameters } from '$lib/cam/preprocess/algorithm-parameters';
import { Shape } from '$lib/cam/shape/classes';
import { resetDownstreamStages } from '$lib/stores/drawing/functions';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import { getDefaults } from '$lib/config/defaults/defaults-manager';

/**
 * Apply all enabled preprocessing steps in order
 */
const STEP_DELAY_MS = 50;

export async function applyAutoPreprocessing(): Promise<void> {
    const enabledSteps = settingsStore.settings.enabledPreprocessingSteps;

    // Get algorithm parameters from defaults
    const defaults = getDefaults();
    const algorithmParams: AlgorithmParameters = {
        chainDetection: defaults.chain.detectionParameters,
        chainNormalization: defaults.chain.normalizationParameters,
        partDetection: defaults.algorithm.partDetectionParameters,
        joinColinearLines: defaults.algorithm.joinColinearLinesParameters,
        startPointOptimization:
            defaults.algorithm.startPointOptimizationParameters,
    };

    // Apply each enabled step in order
    for (const step of enabledSteps) {
        try {
            await applyPreprocessingStep(step, algorithmParams);
            // Add small delay to allow UI to update
            await new Promise((resolve) => setTimeout(resolve, STEP_DELAY_MS));
        } catch {
            // Continue with other steps even if one fails
        }
    }
}

/**
 * Apply a single preprocessing step
 */
async function applyPreprocessingStep(
    step: PreprocessingStep,
    algorithmParams: AlgorithmParameters
): Promise<void> {
    const drawing = drawingStore.drawing;

    if (!drawing || !drawing.shapes || drawing.shapes.length === 0) {
        return;
    }

    switch (step) {
        case PreprocessingStep.DecomposePolylines:
            Object.values(drawing.layers).forEach((layer) => {
                const decomposedShapes = decomposePolylines(layer.shapes);
                layer.shapes = decomposedShapes;
            });
            resetDownstreamStages(WorkflowStage.PROGRAM);
            break;

        case PreprocessingStep.DeduplicateShapes:
            for (const layer of Object.values(drawing.layers)) {
                const deduplicatedShapes = await deduplicateShapes(
                    layer.shapes
                );
                layer.shapes = deduplicatedShapes;
            }
            resetDownstreamStages(WorkflowStage.PROGRAM);
            break;

        case PreprocessingStep.JoinColinearLines:
            Object.values(drawing.layers).forEach((layer) => {
                // Join collinear lines in the layer's chains
                const joinedChains = joinColinearLines(
                    layer.chains,
                    algorithmParams.joinColinearLines
                );

                // Extract all shapes from the joined chains
                const joinedShapes = joinedChains.flatMap(
                    (chain) => chain.shapes
                );

                // Update the layer with the joined shapes
                layer.shapes = joinedShapes;
            });
            resetDownstreamStages(WorkflowStage.PROGRAM);
            break;

        case PreprocessingStep.TranslateToPositive:
            translateToPositiveQuadrant(drawing);
            resetDownstreamStages(WorkflowStage.PROGRAM);
            break;

        case PreprocessingStep.OptimizeStarts:
            // Get all chains from all layers
            const allChains = Object.values(drawing.layers).flatMap(
                (layer) => layer.chains
            );

            if (allChains.length === 0) {
                return;
            }

            // Optimize start points for all chains
            const optimizedShapes = optimizeStartPoints(
                allChains,
                algorithmParams.startPointOptimization
            );

            // Group optimized shapes by layer
            const optimizedByLayer: Record<string, Shape[]> = {};
            optimizedShapes.forEach((shape) => {
                const layerName = shape.layer || '0';
                if (!optimizedByLayer[layerName]) {
                    optimizedByLayer[layerName] = [];
                }
                optimizedByLayer[layerName].push(shape);
            });

            // Update each layer with its optimized shapes
            Object.entries(optimizedByLayer).forEach(([layerName, shapes]) => {
                const layer = drawing.layers[layerName];
                if (layer) {
                    layer.shapes = shapes;
                }
            });

            resetDownstreamStages(WorkflowStage.PROGRAM);
            break;

        default:
        // Unknown preprocessing step
    }
}
