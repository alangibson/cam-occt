import { writable } from 'svelte/store';
import type { ChainStore } from './interfaces';

function createChainStore() {
    const initialState: ChainStore = {
        tolerance: 0.1,
        showChainPaths: true,
        showChainStartPoints: false,
        showChainEndPoints: false,
        showChainTangentLines: false,
        showChainNormals: false,
        showChainDirections: false,
        showChainTessellation: false,
    };

    const { subscribe, update } = writable<ChainStore>(initialState);

    function setTolerance(tolerance: number) {
        update((state) => ({
            ...state,
            tolerance,
        }));
    }

    // Chain visualization functions
    function setShowChainStartPoints(show: boolean) {
        update((state) => ({
            ...state,
            showChainStartPoints: show,
        }));
    }

    function setShowChainEndPoints(show: boolean) {
        update((state) => ({
            ...state,
            showChainEndPoints: show,
        }));
    }

    function setShowChainTangentLines(show: boolean) {
        update((state) => ({
            ...state,
            showChainTangentLines: show,
        }));
    }

    function setShowChainNormals(show: boolean) {
        update((state) => ({
            ...state,
            showChainNormals: show,
        }));
    }

    function setShowChainDirections(show: boolean) {
        update((state) => ({
            ...state,
            showChainDirections: show,
        }));
    }

    function setShowChainPaths(show: boolean) {
        update((state) => ({
            ...state,
            showChainPaths: show,
        }));
    }

    function setShowChainTessellation(show: boolean) {
        update((state) => ({
            ...state,
            showChainTessellation: show,
        }));
    }

    return {
        subscribe,
        setTolerance,
        setShowChainStartPoints,
        setShowChainEndPoints,
        setShowChainTangentLines,
        setShowChainNormals,
        setShowChainDirections,
        setShowChainPaths,
        setShowChainTessellation,
    };
}

export const chainStore = createChainStore();
