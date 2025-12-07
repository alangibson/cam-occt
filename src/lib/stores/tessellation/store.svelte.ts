/**
 * Tessellation Store
 *
 * Manages tessellation visualization state for chains.
 * Stores tessellated points for rendering blue dots on the canvas.
 */

import type { TessellationPoint } from './interfaces';

class TessellationStore {
    isActive = $state(false);
    points = $state<TessellationPoint[]>([]);
    lastUpdate = $state(0);

    /**
     * Set tessellation points for visualization
     */
    setTessellation(points: TessellationPoint[]) {
        this.isActive = true;
        this.points = points;
        this.lastUpdate = Date.now();
    }

    /**
     * Clear tessellation visualization
     */
    clearTessellation() {
        this.isActive = false;
        this.points = [];
        this.lastUpdate = Date.now();
    }

    /**
     * Toggle tessellation state
     */
    toggleTessellation(points?: TessellationPoint[]) {
        if (this.isActive) {
            // Clear if active
            this.isActive = false;
            this.points = [];
            this.lastUpdate = Date.now();
        } else {
            // Set if inactive
            this.isActive = true;
            this.points = points || [];
            this.lastUpdate = Date.now();
        }
    }
}

export const tessellationStore = new TessellationStore();
