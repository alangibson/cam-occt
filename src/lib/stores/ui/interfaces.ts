export interface UIState {
    showToolTable: boolean;
    showSettings: boolean;
}

export interface UIStore {
    subscribe: (run: (value: UIState) => void) => () => void;
    toggleToolTable: () => void;
    showToolTable: () => void;
    hideToolTable: () => void;
    toggleSettings: () => void;
    showSettings: () => void;
    hideSettings: () => void;
}
