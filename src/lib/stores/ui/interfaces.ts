export interface UIState {
    showToolTable: boolean;
}

export interface UIStore {
    subscribe: (run: (value: UIState) => void) => () => void;
    toggleToolTable: () => void;
    showToolTable: () => void;
    hideToolTable: () => void;
}
