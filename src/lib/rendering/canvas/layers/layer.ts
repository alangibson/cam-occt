/**
 * Layer implementation for multi-canvas rendering
 */

import type { Layer as ILayer, LayerConfig, LayerId } from './types';

export class Layer implements ILayer {
    public readonly id: LayerId;
    public readonly canvas: HTMLCanvasElement;
    public readonly ctx: CanvasRenderingContext2D;
    public config: LayerConfig;

    constructor(config: LayerConfig) {
        this.id = config.id;
        this.config = { ...config };

        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'absolute';
        this.canvas.style.left = '0';
        this.canvas.style.top = '0';
        this.canvas.style.zIndex = config.zIndex.toString();
        this.canvas.style.pointerEvents =
            config.id === 'interaction' ? 'auto' : 'none';
        this.canvas.dataset.layerId = config.id;

        // Set visibility
        this.canvas.style.display = config.visible ? 'block' : 'none';

        // Set opacity if specified
        if (config.opacity !== undefined) {
            this.canvas.style.opacity = config.opacity.toString();
        }

        // Get 2D context
        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            throw new Error(`Failed to get 2D context for layer ${config.id}`);
        }
        this.ctx = ctx;

        // Set blend mode if specified
        if (config.blendMode) {
            this.ctx.globalCompositeOperation = config.blendMode;
        }
    }

    /**
     * Clear the layer canvas
     */
    clear(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Update layer visibility
     */
    setVisible(visible: boolean): void {
        this.config.visible = visible;
        this.canvas.style.display = visible ? 'block' : 'none';
    }

    /**
     * Update layer opacity
     */
    setOpacity(opacity: number): void {
        const clampedOpacity = Math.max(0, Math.min(1, opacity));
        this.config.opacity = clampedOpacity;
        this.canvas.style.opacity = clampedOpacity.toString();
    }

    /**
     * Resize the layer canvas
     */
    resize(width: number, height: number): void {
        // Resize canvas
        this.canvas.width = width;
        this.canvas.height = height;
    }

    /**
     * Update z-index
     */
    setZIndex(zIndex: number): void {
        this.config.zIndex = zIndex;
        this.canvas.style.zIndex = zIndex.toString();
    }
}
