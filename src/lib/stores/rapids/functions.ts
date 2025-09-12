import { rapidStore } from './store';

// Helper functions for rapid selection
export function selectRapid(rapidId: string | null) {
    rapidStore.selectRapid(rapidId);
}

export function highlightRapid(rapidId: string | null) {
    rapidStore.highlightRapid(rapidId);
}

export function clearRapidHighlight() {
    rapidStore.clearHighlight();
}
