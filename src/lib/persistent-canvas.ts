import { writable } from 'svelte/store';
import type { RenderingPipeline } from '$lib/rendering/canvas/pipeline';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';

/**
 * Store for the persistent canvas instance
 * This allows the same canvas and rendering pipeline to be reused across stage transitions
 */
interface PersistentCanvasState {
    canvasContainer: HTMLElement | null;
    renderingPipeline: RenderingPipeline | null;
    coordinator: CoordinateTransformer | null;
    isInitialized: boolean;
}

const initialState: PersistentCanvasState = {
    canvasContainer: null,
    renderingPipeline: null,
    coordinator: null,
    isInitialized: false,
};

// Create the persistent canvas store
export const persistentCanvasStore =
    writable<PersistentCanvasState>(initialState);

// Helper functions for managing the persistent canvas
export const persistentCanvas = {
    /**
     * Store the canvas instance to be reused across stages
     */
    store(
        canvasContainer: HTMLElement,
        renderingPipeline: RenderingPipeline,
        coordinator: CoordinateTransformer
    ) {
        persistentCanvasStore.set({
            canvasContainer,
            renderingPipeline,
            coordinator,
            isInitialized: true,
        });
    },

    /**
     * Get the stored canvas instance
     */
    retrieve(): Promise<PersistentCanvasState> {
        return new Promise((resolve) => {
            const unsubscribe = persistentCanvasStore.subscribe((state) => {
                if (state.isInitialized) {
                    unsubscribe();
                    resolve(state);
                }
            });
        });
    },

    /**
     * Clear the persistent canvas (on app shutdown)
     */
    clear() {
        persistentCanvasStore.set(initialState);
    },

    /**
     * Check if a persistent canvas exists
     */
    exists(): Promise<boolean> {
        return new Promise((resolve) => {
            const unsubscribe = persistentCanvasStore.subscribe((state) => {
                unsubscribe();
                resolve(state.isInitialized);
            });
        });
    },
};
