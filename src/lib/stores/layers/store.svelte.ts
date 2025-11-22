class LayerStore {
    selectedLayerId = $state<string | null>(null);
    highlightedLayerId = $state<string | null>(null);

    selectLayer(layerId: string | null) {
        this.selectedLayerId = layerId;
    }

    clearSelection() {
        this.selectedLayerId = null;
    }

    highlightLayer(layerId: string | null) {
        this.highlightedLayerId = layerId;
    }

    clearHighlight() {
        this.highlightedLayerId = null;
    }
}

export const layerStore = new LayerStore();
