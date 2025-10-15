import { writable } from 'svelte/store';
import type { Shape } from '$lib/types';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import type { Cut, CutsState, CutsStore } from './interfaces';
import { checkProgramStageCompletion } from './functions';
import type { CutLeadResult } from '$lib/stores/operations/interfaces';

function createCutsStore(): CutsStore {
    const initialState: CutsState = {
        cuts: [],
        selectedCutId: null,
        highlightedCutId: null,
        showCutNormals: false,
        showCutter: false,
        showCutDirections: false,
        showCutPaths: true,
        showCutStartPoints: false,
        showCutEndPoints: false,
        showCutTangentLines: false,
    };

    const { subscribe, set, update } = writable<CutsState>(initialState);

    return {
        subscribe,

        addCut: (cut: Cut) => {
            update((state) => {
                // If cut doesn't have an ID, generate one
                const cutToAdd: Cut = cut.id
                    ? cut
                    : { ...cut, id: crypto.randomUUID() };

                const newCuts: Cut[] = [...state.cuts, cutToAdd];

                // Check workflow completion
                setTimeout(() => checkProgramStageCompletion(newCuts), 0);

                return {
                    ...state,
                    cuts: newCuts,
                };
            });
        },

        addCuts: (cuts: Cut[]) => {
            update((state) => {
                // Ensure all cuts have IDs
                const cutsToAdd: Cut[] = cuts.map((cut) =>
                    cut.id ? cut : { ...cut, id: crypto.randomUUID() }
                );

                const newCuts: Cut[] = [...state.cuts, ...cutsToAdd];

                // Check workflow completion once after all cuts added
                setTimeout(() => checkProgramStageCompletion(newCuts), 0);

                return {
                    ...state,
                    cuts: newCuts,
                };
            });
        },

        updateCut: (id: string, updates: Partial<Cut>) => {
            update((state) => ({
                ...state,
                cuts: state.cuts.map((cut) =>
                    cut.id === id ? { ...cut, ...updates } : cut
                ),
            }));
        },

        deleteCut: (id: string) => {
            update((state) => {
                const newCuts: Cut[] = state.cuts.filter(
                    (cut) => cut.id !== id
                );

                // Check workflow completion
                setTimeout(() => checkProgramStageCompletion(newCuts), 0);

                return {
                    ...state,
                    cuts: newCuts,
                    selectedCutId:
                        state.selectedCutId === id ? null : state.selectedCutId,
                    highlightedCutId:
                        state.highlightedCutId === id
                            ? null
                            : state.highlightedCutId,
                };
            });
        },

        deleteCutsByOperation: (operationId: string) => {
            update((state) => {
                const newCuts: Cut[] = state.cuts.filter(
                    (cut) => cut.operationId !== operationId
                );

                // Check workflow completion
                setTimeout(() => checkProgramStageCompletion(newCuts), 0);

                return {
                    ...state,
                    cuts: newCuts,
                    selectedCutId: state.cuts.some(
                        (c) =>
                            c.operationId === operationId &&
                            c.id === state.selectedCutId
                    )
                        ? null
                        : state.selectedCutId,
                    highlightedCutId: state.cuts.some(
                        (c) =>
                            c.operationId === operationId &&
                            c.id === state.highlightedCutId
                    )
                        ? null
                        : state.highlightedCutId,
                };
            });
        },

        selectCut: (cutId: string | null) => {
            update((state) => ({
                ...state,
                selectedCutId: cutId,
            }));
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

        reorderCuts: (newCuts: Cut[]) => {
            update((state) => ({
                ...state,
                cuts: newCuts,
            }));
        },

        getCutsByChain: (chainId: string) => {
            let currentCuts: Cut[] = [];
            const unsubscribe: () => void = subscribe((state) => {
                currentCuts = state.cuts.filter(
                    (cut) => cut.chainId === chainId
                );
            });
            unsubscribe();
            return currentCuts;
        },

        getChainsWithCuts: () => {
            let chainIds: string[] = [];
            const unsubscribe: () => void = subscribe((state) => {
                chainIds = [...new Set(state.cuts.map((cut) => cut.chainId))];
            });
            unsubscribe();
            return chainIds;
        },

        // Update lead geometry for a cut
        updateCutLeadGeometry: (cutId: string, leadGeometry: CutLeadResult) => {
            const timestamp: string = new Date().toISOString();
            const version: string = '1.0.0'; // Lead calculation algorithm version

            update((state) => ({
                ...state,
                cuts: state.cuts.map((cut) => {
                    if (cut.id !== cutId) return cut;

                    const updates: Partial<Cut> = {};

                    if (leadGeometry.leadIn) {
                        updates.leadIn = {
                            geometry: leadGeometry.leadIn.geometry,
                            type: leadGeometry.leadIn.type,
                            generatedAt: timestamp,
                            version,
                        };
                    }

                    if (leadGeometry.leadOut) {
                        updates.leadOut = {
                            geometry: leadGeometry.leadOut.geometry,
                            type: leadGeometry.leadOut.type,
                            generatedAt: timestamp,
                            version,
                        };
                    }

                    if (leadGeometry.validation) {
                        updates.leadValidation = {
                            ...leadGeometry.validation,
                            validatedAt: timestamp,
                        };
                    }

                    return { ...cut, ...updates };
                }),
            }));
        },

        // Clear calculated lead geometry (force recalculation)
        clearCutLeadGeometry: (cutId: string) => {
            update((state) => ({
                ...state,
                cuts: state.cuts.map((cut) =>
                    cut.id === cutId
                        ? {
                              ...cut,
                              leadIn: undefined,
                              leadOut: undefined,
                              leadValidation: undefined,
                          }
                        : cut
                ),
            }));
        },

        // Update offset geometry for a cut
        updateCutOffsetGeometry: (
            cutId: string,
            offsetGeometry: {
                offsetShapes: Shape[];
                originalShapes: Shape[];
                direction: OffsetDirection;
                kerfWidth: number;
            }
        ) => {
            const timestamp: string = new Date().toISOString();
            const version: string = '1.0.0'; // Offset calculation algorithm version

            update((state) => ({
                ...state,
                cuts: state.cuts.map((cut) => {
                    if (cut.id !== cutId) return cut;

                    return {
                        ...cut,
                        offset: {
                            offsetShapes: offsetGeometry.offsetShapes,
                            originalShapes: offsetGeometry.originalShapes,
                            direction: offsetGeometry.direction,
                            kerfWidth: offsetGeometry.kerfWidth,
                            generatedAt: timestamp,
                            version,
                        },
                    };
                }),
            }));
        },

        // Clear calculated offset geometry (force recalculation)
        clearCutOffsetGeometry: (cutId: string) => {
            update((state) => ({
                ...state,
                cuts: state.cuts.map((cut) =>
                    cut.id === cutId
                        ? {
                              ...cut,
                              offset: undefined,
                          }
                        : cut
                ),
            }));
        },

        setShowCutNormals: (show: boolean) => {
            update((state) => ({
                ...state,
                showCutNormals: show,
            }));
        },

        setShowCutter: (show: boolean) => {
            update((state) => ({
                ...state,
                showCutter: show,
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
            set(initialState);
            // Check workflow completion (will invalidate since no cuts)
            setTimeout(() => checkProgramStageCompletion([]), 0);
        },

        // Restore state from persistence (preserves IDs and calculated data)
        restore: (cutsState: CutsState) => {
            set(cutsState);
            // Check workflow completion
            setTimeout(() => checkProgramStageCompletion(cutsState.cuts), 0);
        },
    };
}

export const cutStore: ReturnType<typeof createCutsStore> = createCutsStore();
