import { writable } from 'svelte/store';
import type { UIState, UIStore } from './interfaces';

function createUIStore(): UIStore {
    const { subscribe, update } = writable<UIState>({
        showToolTable: false,
        showSettings: false,
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

        toggleSettings: () => {
            update((state) => ({
                ...state,
                showSettings: !state.showSettings,
            }));
        },

        showSettings: () => {
            update((state) => ({
                ...state,
                showSettings: true,
            }));
        },

        hideSettings: () => {
            update((state) => ({
                ...state,
                showSettings: false,
            }));
        },
    };
}

export const uiStore: ReturnType<typeof createUIStore> = createUIStore();
