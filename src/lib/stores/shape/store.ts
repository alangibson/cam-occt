/**
 * Shape Visualization Store
 *
 * Manages shape visualization preferences (start/end points) across all workflow stages.
 */

import { writable } from 'svelte/store';
import type {
    ShapeVisualizationState,
    ShapeVisualizationStore,
} from './interfaces';

function createShapeVisualizationStore(): ShapeVisualizationStore {
    const { subscribe, set, update } = writable<ShapeVisualizationState>({
        showShapeStartPoints: false,
        showShapeEndPoints: false,
        showShapeNormals: false,
    });

    return {
        subscribe,

        /**
         * Set shape start points visibility
         */
        setShowShapeStartPoints: (show: boolean) => {
            update((state) => ({
                ...state,
                showShapeStartPoints: show,
            }));
        },

        /**
         * Set shape end points visibility
         */
        setShowShapeEndPoints: (show: boolean) => {
            update((state) => ({
                ...state,
                showShapeEndPoints: show,
            }));
        },

        /**
         * Set shape normals visibility
         */
        setShowShapeNormals: (show: boolean) => {
            update((state) => ({
                ...state,
                showShapeNormals: show,
            }));
        },

        /**
         * Reset to defaults
         */
        reset: () => {
            set({
                showShapeStartPoints: false,
                showShapeEndPoints: false,
                showShapeNormals: false,
            });
        },
    };
}

export const shapeVisualizationStore: ReturnType<
    typeof createShapeVisualizationStore
> = createShapeVisualizationStore();
