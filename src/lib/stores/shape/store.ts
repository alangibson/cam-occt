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
        showShapePaths: false,
        showShapeStartPoints: false,
        showShapeEndPoints: false,
        showShapeNormals: false,
        showShapeWindingDirection: false,
        showShapeTangentLines: false,
        showShapeTessellation: false,
    });

    return {
        subscribe,

        /**
         * Set shape paths visibility
         */
        setShowShapePaths: (show: boolean) => {
            update((state) => ({
                ...state,
                showShapePaths: show,
            }));
        },

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
         * Set shape winding direction visibility
         */
        setShowShapeWindingDirection: (show: boolean) => {
            update((state) => ({
                ...state,
                showShapeWindingDirection: show,
            }));
        },

        /**
         * Set shape tangent lines visibility
         */
        setShowShapeTangentLines: (show: boolean) => {
            update((state) => ({
                ...state,
                showShapeTangentLines: show,
            }));
        },

        /**
         * Set shape tessellation visibility
         */
        setShowShapeTessellation: (show: boolean) => {
            update((state) => ({
                ...state,
                showShapeTessellation: show,
            }));
        },

        /**
         * Reset to defaults
         */
        reset: () => {
            set({
                showShapePaths: false,
                showShapeStartPoints: false,
                showShapeEndPoints: false,
                showShapeNormals: false,
                showShapeWindingDirection: false,
                showShapeTangentLines: false,
                showShapeTessellation: false,
            });
        },
    };
}

export const shapeVisualizationStore: ReturnType<
    typeof createShapeVisualizationStore
> = createShapeVisualizationStore();
