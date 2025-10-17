/**
 * Cut Store Interfaces
 *
 * Type definitions for cuts and cut-related data.
 */

import type { Shape } from '$lib/types';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import type { CutLeadResult } from '$lib/stores/operations/interfaces';
import type { Cut } from '$lib/cam/cut/interfaces';

export interface CutsState {
    cuts: Cut[];
    selectedCutId: string | null;
    highlightedCutId: string | null;
    showCutNormals: boolean;
    showCutter: boolean;
    showCutDirections: boolean;
    showCutPaths: boolean;
    showCutStartPoints: boolean;
    showCutEndPoints: boolean;
    showCutTangentLines: boolean;
}

export interface CutsStore {
    subscribe: (run: (value: CutsState) => void) => () => void;
    addCut: (cut: Cut) => void;
    addCuts: (cuts: Cut[]) => void;
    updateCut: (id: string, updates: Partial<Cut>) => void;
    deleteCut: (id: string) => void;
    deleteCutsByOperation: (operationId: string) => void;
    selectCut: (cutId: string | null) => void;
    highlightCut: (cutId: string | null) => void;
    clearHighlight: () => void;
    reorderCuts: (newCuts: Cut[]) => void;
    getCutsByChain: (chainId: string) => Cut[];
    getChainsWithCuts: () => string[];
    updateCutLeadGeometry: (cutId: string, leadGeometry: CutLeadResult) => void;
    clearCutLeadGeometry: (cutId: string) => void;
    updateCutOffsetGeometry: (
        cutId: string,
        offsetGeometry: {
            offsetShapes: Shape[];
            originalShapes: Shape[];
            direction: OffsetDirection;
            kerfWidth: number;
        }
    ) => void;
    clearCutOffsetGeometry: (cutId: string) => void;
    setShowCutNormals: (show: boolean) => void;
    setShowCutter: (show: boolean) => void;
    setShowCutDirections: (show: boolean) => void;
    setShowCutPaths: (show: boolean) => void;
    setShowCutStartPoints: (show: boolean) => void;
    setShowCutEndPoints: (show: boolean) => void;
    setShowCutTangentLines: (show: boolean) => void;
    reset: () => void;
    restore: (cutsState: CutsState) => void;
}
