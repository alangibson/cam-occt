/**
 * Layer manager for coordinating multiple canvas layers
 */

import { Layer } from './layer';
import type { LayerConfig, LayerId } from './types';
import { DEFAULT_LAYER_CONFIGS } from './types';

export class LayerManager {
    private layers: Map<LayerId, Layer> = new Map();
    private container: HTMLElement | null = null;
    private width: number = 0;
    private height: number = 0;

    constructor(configs: LayerConfig[] = DEFAULT_LAYER_CONFIGS) {
        // Create layers from configs
        for (const config of configs) {
            const layer = new Layer(config);
            this.layers.set(config.id, layer);
        }
    }

    /**
     * Initialize the layer manager with a container element
     */
    initialize(container: HTMLElement, width: number, height: number): void {
        this.container = container;
        this.width = width;
        this.height = height;

        // Clear container
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        // Add all layer canvases to container in z-order
        const sortedLayers = Array.from(this.layers.values()).sort(
            (a, b) => a.config.zIndex - b.config.zIndex
        );

        for (const layer of sortedLayers) {
            layer.resize(width, height);
            container.appendChild(layer.canvas);
        }
    }

    /**
     * Get a specific layer
     */
    getLayer(id: LayerId): Layer | undefined {
        return this.layers.get(id);
    }

    /**
     * Get all layers
     */
    getAllLayers(): Layer[] {
        return Array.from(this.layers.values());
    }

    /**
     * Get layers sorted by z-index
     */
    getLayersByZOrder(reverse: boolean = false): Layer[] {
        const layers = Array.from(this.layers.values()).sort(
            (a, b) => a.config.zIndex - b.config.zIndex
        );
        return reverse ? layers.reverse() : layers;
    }

    /**
     * Clear all layers
     */
    clearAll(): void {
        for (const layer of this.layers.values()) {
            layer.clear();
        }
    }

    /**
     * Clear specific layers
     */
    clearLayers(layerIds: LayerId[]): void {
        for (const id of layerIds) {
            const layer = this.layers.get(id);
            if (layer) {
                layer.clear();
            }
        }
    }

    /**
     * Resize all layers
     */
    resize(width: number, height: number): void {
        this.width = width;
        this.height = height;

        for (const layer of this.layers.values()) {
            layer.resize(width, height);
        }
    }

    /**
     * Set layer visibility
     */
    setLayerVisibility(id: LayerId, visible: boolean): void {
        const layer = this.layers.get(id);
        if (layer) {
            layer.setVisible(visible);
        }
    }

    /**
     * Set layer opacity
     */
    setLayerOpacity(id: LayerId, opacity: number): void {
        const layer = this.layers.get(id);
        if (layer) {
            layer.setOpacity(opacity);
        }
    }

    /**
     * Update layer z-index
     */
    setLayerZIndex(id: LayerId, zIndex: number): void {
        const layer = this.layers.get(id);
        if (layer) {
            layer.setZIndex(zIndex);

            // Re-sort layers in DOM if container exists
            if (this.container) {
                const sortedLayers = this.getLayersByZOrder();
                for (const sortedLayer of sortedLayers) {
                    this.container.appendChild(sortedLayer.canvas);
                }
            }
        }
    }

    /**
     * Get the top-most visible layer at a point
     */
    getLayerAtPoint(x: number, y: number): Layer | null {
        // Check layers from top to bottom
        const reversedLayers = this.getLayersByZOrder(true);

        for (const layer of reversedLayers) {
            if (!layer.config.visible) continue;

            // Check if point is within canvas bounds
            if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                // Could add per-pixel hit testing here if needed
                return layer;
            }
        }

        return null;
    }

    /**
     * Destroy all layers and clean up
     */
    destroy(): void {
        // Remove all canvases from container
        if (this.container) {
            while (this.container.firstChild) {
                this.container.removeChild(this.container.firstChild);
            }
        }

        // Clear layer map
        this.layers.clear();
        this.container = null;
    }
}
