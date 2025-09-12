import { writable } from 'svelte/store';
import type { PartStore } from './interfaces';
import type {
    DetectedPart,
    PartDetectionWarning,
} from '$lib/algorithms/part-detection/part-detection';

function createPartStore() {
    const initialState: PartStore = {
        parts: [],
        warnings: [],
        highlightedPartId: null,
        hoveredPartId: null,
        selectedPartId: null,
    };

    const { subscribe, update } = writable<PartStore>(initialState);

    // Main store functions
    function setParts(
        parts: DetectedPart[],
        warnings: PartDetectionWarning[] = []
    ) {
        update((state) => ({
            ...state,
            parts,
            warnings,
        }));
    }

    function clearParts() {
        update((state) => ({
            ...state,
            parts: [],
            warnings: [],
            highlightedPartId: null,
            hoveredPartId: null,
            selectedPartId: null,
        }));
    }

    // Part highlighting functions
    function highlightPart(partId: string) {
        update((state) => ({
            ...state,
            highlightedPartId: partId,
        }));
    }

    function clearHighlight() {
        update((state) => ({
            ...state,
            highlightedPartId: null,
        }));
    }

    // Part hover functions
    function hoverPart(partId: string | null) {
        update((state) => ({
            ...state,
            hoveredPartId: partId,
        }));
    }

    function clearPartHover() {
        update((state) => ({
            ...state,
            hoveredPartId: null,
        }));
    }

    // Part selection functions
    function selectPart(partId: string | null) {
        update((state) => ({
            ...state,
            selectedPartId: partId,
        }));
    }

    function clearPartSelection() {
        update((state) => ({
            ...state,
            selectedPartId: null,
        }));
    }

    return {
        subscribe,
        setParts,
        clearParts,
        highlightPart,
        clearHighlight,
        hoverPart,
        clearPartHover,
        selectPart,
        clearPartSelection,
    };
}

export const partStore = createPartStore();
