import { writable } from 'svelte/store';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { setChainsDirection } from '$lib/geometry/chain/chain-detection';
import type { ChainStore } from './interfaces';

function createChainStore() {
    const initialState: ChainStore = {
        chains: [],
        tolerance: 0.1,
        selectedChainId: null,
        highlightedChainId: null,
        showChainPaths: true,
        showChainStartPoints: false,
        showChainEndPoints: false,
        showChainTangentLines: false,
        showChainNormals: false,
        showChainDirections: false,
        showChainTessellation: false,
    };

    const { subscribe, update } = writable<ChainStore>(initialState);

    // Helper functions that directly interact with the store
    function setChains(chains: Chain[]) {
        update((state) => {
            // Automatically analyze and set clockwise property for all chains when they're first set
            const chainsWithDirection = setChainsDirection(
                chains,
                state.tolerance
            );
            return {
                ...state,
                chains: chainsWithDirection,
            };
        });
    }

    function clearChains() {
        update((state) => ({
            ...state,
            chains: [],
        }));
    }

    function setTolerance(tolerance: number) {
        update((state) => ({
            ...state,
            tolerance,
        }));
    }

    // Chain selection functions
    function selectChain(chainId: string | null) {
        update((state) => ({
            ...state,
            selectedChainId: chainId,
        }));
    }

    function clearChainSelection() {
        update((state) => ({
            ...state,
            selectedChainId: null,
        }));
    }

    // Chain highlighting functions
    function highlightChain(chainId: string | null) {
        update((state) => ({
            ...state,
            highlightedChainId: chainId,
        }));
    }

    function clearChainHighlight() {
        update((state) => ({
            ...state,
            highlightedChainId: null,
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
        setChains,
        clearChains,
        setTolerance,
        selectChain,
        clearChainSelection,
        highlightChain,
        clearChainHighlight,
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
