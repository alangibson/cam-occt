/**
 * Prepare Stage Store
 *
 * Manages state specific to the Prepare stage including algorithm parameters,
 * chain normalization results, and UI layout preferences.
 */

import { writable } from 'svelte/store';
import type { AlgorithmParameters } from '../../lib/types/algorithm-parameters';
import { DEFAULT_ALGORITHM_PARAMETERS } from '../../lib/types/algorithm-parameters';
import type { ChainNormalizationResult } from '../algorithms/chain-normalization/chain-normalization';
import type { Shape } from '../types/geometry';
import type { Chain } from '../algorithms/chain-detection/chain-detection';

export interface PrepareStageState {
    // Algorithm parameters
    algorithmParams: AlgorithmParameters;

    // Chain normalization results (expensive to recalculate)
    chainNormalizationResults: ChainNormalizationResult[];

    // UI layout preferences
    leftColumnWidth: number;
    rightColumnWidth: number;

    // Analysis flags
    lastAnalysisTimestamp: number;

    // State tracking for undo operations
    originalShapesBeforeNormalization: Shape[] | null;
    originalChainsBeforeNormalization: Chain[] | null;
    originalShapesBeforeOptimization: Shape[] | null;
    originalChainsBeforeOptimization: Chain[] | null;
    partsDetected: boolean;
}

function createPrepareStageStore(): {
    subscribe: (run: (value: PrepareStageState) => void) => () => void;
    setAlgorithmParams: (params: AlgorithmParameters) => void;
    updateAlgorithmParam: <K extends keyof AlgorithmParameters>(
        category: K,
        params: Partial<AlgorithmParameters[K]>
    ) => void;
    setChainNormalizationResults: (results: ChainNormalizationResult[]) => void;
    clearChainNormalizationResults: () => void;
    setColumnWidths: (leftWidth: number, rightWidth: number) => void;
    reset: () => void;
    getChainNormalizationResult: (
        chainId: string
    ) => ChainNormalizationResult | null;
    saveOriginalStateForNormalization: (
        shapes: Shape[],
        chains: Chain[]
    ) => void;
    restoreOriginalStateFromNormalization: () => {
        shapes: Shape[];
        chains: Chain[];
    } | null;
    clearOriginalNormalizationState: () => void;
    saveOriginalStateForOptimization: (
        shapes: Shape[],
        chains: Chain[]
    ) => void;
    restoreOriginalStateFromOptimization: () => {
        shapes: Shape[];
        chains: Chain[];
    } | null;
    clearOriginalOptimizationState: () => void;
    setPartsDetected: (detected: boolean) => void;
} {
    const { subscribe, set, update } = writable<PrepareStageState>({
        algorithmParams: { ...DEFAULT_ALGORITHM_PARAMETERS },
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
                algorithmParams: { ...DEFAULT_ALGORITHM_PARAMETERS },
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
            shapes: Shape[],
            chains: Chain[]
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
            shapes: Shape[];
            chains: Chain[];
        } | null => {
            let result: { shapes: Shape[]; chains: Chain[] } | null = null;
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
            shapes: Shape[],
            chains: Chain[]
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
            shapes: Shape[];
            chains: Chain[];
        } | null => {
            let result: { shapes: Shape[]; chains: Chain[] } | null = null;
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
