import { writable } from 'svelte/store';
import type { PartStore } from './interfaces';
import type { PartDetectionWarning } from '$lib/cam/part/interfaces';

function createPartStore() {
    const initialState: PartStore = {
        warnings: [],
        highlightedPartId: null,
        hoveredPartId: null,
        selectedPartIds: new Set(),
    };

    const { subscribe, update } = writable<PartStore>(initialState);

    // Main store functions
    function setWarnings(warnings: PartDetectionWarning[] = []) {
        update((state) => ({
            ...state,
            warnings,
        }));
    }

    function clearParts() {
        update((state) => ({
            ...state,
            warnings: [],
            highlightedPartId: null,
            hoveredPartId: null,
            selectedPartIds: new Set(),
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
    function selectPart(partId: string | null, multi = false) {
        update((state) => {
            if (partId === null) {
                return {
                    ...state,
                    selectedPartIds: new Set(),
                };
            }

            const selectedPartIds = new Set(multi ? state.selectedPartIds : []);
            selectedPartIds.add(partId);
            return {
                ...state,
                selectedPartIds,
            };
        });
    }

    function deselectPart(partId: string) {
        update((state) => {
            const selectedPartIds = new Set(state.selectedPartIds);
            selectedPartIds.delete(partId);
            return {
                ...state,
                selectedPartIds,
            };
        });
    }

    function togglePartSelection(partId: string) {
        update((state) => {
            const selectedPartIds = new Set(state.selectedPartIds);
            if (selectedPartIds.has(partId)) {
                selectedPartIds.delete(partId);
            } else {
                selectedPartIds.add(partId);
            }
            return {
                ...state,
                selectedPartIds,
            };
        });
    }

    function clearPartSelection() {
        update((state) => ({
            ...state,
            selectedPartIds: new Set(),
        }));
    }

    return {
        subscribe,
        setWarnings,
        clearParts,
        highlightPart,
        clearHighlight,
        hoverPart,
        clearPartHover,
        selectPart,
        deselectPart,
        togglePartSelection,
        clearPartSelection,
    };
}

export const partStore = createPartStore();
