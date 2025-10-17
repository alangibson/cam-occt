/**
 * Main rendering pipeline that orchestrates multiple layers and renderers
 */

import { LayerManager } from './layers/manager';
import type { LayerId } from './layers/types';
import { LayerId as LayerIdEnum } from './layers/types';
import type { Renderer } from './renderers/base';
import type { RenderState } from './state/render-state';
import type { HitTestResult, HitTestConfig } from './utils/hit-test';
import {
    HitTestUtils,
    DEFAULT_HIT_TEST_PRIORITY,
    HitTestType,
} from './utils/hit-test';
import { DrawingContext } from './utils/context';
import type { Point2D } from '$lib/geometry/point';
import type { Shape } from '$lib/geometry/shape';
import { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
import {
    InteractionManager,
    type InteractionCallbacks,
    type InteractionState,
} from './interaction/manager';

// Default renderer imports
import { BackgroundRenderer } from './renderers/background';
import { ShapeRenderer } from './renderers/shape';
import { ChainRenderer } from './renderers/chain';
import { PartRenderer } from './renderers/part';
import { CutRenderer } from './renderers/cut';
import { LeadRenderer } from './renderers/lead';
import { RapidRenderer } from './renderers/rapid';
import { ChevronRenderer } from './renderers/chevron';
import { OverlayRenderer } from './renderers/overlay';

/**
 * Render request for scheduling
 */
interface RenderRequest {
    layers?: LayerId[];
    priority: number;
    timestamp: number;
}

/**
 * Main rendering pipeline that coordinates layers and renderers
 */
export class RenderingPipeline {
    private layerManager: LayerManager;
    private renderers: Map<string, Renderer> = new Map();
    private layerRenderers: Map<LayerId, Renderer[]> = new Map();
    private currentState: Partial<RenderState> = {};
    private previousState: Partial<RenderState> = {};
    private container: HTMLElement | null = null;
    private width: number = 0;
    private height: number = 0;
    private coordinator: CoordinateTransformer | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private interactionManager: InteractionManager | null = null;

    // Render scheduling
    private renderRequestId: number | null = null;
    private pendingRequests: RenderRequest[] = [];
    private isRendering: boolean = false;

    // Hit testing
    private hitTestConfig: HitTestConfig = {
        tolerance: 5, // Default tolerance in world units
        priorityOrder: [...DEFAULT_HIT_TEST_PRIORITY],
    };

    constructor() {
        this.layerManager = new LayerManager();
        this.initializeLayerRenderers();
    }

    /**
     * Initialize empty renderer arrays for each layer
     */
    private initializeLayerRenderers(): void {
        const layers = this.layerManager.getAllLayers();
        for (const layer of layers) {
            this.layerRenderers.set(layer.id, []);
        }
    }

    /**
     * Set up default renderers in the correct rendering order
     */
    private setupDefaultRenderers(
        coordinator: CoordinateTransformer | null
    ): void {
        if (!coordinator) return;

        // Add renderers in rendering order (back to front)
        this.addRenderer(new BackgroundRenderer(coordinator));

        // Add original shapes renderer
        this.addRenderer(
            new ShapeRenderer(
                'shape-renderer-original',
                coordinator,
                (state) => state.drawing?.shapes || []
            )
        );

        // Add offset shapes renderer
        this.addRenderer(
            new ShapeRenderer('shape-renderer-offset', coordinator, (state) => {
                // Extract offset shapes from all enabled cuts
                const offsetShapes: Shape[] = [];

                if (state.cutsState?.cuts) {
                    for (const cut of state.cutsState.cuts) {
                        // Only include offset shapes from cuts with enabled operations
                        if (!cut.operationId) continue;

                        const operation = state.operations.find(
                            (op) => op.id === cut.operationId
                        );
                        if (!operation || !operation.enabled) continue;

                        // Add offset shapes if they exist
                        if (cut.offset?.offsetShapes) {
                            offsetShapes.push(...cut.offset.offsetShapes);
                        }
                    }
                }

                return offsetShapes;
            })
        );

        this.addRenderer(new ChainRenderer(coordinator));
        this.addRenderer(new PartRenderer(coordinator));
        this.addRenderer(new CutRenderer(coordinator));
        this.addRenderer(new LeadRenderer(coordinator));
        this.addRenderer(new RapidRenderer(coordinator));
        this.addRenderer(new ChevronRenderer(coordinator));
        this.addRenderer(new OverlayRenderer(coordinator));
    }

    /**
     * Initialize coordinate transformer with interaction layer canvas
     */
    private setupCoordinateTransformer(initialTransform?: {
        zoomScale: number;
        panOffset: { x: number; y: number };
        unitScale: number;
    }): void {
        const interactionLayer = this.layerManager.getLayer(
            LayerIdEnum.INTERACTION
        );
        const defaultTransform = {
            zoomScale: 1,
            panOffset: { x: 0, y: 0 },
            unitScale: 1,
        };
        const transform = initialTransform || defaultTransform;

        if (interactionLayer?.canvas) {
            this.coordinator = new CoordinateTransformer(
                interactionLayer.canvas,
                transform.zoomScale,
                transform.panOffset,
                transform.unitScale
            );
        } else {
            // Fallback: create temporary canvas for coordinate transformer
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.width;
            tempCanvas.height = this.height;
            this.coordinator = new CoordinateTransformer(
                tempCanvas,
                transform.zoomScale,
                transform.panOffset,
                transform.unitScale
            );
        }

        // Update initial state with coordinator
        this.updateState({
            transform: {
                zoomScale: transform.zoomScale,
                panOffset: transform.panOffset,
                unitScale: transform.unitScale,
                coordinator: this.coordinator,
            },
        });
    }

    /**
     * Set up interaction manager for handling canvas interactions
     */
    private setupInteractionManager(): void {
        const interactionCanvas = this.getInteractionCanvas();

        if (interactionCanvas && this.coordinator) {
            this.interactionManager = new InteractionManager(this.coordinator);
            this.interactionManager.initialize(interactionCanvas);
        }
    }

    /**
     * Set up resize observer to maintain proper canvas sizing
     */
    private setupResizeObserver(): void {
        if (!this.container) return;

        // Check if ResizeObserver is available (not available in test environments)
        if (typeof ResizeObserver === 'undefined') {
            console.warn(
                'ResizeObserver not available, canvas auto-resize disabled'
            );
            return;
        }

        this.resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;

                // Resize all layer canvases through the rendering pipeline
                this.resize(width, height);

                // Update coordinate transformer with new dimensions
                if (this.coordinator) {
                    const interactionLayer = this.layerManager.getLayer(
                        LayerIdEnum.INTERACTION
                    );
                    if (interactionLayer?.canvas) {
                        this.coordinator.updateCanvas(interactionLayer.canvas);

                        // Update interaction manager with new coordinator
                        if (this.interactionManager) {
                            this.interactionManager.setCoordinator(
                                this.coordinator
                            );
                        }
                    }
                }
                // NOTE: Pipeline resize automatically triggers re-render
            }
        });

        this.resizeObserver.observe(this.container);
    }

    /**
     * Initialize the pipeline with a container element
     */
    initialize(
        container: HTMLElement,
        width: number,
        height: number,
        initialTransform?: {
            zoomScale: number;
            panOffset: { x: number; y: number };
            unitScale: number;
        }
    ): void {
        this.container = container;
        this.width = width;
        this.height = height;
        this.layerManager.initialize(container, width, height);

        // Initialize coordinate transformer
        this.setupCoordinateTransformer(initialTransform);

        // Set up default renderers
        this.setupDefaultRenderers(this.coordinator);

        // Set up interaction manager
        this.setupInteractionManager();

        // Set up resize observer
        this.setupResizeObserver();
    }

    /**
     * Add a renderer to the pipeline
     */
    addRenderer(renderer: Renderer): void {
        this.renderers.set(renderer.id, renderer);

        // Add to layer-specific map
        const layerRenderers = this.layerRenderers.get(renderer.layer) || [];
        layerRenderers.push(renderer);
        this.layerRenderers.set(renderer.layer, layerRenderers);

        // Initialize renderer
        if (renderer.initialize) {
            renderer.initialize();
        }
    }

    /**
     * Remove a renderer from the pipeline
     */
    removeRenderer(rendererId: string): void {
        const renderer = this.renderers.get(rendererId);
        if (!renderer) return;

        // Remove from main map
        this.renderers.delete(rendererId);

        // Remove from layer-specific map
        const layerRenderers = this.layerRenderers.get(renderer.layer);
        if (layerRenderers) {
            const index = layerRenderers.findIndex((r) => r.id === rendererId);
            if (index >= 0) {
                layerRenderers.splice(index, 1);
            }
        }

        // Cleanup renderer
        if (renderer.destroy) {
            renderer.destroy();
        }
    }

    /**
     * Get all renderers for a specific layer
     */
    getLayerRenderers(layerId: LayerId): Renderer[] {
        return this.layerRenderers.get(layerId) || [];
    }

    /**
     * Update render state and always render
     */
    updateState(newState: Partial<RenderState>): void {
        this.previousState = this.currentState;

        // Shallow merge - only copy defined, non-null values
        Object.assign(this.currentState, newState);

        // Always render everything
        this.renderAll();
    }

    /**
     * Set current state without triggering comparison or rendering
     */
    setCurrentState(newState: RenderState): void {
        this.previousState = this.currentState;
        this.currentState = newState;
    }

    /**
     * Schedule a render based on state changes
     */
    private scheduleRender(): void {
        // Render all layers
        const layersToUpdate = this.layerManager
            .getAllLayers()
            .map((layer) => layer.id);

        const request: RenderRequest = {
            layers: layersToUpdate,
            priority: 1, // Normal priority
            timestamp: Date.now(),
        };

        this.pendingRequests.push(request);

        // Schedule render on next frame if not already scheduled
        if (this.renderRequestId === null) {
            this.renderRequestId = requestAnimationFrame(() => {
                this.renderRequestId = null;
                this.processRenderRequests();
            });
        }
    }

    /**
     * Process pending render requests
     */
    private processRenderRequests(): void {
        if (this.isRendering || this.pendingRequests.length === 0) {
            return;
        }

        this.isRendering = true;

        try {
            // Combine all pending requests
            const allDirtyLayers = new Set<LayerId>();

            for (const request of this.pendingRequests) {
                if (request.layers) {
                    request.layers.forEach((layer) =>
                        allDirtyLayers.add(layer)
                    );
                } else {
                    // No specific layers means all layers
                    this.layerManager.getAllLayers().forEach((layer) => {
                        allDirtyLayers.add(layer.id);
                    });
                }
            }

            // Clear pending requests
            this.pendingRequests = [];

            // Render dirty layers
            this.renderLayers(Array.from(allDirtyLayers));
        } finally {
            this.isRendering = false;
        }
    }

    /**
     * Render specific layers
     */
    private renderLayers(layerIds: LayerId[]): void {
        for (const layerId of layerIds) {
            const layer = this.layerManager.getLayer(layerId);
            const renderers = this.getLayerRenderers(layerId);

            if (!layer || renderers.length === 0) continue;

            // Clear layer
            layer.clear();

            // Create drawing context for this layer
            if (this.currentState.transform) {
                const drawingContext = new DrawingContext(
                    layer.ctx,
                    this.currentState.transform
                );
                drawingContext.applyTransform();

                try {
                    // Render all renderers for this layer
                    for (const renderer of renderers) {
                        try {
                            renderer.render(
                                layer.ctx,
                                this.currentState as RenderState
                            );
                        } catch (error) {
                            console.error(
                                `Renderer ${renderer.id} failed:`,
                                error
                            );
                            // Continue rendering other renderers even if one fails
                        }
                    }
                } finally {
                    drawingContext.resetTransform();
                }
            }
        }
    }

    /**
     * Force render all layers
     */
    renderAll(): void {
        const allLayers = this.layerManager
            .getAllLayers()
            .map((layer) => layer.id);
        this.renderLayers(allLayers);
    }

    /**
     * Force render without state comparison - use when we already know something changed
     */
    forceRender(): void {
        // Force render all layers since we know something changed
        const request: RenderRequest = {
            layers: undefined, // undefined means all layers
            priority: 1,
            timestamp: Date.now(),
        };

        this.pendingRequests.push(request);

        // Schedule render on next frame if not already scheduled
        if (this.renderRequestId === null) {
            this.renderRequestId = requestAnimationFrame(() => {
                this.renderRequestId = null;
                this.processRenderRequests();
            });
        }
    }

    /**
     * Resize the pipeline
     */
    resize(width: number, height: number): void {
        this.width = width;
        this.height = height;
        this.layerManager.resize(width, height);

        // Force re-render after resize
        this.scheduleRender();
    }

    /**
     * Perform hit testing at a point in world/CAD coordinates
     */
    hitWorld(
        point: Point2D,
        config?: Partial<HitTestConfig>
    ): HitTestResult | null {
        // Defensive check for point validity
        if (
            !point ||
            typeof point.x !== 'number' ||
            typeof point.y !== 'number'
        ) {
            console.error('RenderingPipeline.hitTest: invalid point', point);
            return null;
        }

        const hitConfig = { ...this.hitTestConfig, ...config };
        const results: HitTestResult[] = [];

        // Test renderers in priority order
        const priorityOrder =
            hitConfig.priorityOrder || DEFAULT_HIT_TEST_PRIORITY;

        for (const hitType of priorityOrder) {
            // Find renderers that can handle this hit type
            for (const renderer of this.renderers.values()) {
                if (!renderer.hitWorld) continue;

                try {
                    const result = renderer.hitWorld(
                        point,
                        this.currentState as RenderState
                    );
                    if (result && result.type === hitType) {
                        results.push(result);
                    }
                } catch (error) {
                    console.error(
                        `Renderer ${renderer.id} failed hit test:`,
                        error
                    );
                    // Continue with other renderers
                }
            }

            // Continue collecting hits from all priority levels
            // Selection mode filtering will determine which hit is returned
        }

        // Filter and sort results
        const filteredResults = HitTestUtils.filterHitResults(
            results,
            hitConfig
        );
        const sortedResults = HitTestUtils.sortHitResults(
            filteredResults,
            priorityOrder
        );

        // Apply selection mode filtering
        const finalResults = this.filterBySelectionMode(sortedResults);

        return finalResults.length > 0 ? finalResults[0] : null;
    }

    /**
     * Filter hit results based on selection mode
     */
    private filterBySelectionMode(results: HitTestResult[]): HitTestResult[] {
        const state = this.currentState as RenderState;
        if (!state.selectionMode || state.selectionMode === 'auto') {
            return results; // No filtering for auto mode
        }

        return results.filter((result) => {
            switch (state.selectionMode) {
                case 'shape':
                    // Only allow shape hits
                    return result.type === HitTestType.SHAPE;
                case 'chain':
                    // Only allow chain hits
                    return result.type === HitTestType.CHAIN;
                case 'part':
                    // Only allow part hits
                    return result.type === HitTestType.PART;
                case 'cut':
                    // Only allow cut hits
                    return result.type === HitTestType.CUT;
                default:
                    return true;
            }
        });
    }

    /**
     * TODO copied from BaseRenderer
     *
     * Default hit test returns null (no hit detection)
     * Override in subclasses that need hit detection
     */
    hitScreen(point: Point2D): HitTestResult | null {
        if (!this.coordinator) return null;
        const worldPos = this.coordinator.screenToWorld(point);
        return this.hitWorld(worldPos);
    }

    /**
     * Update hit test configuration
     */
    setHitTestConfig(config: Partial<HitTestConfig>): void {
        this.hitTestConfig = { ...this.hitTestConfig, ...config };
    }

    /**
     * Get a specific layer
     */
    getLayer(layerId: LayerId) {
        return this.layerManager.getLayer(layerId);
    }

    /**
     * Get the coordinate transformer
     */
    getCoordinator(): CoordinateTransformer | null {
        return this.coordinator;
    }

    /**
     * Get the interaction canvas for event handling
     */
    getInteractionCanvas(): HTMLCanvasElement | null {
        const interactionLayer = this.layerManager.getLayer(
            LayerIdEnum.INTERACTION
        );
        return interactionLayer?.canvas || null;
    }

    /**
     * Set interaction callbacks to handle mouse and keyboard events
     */
    setInteractionCallbacks(callbacks: InteractionCallbacks): void {
        if (this.interactionManager) {
            this.interactionManager.setCallbacks(callbacks);
        }
    }

    /**
     * Get current interaction state
     */
    getInteractionState(): InteractionState | null {
        return this.interactionManager
            ? this.interactionManager.getState()
            : null;
    }

    /**
     * Set layer visibility
     */
    setLayerVisibility(layerId: LayerId, visible: boolean): void {
        this.layerManager.setLayerVisibility(layerId, visible);
    }

    /**
     * Clear all layers
     */
    clear(): void {
        this.layerManager.clearAll();
    }

    /**
     * Destroy the pipeline and clean up resources
     */
    destroy(): void {
        // Cancel any pending render
        if (this.renderRequestId !== null) {
            cancelAnimationFrame(this.renderRequestId);
            this.renderRequestId = null;
        }

        // Clean up resize observer
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        // Clean up interaction manager
        if (this.interactionManager) {
            this.interactionManager.destroy();
            this.interactionManager = null;
        }

        // Destroy all renderers
        for (const renderer of this.renderers.values()) {
            if (renderer.destroy) {
                renderer.destroy();
            }
        }

        // Clear renderer maps
        this.renderers.clear();
        this.layerRenderers.clear();

        // Destroy layer manager
        this.layerManager.destroy();

        // Clear state and coordinator
        this.previousState = {};
        this.currentState = {};
        this.pendingRequests = [];
        this.coordinator = null;
        this.container = null;
    }
}
