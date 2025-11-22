export interface RapidsState {
    showRapids: boolean;
    showRapidDirections: boolean;
    selectedRapidIds: Set<string>;
    highlightedRapidId: string | null;
}

export interface RapidsStore {
    subscribe: (run: (value: RapidsState) => void) => () => void;
    toggleShowRapids: () => void;
    setShowRapids: (show: boolean) => void;
    setShowRapidDirections: (show: boolean) => void;
    selectRapids: (rapidIds: Set<string>) => void;
    toggleRapidSelection: (rapidId: string) => void;
    clearSelection: () => void;
    highlightRapid: (rapidId: string | null) => void;
    clearHighlight: () => void;
    reset: () => void;
}
