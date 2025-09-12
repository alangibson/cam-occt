import { writable } from 'svelte/store';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { setChainsDirection } from '../../algorithms/chain-detection/chain-detection';
import type { ChainStore } from './interfaces';

function createChainStore() {
    const initialState: ChainStore = {
        chains: [],
        tolerance: 0.1,
        selectedChainId: null,
        highlightedChainId: null,
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

    return {
        subscribe,
        setChains,
        clearChains,
        setTolerance,
        selectChain,
        clearChainSelection,
        highlightChain,
        clearChainHighlight,
    };
}

export const chainStore = createChainStore();
