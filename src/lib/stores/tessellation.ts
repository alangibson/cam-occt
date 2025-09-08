/**
 * Tessellation Store
 *
 * Manages tessellation visualization state for chains.
 * Stores tessellated points for rendering blue dots on the canvas.
 */

import { writable } from 'svelte/store';

export interface TessellationPoint {
    x: number;
    y: number;
    shapeId: string;
    chainId: string;
}

export interface TessellationState {
    isActive: boolean;
    points: TessellationPoint[];
    lastUpdate: number;
}

function createTessellationStore() {
    const { subscribe, update } = writable<TessellationState>({
        isActive: false,
        points: [],
        lastUpdate: 0,
    });

    return {
        subscribe,

        /**
         * Set tessellation points for visualization
         */
        setTessellation: (points: TessellationPoint[]) => {
            update((_) => ({
                isActive: true,
                points,
                lastUpdate: Date.now(),
            }));
        },

        /**
         * Clear tessellation visualization
         */
        clearTessellation: () => {
            update((_) => ({
                isActive: false,
                points: [],
                lastUpdate: Date.now(),
            }));
        },

        /**
         * Toggle tessellation state
         */
        toggleTessellation: (points?: TessellationPoint[]) => {
            update((state) => {
                if (state.isActive) {
                    // Clear if active
                    return {
                        isActive: false,
                        points: [],
                        lastUpdate: Date.now(),
                    };
                } else {
                    // Set if inactive
                    return {
                        isActive: true,
                        points: points || [],
                        lastUpdate: Date.now(),
                    };
                }
            });
        },
    };
}

export const tessellationStore = createTessellationStore();
