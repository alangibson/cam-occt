export interface RapidsState {
    showRapids: boolean;
    showRapidDirections: boolean;
}

export interface RapidsStore {
    subscribe: (run: (value: RapidsState) => void) => () => void;
    toggleShowRapids: () => void;
    setShowRapids: (show: boolean) => void;
    setShowRapidDirections: (show: boolean) => void;
    reset: () => void;
}
