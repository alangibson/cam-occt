import { rapidStore } from './store';

// Helper functions for rapid selection
export function selectRapids(rapidIds: Set<string>) {
    rapidStore.selectRapids(rapidIds);
}

export function toggleRapidSelection(rapidId: string) {
    rapidStore.toggleRapidSelection(rapidId);
}

export function clearRapidSelection() {
    rapidStore.clearSelection();
}

export function highlightRapid(rapidId: string | null) {
    rapidStore.highlightRapid(rapidId);
}

export function clearRapidHighlight() {
    rapidStore.clearHighlight();
}
