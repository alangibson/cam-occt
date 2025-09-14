import { writable } from 'svelte/store';
import type { RapidsState, RapidsStore } from './interfaces';
import type { Rapid } from '$lib/algorithms/optimize-cut-order/optimize-cut-order';

function createRapidsStore(): RapidsStore {
    const initialState: RapidsState = {
        rapids: [],
        showRapids: true,
        selectedRapidId: null,
        highlightedRapidId: null,
    };

    const { subscribe, set, update } = writable<RapidsState>(initialState);

    return {
        subscribe,

        setRapids: (rapids: Rapid[]) => {
            update((state) => ({
                ...state,
                rapids,
            }));
        },

        clearRapids: () => {
            update((state) => ({
                ...state,
                rapids: [],
            }));
        },

        toggleShowRapids: () => {
            update((state) => ({
                ...state,
                showRapids: !state.showRapids,
            }));
        },

        setShowRapids: (show: boolean) => {
            update((state) => ({
                ...state,
                showRapids: show,
            }));
        },

        selectRapid: (rapidId: string | null) => {
            update((state) => ({
                ...state,
                selectedRapidId: rapidId,
            }));
        },

        highlightRapid: (rapidId: string | null) => {
            update((state) => ({
                ...state,
                highlightedRapidId: rapidId,
            }));
        },

        clearHighlight: () => {
            update((state) => ({
                ...state,
                highlightedRapidId: null,
            }));
        },

        reset: () => set(initialState),
    };
}

export const rapidStore: ReturnType<typeof createRapidsStore> =
    createRapidsStore();
