/**
 * Prepare Stage Interfaces
 *
 * Type definitions for the Prepare stage store.
 */

import type { AlgorithmParameters } from '$lib/types/algorithm-parameters';
import type { ChainNormalizationResult } from '$lib/algorithms/chain-normalization/chain-normalization';
import type { Shape } from '$lib/types/geometry';
import type { Chain } from '$lib/geometry/chain/interfaces';

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

    // Chain visualization options
    showChainStartPoints: boolean;
    showChainEndPoints: boolean;
    showChainTangentLines: boolean;
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
    setShowChainStartPoints: (show: boolean) => void;
    setShowChainEndPoints: (show: boolean) => void;
    setShowChainTangentLines: (show: boolean) => void;
}
