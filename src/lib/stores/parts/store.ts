import { writable } from 'svelte/store';
import type { PartStore } from './interfaces';
import type { PartDetectionWarning } from '$lib/cam/part/interfaces';

function createPartStore() {
    const initialState: PartStore = {
        warnings: [],
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
        }));
    }

    return {
        subscribe,
        setWarnings,
        clearParts,
    };
}

export const partStore = createPartStore();
