import { writable } from 'svelte/store';
import type { RapidsState, RapidsStore } from './interfaces';

function createRapidsStore(): RapidsStore {
    const initialState: RapidsState = {
        showRapids: true,
        showRapidDirections: false,
        selectedRapidIds: new Set(),
        highlightedRapidId: null,
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

        selectRapids: (rapidIds: Set<string>) => {
            update((state) => ({
                ...state,
                selectedRapidIds: new Set(rapidIds),
            }));
        },

        toggleRapidSelection: (rapidId: string) => {
            update((state) => {
                const newSelection = new Set(state.selectedRapidIds);
                if (newSelection.has(rapidId)) {
                    newSelection.delete(rapidId);
                } else {
                    newSelection.add(rapidId);
                }
                return {
                    ...state,
                    selectedRapidIds: newSelection,
                };
            });
        },

        clearSelection: () => {
            update((state) => ({
                ...state,
                selectedRapidIds: new Set(),
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

        reset: () =>
            set({
                showRapids: true,
                showRapidDirections: false,
                selectedRapidIds: new Set(),
                highlightedRapidId: null,
            }),
    };
}

export const rapidStore: ReturnType<typeof createRapidsStore> =
    createRapidsStore();
