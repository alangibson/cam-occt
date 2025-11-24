/**
 * Prepare Stage Interfaces
 *
 * Type definitions for the Prepare stage store.
 */

import type { AlgorithmParameters } from '$lib/preprocessing/algorithm-parameters';
import type { ChainNormalizationResult } from '$lib/cam/chain/chain-normalization';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { ChainData } from '$lib/cam/chain/interfaces';

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
    originalShapesBeforeNormalization: ShapeData[] | null;
    originalChainsBeforeNormalization: ChainData[] | null;
    originalShapesBeforeOptimization: ShapeData[] | null;
    originalChainsBeforeOptimization: ChainData[] | null;
    partsDetected: boolean;
}

export interface PrepareStageStore {
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
        shapes: ShapeData[],
        chains: ChainData[]
    ) => void;
    restoreOriginalStateFromNormalization: () => {
        shapes: ShapeData[];
        chains: ChainData[];
    } | null;
    clearOriginalNormalizationState: () => void;
    saveOriginalStateForOptimization: (
        shapes: ShapeData[],
        chains: ChainData[]
    ) => void;
    restoreOriginalStateFromOptimization: () => {
        shapes: ShapeData[];
        chains: ChainData[];
    } | null;
    clearOriginalOptimizationState: () => void;
    setPartsDetected: (detected: boolean) => void;
}
