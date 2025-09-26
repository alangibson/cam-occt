/**
 * Layer type definitions for the canvas rendering system
 */

/**
 * Layer identifiers for the multi-canvas rendering system.
 * Each layer represents a different visual element category.
 */
export enum LayerId {
    BACKGROUND = 'background',
    SHAPES = 'shapes',
    CHAINS = 'chains',
    PARTS = 'parts',
    PATHS = 'paths',
    OFFSETS = 'offsets',
    LEADS = 'leads',
    RAPIDS = 'rapids',
    OVERLAYS = 'overlays',
    SELECTION = 'selection',
    INTERACTION = 'interaction',
}

/**
 * Configuration for a rendering layer
 */
export interface LayerConfig {
    id: LayerId;
    zIndex: number;
    visible: boolean;
    opacity?: number;
    blendMode?: GlobalCompositeOperation;
}

/**
 * Canvas layer instance
 */
export interface Layer {
    id: LayerId;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    config: LayerConfig;

    /**
     * Clear the layer canvas
     */
    clear(): void;

    /**
     * Update layer visibility
     */
    setVisible(visible: boolean): void;

    /**
     * Update layer opacity
     */
    setOpacity(opacity: number): void;

    /**
     * Resize the layer canvas
     */
    resize(width: number, height: number): void;
}

/**
 * Default layer configurations with z-order
 */
export const DEFAULT_LAYER_CONFIGS: LayerConfig[] = [
    { id: LayerId.BACKGROUND, zIndex: 0, visible: true },
    { id: LayerId.SHAPES, zIndex: 10, visible: true },
    { id: LayerId.CHAINS, zIndex: 20, visible: true },
    { id: LayerId.PARTS, zIndex: 30, visible: true },
    { id: LayerId.PATHS, zIndex: 40, visible: true },
    { id: LayerId.OFFSETS, zIndex: 50, visible: true },
    { id: LayerId.LEADS, zIndex: 60, visible: true },
    { id: LayerId.RAPIDS, zIndex: 70, visible: true },
    { id: LayerId.OVERLAYS, zIndex: 80, visible: true },
    { id: LayerId.SELECTION, zIndex: 90, visible: true },
    { id: LayerId.INTERACTION, zIndex: 100, visible: true, opacity: 0 }, // Transparent layer for hit detection
];
