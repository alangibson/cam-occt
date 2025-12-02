import { writable } from 'svelte/store';
import type { RapidsState, RapidsStore } from './interfaces';

function createRapidsStore(): RapidsStore {
    const initialState: RapidsState = {
        showRapids: true,
        showRapidDirections: false,
    };

    const { subscribe, set, update } = writable<RapidsState>(initialState);

    return {
        subscribe,

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

        setShowRapidDirections: (show: boolean) => {
            update((state) => ({
                ...state,
                showRapidDirections: show,
            }));
        },

        reset: () =>
            set({
                showRapids: true,
                showRapidDirections: false,
            }),
    };
}

export const rapidStore: ReturnType<typeof createRapidsStore> =
    createRapidsStore();
