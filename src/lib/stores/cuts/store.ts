import { writable } from 'svelte/store';
import type { CutsState, CutsStore } from './interfaces';

function createCutsStore(): CutsStore {
    const initialState: CutsState = {
        selectedCutIds: new Set(),
        highlightedCutId: null,
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

        selectCut: (cutId: string | null, multi = false) => {
            update((state) => {
                if (cutId === null) {
                    return {
                        ...state,
                        selectedCutIds: new Set(),
                    };
                }

                const selectedCutIds = new Set(
                    multi ? state.selectedCutIds : []
                );
                selectedCutIds.add(cutId);
                return {
                    ...state,
                    selectedCutIds,
                };
            });
        },

        deselectCut: (cutId: string) => {
            update((state) => {
                const selectedCutIds = new Set(state.selectedCutIds);
                selectedCutIds.delete(cutId);
                return {
                    ...state,
                    selectedCutIds,
                };
            });
        },

        toggleCutSelection: (cutId: string) => {
            update((state) => {
                const selectedCutIds = new Set(state.selectedCutIds);
                if (selectedCutIds.has(cutId)) {
                    selectedCutIds.delete(cutId);
                } else {
                    selectedCutIds.add(cutId);
                }
                return {
                    ...state,
                    selectedCutIds,
                };
            });
        },

        highlightCut: (cutId: string | null) => {
            update((state) => ({
                ...state,
                highlightedCutId: cutId,
            }));
        },

        clearHighlight: () => {
            update((state) => ({
                ...state,
                highlightedCutId: null,
            }));
        },

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
                selectedCutIds: new Set(),
                highlightedCutId: null,
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
