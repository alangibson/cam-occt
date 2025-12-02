import { writable } from 'svelte/store';
import type { CutsState, CutsStore } from './interfaces';

function createCutsStore(): CutsStore {
    const initialState: CutsState = {
        showCutNormals: false,
        showCutDirections: false,
        showCutPaths: true,
        showCutStartPoints: false,
        showCutEndPoints: false,
        showCutTangentLines: false,
    };

    const { subscribe, set, update } = writable<CutsState>(initialState);

    return {
        subscribe,

        setShowCutNormals: (show: boolean) => {
            update((state) => ({
                ...state,
                showCutNormals: show,
            }));
        },

        setShowCutDirections: (show: boolean) => {
            update((state) => ({
                ...state,
                showCutDirections: show,
            }));
        },

        setShowCutPaths: (show: boolean) => {
            update((state) => ({
                ...state,
                showCutPaths: show,
            }));
        },

        setShowCutStartPoints: (show: boolean) => {
            update((state) => ({
                ...state,
                showCutStartPoints: show,
            }));
        },

        setShowCutEndPoints: (show: boolean) => {
            update((state) => ({
                ...state,
                showCutEndPoints: show,
            }));
        },

        setShowCutTangentLines: (show: boolean) => {
            update((state) => ({
                ...state,
                showCutTangentLines: show,
            }));
        },

        reset: () => {
            set({
                showCutNormals: false,
                showCutDirections: false,
                showCutPaths: true,
                showCutStartPoints: false,
                showCutEndPoints: false,
                showCutTangentLines: false,
            });
        },

        // Restore state from persistence (preserves IDs and calculated data)
        restore: (cutsState: CutsState) => {
            set(cutsState);
        },
    };
}

export const cutStore: ReturnType<typeof createCutsStore> = createCutsStore();
