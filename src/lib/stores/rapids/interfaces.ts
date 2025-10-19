import type { Rapid } from '$lib/cam/rapid/interfaces';

export interface RapidsState {
    rapids: Rapid[];
    showRapids: boolean;
    showRapidDirections: boolean;
    selectedRapidId: string | null;
    highlightedRapidId: string | null;
}

export interface RapidsStore {
    subscribe: (run: (value: RapidsState) => void) => () => void;
    setRapids: (rapids: Rapid[]) => void;
    clearRapids: () => void;
    toggleShowRapids: () => void;
    setShowRapids: (show: boolean) => void;
    setShowRapidDirections: (show: boolean) => void;
    selectRapid: (rapidId: string | null) => void;
    highlightRapid: (rapidId: string | null) => void;
    clearHighlight: () => void;
    reset: () => void;
}
