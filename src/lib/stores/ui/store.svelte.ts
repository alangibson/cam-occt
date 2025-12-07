import type { UIState } from './interfaces';

class UIStore {
    toolTableVisible = $state(false);
    settingsVisible = $state(false);

    toggleToolTable() {
        this.toolTableVisible = !this.toolTableVisible;
    }

    showToolTable() {
        this.toolTableVisible = true;
    }

    hideToolTable() {
        this.toolTableVisible = false;
    }

    toggleSettings() {
        this.settingsVisible = !this.settingsVisible;
    }

    showSettings() {
        this.settingsVisible = true;
    }

    hideSettings() {
        this.settingsVisible = false;
    }

    restore(state: UIState) {
        this.toolTableVisible = state.showToolTable;
        this.settingsVisible = state.showSettings;
    }
}

export const uiStore = new UIStore();
