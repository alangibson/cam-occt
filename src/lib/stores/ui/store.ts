import { writable } from 'svelte/store';
import type { UIState, UIStore } from './interfaces';

function createUIStore(): UIStore {
    const { subscribe, update } = writable<UIState>({
        showToolTable: false,
    });

    return {
        subscribe,

        toggleToolTable: () => {
            update((state) => ({
                ...state,
                showToolTable: !state.showToolTable,
            }));
        },

        showToolTable: () => {
            update((state) => ({
                ...state,
                showToolTable: true,
            }));
        },

        hideToolTable: () => {
            update((state) => ({
                ...state,
                showToolTable: false,
            }));
        },
    };
}

export const uiStore: ReturnType<typeof createUIStore> = createUIStore();
