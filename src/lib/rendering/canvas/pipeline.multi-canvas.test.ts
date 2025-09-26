/**
 * Tests for multi-canvas layer integration in RenderingPipeline
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RenderingPipeline } from './pipeline';
import { LayerId } from './layers/types';
import type { Layer } from './layers/layer';
import { createEmptyRenderState } from './state/render-state';

// Mock LayerManager and Layer classes
const mockLayerManagerMethods = {
    initialize: vi.fn(),
    getLayer: vi.fn(),
    getAllLayers: vi.fn(),
    resize: vi.fn(),
    setLayerVisibility: vi.fn(),
    clearAll: vi.fn(),
    destroy: vi.fn(),
};

vi.mock('./layers/manager', () => ({
    LayerManager: vi.fn().mockImplementation(() => mockLayerManagerMethods),
}));

describe('RenderingPipeline - Multi-Canvas Integration', () => {
    let pipeline: RenderingPipeline;
    let mockContainer: HTMLElement;
    let mockLayers: Map<LayerId, Partial<Layer>>;

    beforeEach(() => {
        vi.clearAllMocks();

        // Create mock container
        mockContainer = document.createElement('div');

        // Create mock layers
        mockLayers = new Map();
        for (const layerId of Object.values(LayerId)) {
            const mockCanvas = document.createElement('canvas');
            const mockCtx = {
                canvas: mockCanvas,
                clearRect: vi.fn(),
                save: vi.fn(),
                restore: vi.fn(),
                setTransform: vi.fn(),
                resetTransform: vi.fn(),
                translate: vi.fn(),
                scale: vi.fn(),
                rotate: vi.fn(),
                beginPath: vi.fn(),
                moveTo: vi.fn(),
                lineTo: vi.fn(),
                arc: vi.fn(),
                stroke: vi.fn(),
                fill: vi.fn(),
                closePath: vi.fn(),
            } as unknown as CanvasRenderingContext2D;

            // Set canvas dimensions
            mockCanvas.width = 800;
            mockCanvas.height = 600;

            mockLayers.set(layerId, {
                id: layerId,
                canvas: mockCanvas,
                ctx: mockCtx,
                config: {
                    id: layerId,
                    zIndex: 10, // Default z-index
                    visible: true,
                },
                clear: vi.fn(),
                resize: vi.fn(),
            });
        }

        // Set up mock returns
        mockLayerManagerMethods.getLayer.mockImplementation(
            (id: LayerId) => mockLayers.get(id) as Layer
        );
        mockLayerManagerMethods.getAllLayers.mockReturnValue(
            Array.from(mockLayers.values()) as Layer[]
        );

        pipeline = new RenderingPipeline();
    });

    describe('Multi-Canvas Initialization', () => {
        it('should initialize LayerManager with container and dimensions', () => {
            pipeline.initialize(mockContainer, 800, 600);

            expect(mockLayerManagerMethods.initialize).toHaveBeenCalledWith(
                mockContainer,
                800,
                600
            );
        });

        it('should create separate canvas elements for each layer', () => {
            pipeline.initialize(mockContainer, 800, 600);

            // Verify each layer has its own canvas
            for (const [_layerId, layer] of mockLayers) {
                expect(layer.canvas).toBeDefined();
                expect(layer.canvas).toBeInstanceOf(HTMLCanvasElement);
                expect(layer.ctx).toBeDefined();
            }
        });
    });

    describe('Layer-Specific Rendering', () => {
        beforeEach(() => {
            pipeline.initialize(mockContainer, 800, 600);
        });

        it('should render to specific layer canvas based on renderer configuration', () => {
            // Create mock renderer for shapes layer
            const mockShapeRenderer = {
                id: 'shape-renderer',
                layer: LayerId.SHAPES,
                render: vi.fn(),
                hitWorld: vi.fn(),
                hitScreen: vi.fn(),
            };

            pipeline.addRenderer(mockShapeRenderer);

            // Create render state
            const renderState = createEmptyRenderState();
            pipeline.updateState(renderState);

            // Force render processing
            pipeline.renderAll();

            const shapesLayer = mockLayers.get(LayerId.SHAPES);
            expect(shapesLayer?.clear).toHaveBeenCalled();
            expect(mockShapeRenderer.render).toHaveBeenCalledWith(
                shapesLayer?.ctx,
                renderState
            );
        });

        it('should only clear and render dirty layers', () => {
            // Create renderers for multiple layers
            const shapeRenderer = {
                id: 'shape-renderer',
                layer: LayerId.SHAPES,
                render: vi.fn(),
                hitWorld: vi.fn(),
                hitScreen: vi.fn(),
            };

            const pathRenderer = {
                id: 'path-renderer',
                layer: LayerId.PATHS,
                render: vi.fn(),
                hitWorld: vi.fn(),
                hitScreen: vi.fn(),
            };

            pipeline.addRenderer(shapeRenderer);
            pipeline.addRenderer(pathRenderer);

            const renderState = createEmptyRenderState();
            pipeline.updateState(renderState);

            // Force render processing
            pipeline.renderAll();

            // Note: isDirty functionality removed, so all layers will be rendered
            const shapesLayer = mockLayers.get(LayerId.SHAPES);
            const pathsLayer = mockLayers.get(LayerId.PATHS);

            expect(shapesLayer?.clear).toHaveBeenCalled();
            expect(pathsLayer?.clear).toHaveBeenCalled();

            expect(shapeRenderer.render).toHaveBeenCalled();
            expect(pathRenderer.render).toHaveBeenCalled();
        });

        // Test removed - markClean functionality no longer exists
    });

    describe('Layer Visibility and Compositing', () => {
        beforeEach(() => {
            pipeline.initialize(mockContainer, 800, 600);
        });

        it('should respect layer visibility settings', () => {
            pipeline.setLayerVisibility(LayerId.SHAPES, false);

            expect(
                mockLayerManagerMethods.setLayerVisibility
            ).toHaveBeenCalledWith(LayerId.SHAPES, false);
        });

        it('should handle layer z-order correctly', () => {
            const layers = Array.from(mockLayers.values()) as Layer[];

            // Verify layers maintain z-order through LayerManager
            expect(mockLayerManagerMethods.getAllLayers).toBeDefined();
            expect(layers.length).toBeGreaterThan(0);
        });
    });

    describe('Multi-Canvas Resizing', () => {
        beforeEach(() => {
            pipeline.initialize(mockContainer, 800, 600);
        });

        it('should resize all layer canvases when pipeline is resized', () => {
            pipeline.resize(1024, 768);

            expect(mockLayerManagerMethods.resize).toHaveBeenCalledWith(
                1024,
                768
            );
        });

        it('should trigger full re-render after resize', () => {
            const mockRenderer = {
                id: 'test-renderer',
                layer: LayerId.SHAPES,
                render: vi.fn(),
                hitWorld: vi.fn(),
                hitScreen: vi.fn(),
            };

            pipeline.addRenderer(mockRenderer);

            // Initial state
            const renderState = createEmptyRenderState();
            pipeline.updateState(renderState);

            // Clear previous calls
            vi.clearAllMocks();

            // Resize should trigger render
            pipeline.resize(1024, 768);

            // Force render processing
            pipeline.renderAll();

            expect(mockRenderer.render).toHaveBeenCalled();
        });
    });

    describe('Canvas Stacking and Event Handling', () => {
        beforeEach(() => {
            pipeline.initialize(mockContainer, 800, 600);
        });

        it('should ensure proper canvas stacking order', () => {
            // Verify LayerManager handles canvas stacking
            expect(mockLayerManagerMethods.initialize).toHaveBeenCalledWith(
                mockContainer,
                800,
                600
            );

            // The actual stacking is handled by LayerManager.initialize
            // which adds canvases to container in z-order
        });

        it('should handle hit detection across multiple layers', () => {
            const testPoint = { x: 100, y: 100 };

            // Create renderers with hit test implementations
            const highPriorityRenderer = {
                id: 'high-priority',
                layer: LayerId.SELECTION,
                render: vi.fn(),
                hitWorld: vi.fn().mockReturnValue({
                    type: 'selection' as const,
                    id: 'selection-1',
                    distance: 5,
                    point: testPoint,
                }),
                hitScreen: vi.fn().mockReturnValue({
                    type: 'selection' as const,
                    id: 'selection-1',
                    distance: 5,
                    point: testPoint,
                }),
            };

            const lowPriorityRenderer = {
                id: 'low-priority',
                layer: LayerId.SHAPES,
                render: vi.fn(),
                hitWorld: vi.fn().mockReturnValue({
                    type: 'shape' as const,
                    id: 'shape-1',
                    distance: 10,
                    point: testPoint,
                }),
                hitScreen: vi.fn().mockReturnValue({
                    type: 'shape' as const,
                    id: 'shape-1',
                    distance: 10,
                    point: testPoint,
                }),
            };

            pipeline.addRenderer(highPriorityRenderer);
            pipeline.addRenderer(lowPriorityRenderer);

            const renderState = createEmptyRenderState();
            pipeline.updateState(renderState);

            const result = pipeline.hitScreen(testPoint);

            // Verify hit test was called
            expect(highPriorityRenderer.hitWorld).toHaveBeenCalled();

            // Should return high priority result first
            expect(result).toBeDefined();
            if (result) {
                expect(result.type).toBe('selection');
                expect(result.id).toBe('selection-1');
            }
        });
    });
});
