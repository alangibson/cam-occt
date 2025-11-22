/**
 * Cut Store Interfaces
 *
 * Type definitions for cuts and cut-related data.
 */

export interface CutsState {
    selectedCutIds: Set<string>;
    highlightedCutId: string | null;
    showCutNormals: boolean;
    showCutDirections: boolean;
    showCutPaths: boolean;
    showCutStartPoints: boolean;
    showCutEndPoints: boolean;
    showCutTangentLines: boolean;
}

export interface CutsStore {
    subscribe: (run: (value: CutsState) => void) => () => void;
    selectCut: (cutId: string | null, multi?: boolean) => void;
    deselectCut: (cutId: string) => void;
    toggleCutSelection: (cutId: string) => void;
    highlightCut: (cutId: string | null) => void;
    clearHighlight: () => void;
    setShowCutNormals: (show: boolean) => void;
    setShowCutDirections: (show: boolean) => void;
    setShowCutPaths: (show: boolean) => void;
    setShowCutStartPoints: (show: boolean) => void;
    setShowCutEndPoints: (show: boolean) => void;
    setShowCutTangentLines: (show: boolean) => void;
    reset: () => void;
    restore: (cutsState: CutsState) => void;
}
