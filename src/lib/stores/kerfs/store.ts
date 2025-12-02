import { writable } from 'svelte/store';
import type { Kerf } from '$lib/cam/kerf/interfaces';

interface KerfsStore {
    kerfs: Kerf[];
    showKerfPaths: boolean;
    showCutter: boolean;
}

function createKerfsStore() {
    const initialState: KerfsStore = {
        kerfs: [],
        showKerfPaths: false,
        showCutter: false,
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

    function setShowCutter(show: boolean) {
        update((state) => ({
            ...state,
            showCutter: show,
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
        setShowCutter,
        clearKerfs,
        deleteKerfsByCut,
    };
}

export const kerfStore = createKerfsStore();
