/**
 * Tests for LayerManager class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LayerManager } from './manager';
import { LayerId, DEFAULT_LAYER_CONFIGS } from './types';

// Mock the Layer class
vi.mock('./layer', () => ({
    Layer: vi.fn().mockImplementation((config) => ({
        id: config.id,
        config: { ...config },
        canvas: {
            remove: vi.fn(),
            style: {},
        },
        ctx: {},
        clear: vi.fn(),
        setVisible: vi.fn(),
        setOpacity: vi.fn(),
        resize: vi.fn(),
        setZIndex: vi.fn(),
    })),
}));

describe('LayerManager', () => {
    let layerManager: LayerManager;
    let mockContainer: HTMLElement;

    beforeEach(() => {
        vi.clearAllMocks();

        layerManager = new LayerManager();

        // Mock container element
        mockContainer = {
            appendChild: vi.fn(),
            removeChild: vi.fn(),
            firstChild: null,
        } as unknown as HTMLElement;
    });

    it('should create layers from default configurations', () => {
        const layers = layerManager.getAllLayers();

        expect(layers).toHaveLength(DEFAULT_LAYER_CONFIGS.length);

        for (const config of DEFAULT_LAYER_CONFIGS) {
            const layer = layerManager.getLayer(config.id);
            expect(layer).toBeDefined();
            expect(layer!.id).toBe(config.id);
        }
    });

    it('should create layers from custom configurations', () => {
        const customConfigs = [
            { id: LayerId.SHAPES, zIndex: 1, visible: true },
            { id: LayerId.PATHS, zIndex: 2, visible: false },
        ];

        const customManager = new LayerManager(customConfigs);
        const layers = customManager.getAllLayers();

        expect(layers).toHaveLength(2);
        expect(customManager.getLayer(LayerId.SHAPES)).toBeDefined();
        expect(customManager.getLayer(LayerId.PATHS)).toBeDefined();
        expect(customManager.getLayer(LayerId.BACKGROUND)).toBeUndefined();
    });

    describe('initialize', () => {
        it('should clear container and add canvases in z-order', () => {
            layerManager.initialize(mockContainer, 800, 600);

            // Should add all layer canvases
            expect(mockContainer.appendChild).toHaveBeenCalledTimes(
                DEFAULT_LAYER_CONFIGS.length
            );

            // Should resize all layers
            const layers = layerManager.getAllLayers();
            for (const layer of layers) {
                expect(layer.resize).toHaveBeenCalledWith(800, 600);
            }
        });
    });

    describe('getLayer', () => {
        it('should return layer by id', () => {
            const shapesLayer = layerManager.getLayer(LayerId.SHAPES);

            expect(shapesLayer).toBeDefined();
            expect(shapesLayer!.id).toBe(LayerId.SHAPES);
        });

        it('should return undefined for non-existent layer', () => {
            const nonExistentLayer = layerManager.getLayer(
                'non-existent' as LayerId
            );

            expect(nonExistentLayer).toBeUndefined();
        });
    });

    describe('getLayersByZOrder', () => {
        it('should return layers sorted by z-index ascending', () => {
            const layers = layerManager.getLayersByZOrder();

            for (let i = 1; i < layers.length; i++) {
                expect(layers[i].config.zIndex).toBeGreaterThanOrEqual(
                    layers[i - 1].config.zIndex
                );
            }
        });

        it('should return layers sorted by z-index descending when reverse is true', () => {
            const layers = layerManager.getLayersByZOrder(true);

            for (let i = 1; i < layers.length; i++) {
                expect(layers[i].config.zIndex).toBeLessThanOrEqual(
                    layers[i - 1].config.zIndex
                );
            }
        });
    });

    describe('clearAll', () => {
        it('should clear all layers', () => {
            layerManager.clearAll();

            const layers = layerManager.getAllLayers();
            for (const layer of layers) {
                expect(layer.clear).toHaveBeenCalled();
                // markDirty functionality removed
            }
        });
    });

    describe('clearLayers', () => {
        it('should clear only specified layers', () => {
            const layersToUdate = [LayerId.SHAPES, LayerId.PATHS];
            layerManager.clearLayers(layersToUdate);

            const shapesLayer = layerManager.getLayer(LayerId.SHAPES);
            const pathsLayer = layerManager.getLayer(LayerId.PATHS);
            const backgroundLayer = layerManager.getLayer(LayerId.BACKGROUND);

            expect(shapesLayer!.clear).toHaveBeenCalled();
            expect(pathsLayer!.clear).toHaveBeenCalled();
            expect(backgroundLayer!.clear).not.toHaveBeenCalled();
        });
    });

    // markDirty functionality removed
    // describe('markDirty', () => { ... });

    // getDirtyLayers functionality removed
    // describe('getDirtyLayers', () => { ... });

    describe('resize', () => {
        it('should resize all layers', () => {
            layerManager.resize(1024, 768);

            const layers = layerManager.getAllLayers();
            for (const layer of layers) {
                expect(layer.resize).toHaveBeenCalledWith(1024, 768);
            }
        });
    });

    describe('setLayerVisibility', () => {
        it('should set visibility for specified layer', () => {
            layerManager.setLayerVisibility(LayerId.SHAPES, false);

            const shapesLayer = layerManager.getLayer(LayerId.SHAPES);
            expect(shapesLayer!.setVisible).toHaveBeenCalledWith(false);
        });
    });

    describe('setLayerOpacity', () => {
        it('should set opacity for specified layer', () => {
            layerManager.setLayerOpacity(LayerId.SHAPES, 0.5);

            const shapesLayer = layerManager.getLayer(LayerId.SHAPES);
            expect(shapesLayer!.setOpacity).toHaveBeenCalledWith(0.5);
        });
    });

    describe('setLayerZIndex', () => {
        it('should update z-index and re-sort in container', () => {
            layerManager.initialize(mockContainer, 800, 600);
            vi.clearAllMocks(); // Clear initialization calls

            layerManager.setLayerZIndex(LayerId.SHAPES, 999);

            const shapesLayer = layerManager.getLayer(LayerId.SHAPES);
            expect(shapesLayer!.setZIndex).toHaveBeenCalledWith(999);

            // Should re-append all canvases in new order
            expect(mockContainer.appendChild).toHaveBeenCalledTimes(
                DEFAULT_LAYER_CONFIGS.length
            );
        });
    });

    describe('getLayerAtPoint', () => {
        it('should return null for out-of-bounds point', () => {
            layerManager.initialize(mockContainer, 800, 600);

            const layer = layerManager.getLayerAtPoint(-10, -10);
            expect(layer).toBeNull();
        });

        it('should return top-most visible layer for valid point', () => {
            layerManager.initialize(mockContainer, 800, 600);

            // Find the layer with highest z-index that's visible
            const visibleLayers = layerManager
                .getAllLayers()
                .filter((layer) => layer.config.visible)
                .sort((a, b) => b.config.zIndex - a.config.zIndex);

            const topLayer = visibleLayers[0];

            const layer = layerManager.getLayerAtPoint(400, 300);
            expect(layer).toBe(topLayer);
        });
    });

    describe('destroy', () => {
        it('should clean up all resources', () => {
            layerManager.initialize(mockContainer, 800, 600);

            layerManager.destroy();

            // Should clear layers map
            expect(layerManager.getAllLayers()).toHaveLength(0);
        });
    });
});
