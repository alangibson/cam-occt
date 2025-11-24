/**
 * Prepare Stage Store
 *
 * Manages state specific to the Prepare stage including algorithm parameters,
 * chain normalization results, and UI layout preferences.
 */

import { writable, get } from 'svelte/store';
import type { AlgorithmParameters } from '$lib/preprocessing/algorithm-parameters';
import type { ChainNormalizationResult } from '$lib/cam/chain/chain-normalization';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { ChainData } from '$lib/cam/chain/interfaces';
import type { PrepareStageState, PrepareStageStore } from './interfaces';
import { getDefaults } from '$lib/config/defaults/defaults-manager';
import { settingsStore } from '$lib/stores/settings/store';

/**
 * Get algorithm parameters with unit-aware defaults
 */
function getUnitAwareAlgorithmParameters(): AlgorithmParameters {
    const defaults = getDefaults();
    return {
        chainDetection: defaults.chain.detectionParameters,
        chainNormalization: defaults.chain.normalizationParameters,
        partDetection: defaults.algorithm.partDetectionParameters,
        joinColinearLines: defaults.algorithm.joinColinearLinesParameters,
        startPointOptimization:
            defaults.algorithm.startPointOptimizationParameters,
    };
}

function createPrepareStageStore(): PrepareStageStore {
    const { subscribe, set, update } = writable<PrepareStageState>({
        algorithmParams: getUnitAwareAlgorithmParameters(),
        chainNormalizationResults: [],
        leftColumnWidth: 280,
        rightColumnWidth: 280,
        lastAnalysisTimestamp: 0,
        originalShapesBeforeNormalization: null,
        originalChainsBeforeNormalization: null,
        originalShapesBeforeOptimization: null,
        originalChainsBeforeOptimization: null,
        partsDetected: false,
    });

    // Listen for measurement system changes and refresh algorithm parameters
    let currentMeasurementSystem =
        get(settingsStore).settings.measurementSystem;
    settingsStore.subscribe((settingsState) => {
        const newMeasurementSystem = settingsState.settings.measurementSystem;
        if (newMeasurementSystem !== currentMeasurementSystem) {
            currentMeasurementSystem = newMeasurementSystem;
            // Refresh algorithm parameters with new unit conversions
            update((state) => ({
                ...state,
                algorithmParams: getUnitAwareAlgorithmParameters(),
            }));
        }
    });

    return {
        subscribe,

        /**
         * Update algorithm parameters
         */
        setAlgorithmParams: (params: AlgorithmParameters) => {
            update((state) => ({
                ...state,
                algorithmParams: params,
            }));
        },

        /**
         * Update specific algorithm parameter
         */
        updateAlgorithmParam: <K extends keyof AlgorithmParameters>(
            category: K,
            params: Partial<AlgorithmParameters[K]>
        ) => {
            update((state) => ({
                ...state,
                algorithmParams: {
                    ...state.algorithmParams,
                    [category]: {
                        ...state.algorithmParams[category],
                        ...params,
                    },
                },
            }));
        },

        /**
         * Set chain normalization results
         */
        setChainNormalizationResults: (results: ChainNormalizationResult[]) => {
            update((state) => ({
                ...state,
                chainNormalizationResults: results,
                lastAnalysisTimestamp: Date.now(),
            }));
        },

        /**
         * Clear chain normalization results
         */
        clearChainNormalizationResults: () => {
            update((state) => ({
                ...state,
                chainNormalizationResults: [],
                lastAnalysisTimestamp: 0,
            }));
        },

        /**
         * Update UI layout
         */
        setColumnWidths: (leftWidth: number, rightWidth: number) => {
            update((state) => ({
                ...state,
                leftColumnWidth: leftWidth,
                rightColumnWidth: rightWidth,
            }));
        },

        /**
         * Reset to defaults
         */
        reset: () => {
            set({
                algorithmParams: getUnitAwareAlgorithmParameters(),
                chainNormalizationResults: [],
                leftColumnWidth: 280,
                rightColumnWidth: 280,
                lastAnalysisTimestamp: 0,
                originalShapesBeforeNormalization: null,
                originalChainsBeforeNormalization: null,
                originalShapesBeforeOptimization: null,
                originalChainsBeforeOptimization: null,
                partsDetected: false,
            });
        },

        /**
         * Get chain normalization result for specific chain
         */
        getChainNormalizationResult: (
            chainId: string
        ): ChainNormalizationResult | null => {
            let result: ChainNormalizationResult | null = null;
            update((state) => {
                result =
                    state.chainNormalizationResults.find(
                        (r) => r.chainId === chainId
                    ) || null;
                return state;
            });
            return result;
        },

        /**
         * Save original state before normalization
         */
        saveOriginalStateForNormalization: (
            shapes: ShapeData[],
            chains: ChainData[]
        ) => {
            update((state) => ({
                ...state,
                originalShapesBeforeNormalization: JSON.parse(
                    JSON.stringify(shapes)
                ),
                originalChainsBeforeNormalization: JSON.parse(
                    JSON.stringify(chains)
                ),
            }));
        },

        /**
         * Restore original state from before normalization
         */
        restoreOriginalStateFromNormalization: (): {
            shapes: ShapeData[];
            chains: ChainData[];
        } | null => {
            let result: { shapes: ShapeData[]; chains: ChainData[] } | null =
                null;
            update((state) => {
                if (
                    state.originalShapesBeforeNormalization &&
                    state.originalChainsBeforeNormalization
                ) {
                    result = {
                        shapes: JSON.parse(
                            JSON.stringify(
                                state.originalShapesBeforeNormalization
                            )
                        ),
                        chains: JSON.parse(
                            JSON.stringify(
                                state.originalChainsBeforeNormalization
                            )
                        ),
                    };
                }
                return state;
            });
            return result;
        },

        /**
         * Clear saved original state
         */
        clearOriginalNormalizationState: () => {
            update((state) => ({
                ...state,
                originalShapesBeforeNormalization: null,
                originalChainsBeforeNormalization: null,
            }));
        },

        /**
         * Save original state before optimization
         */
        saveOriginalStateForOptimization: (
            shapes: ShapeData[],
            chains: ChainData[]
        ) => {
            update((state) => ({
                ...state,
                originalShapesBeforeOptimization: JSON.parse(
                    JSON.stringify(shapes)
                ),
                originalChainsBeforeOptimization: JSON.parse(
                    JSON.stringify(chains)
                ),
            }));
        },

        /**
         * Restore original state from before optimization
         */
        restoreOriginalStateFromOptimization: (): {
            shapes: ShapeData[];
            chains: ChainData[];
        } | null => {
            let result: { shapes: ShapeData[]; chains: ChainData[] } | null =
                null;
            update((state) => {
                if (
                    state.originalShapesBeforeOptimization &&
                    state.originalChainsBeforeOptimization
                ) {
                    result = {
                        shapes: JSON.parse(
                            JSON.stringify(
                                state.originalShapesBeforeOptimization
                            )
                        ),
                        chains: JSON.parse(
                            JSON.stringify(
                                state.originalChainsBeforeOptimization
                            )
                        ),
                    };
                }
                return state;
            });
            return result;
        },

        /**
         * Clear saved original optimization state
         */
        clearOriginalOptimizationState: () => {
            update((state) => ({
                ...state,
                originalShapesBeforeOptimization: null,
                originalChainsBeforeOptimization: null,
            }));
        },

        /**
         * Set parts detection state
         */
        setPartsDetected: (detected: boolean) => {
            update((state) => ({
                ...state,
                partsDetected: detected,
            }));
        },
    };
}

export const prepareStageStore: ReturnType<typeof createPrepareStageStore> =
    createPrepareStageStore();
