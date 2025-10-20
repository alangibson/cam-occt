import { writable } from 'svelte/store';
import type { Kerf } from '$lib/cam/kerf/interfaces';

export interface KerfsStore {
    kerfs: Kerf[];
    selectedKerfId: string | null;
    highlightedKerfId: string | null;
    showKerfPaths: boolean;
}

function createKerfsStore() {
    const initialState: KerfsStore = {
        kerfs: [],
        selectedKerfId: null,
        highlightedKerfId: null,
        showKerfPaths: false,
    };

    const { subscribe, update } = writable<KerfsStore>(initialState);

    function addKerf(kerf: Kerf) {
        update((state) => {
            const kerfToAdd: Kerf = kerf.id
                ? kerf
                : { ...kerf, id: crypto.randomUUID() };

            return {
                ...state,
                kerfs: [...state.kerfs, kerfToAdd],
            };
        });
    }

    function setShowKerfPaths(show: boolean) {
        update((state) => ({
            ...state,
            showKerfPaths: show,
        }));
    }

    function clearKerfs() {
        update((state) => ({
            ...state,
            kerfs: [],
        }));
    }

    function deleteKerfsByCut(cutId: string) {
        update((state) => ({
            ...state,
            kerfs: state.kerfs.filter((kerf) => kerf.cutId !== cutId),
        }));
    }

    return {
        subscribe,
        addKerf,
        setShowKerfPaths,
        clearKerfs,
        deleteKerfsByCut,
    };
}

export const kerfStore = createKerfsStore();
