/**
 * Base renderer interface and abstract class for all canvas renderers
 */

import type { LayerId } from '$lib/rendering/canvas/layers/types';
import type { RenderState } from '$lib/rendering/canvas/state/render-state';
import type { HitTestResult } from '$lib/rendering/canvas/utils/hit-test';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
import type { Point2D } from '$lib/geometry/point/interfaces';

/**
 * Base interface for all renderers
 */
export interface Renderer {
    /**
     * Unique identifier for this renderer
     */
    readonly id: string;

    /**
     * Layer this renderer draws to
     */
    readonly layer: LayerId;

    /**
     * Coordinate transformer for screen/world coordinate conversions
     */
    coordinator: CoordinateTransformer;

    /**
     * Render the content to the given context
     */
    render(ctx: CanvasRenderingContext2D, state: RenderState): void;

    /**
     * Test if a point hits any rendered content.
     * Point is in world/CAD (ie not screen) coordinates.
     * @returns Hit test result or null if no hit
     */
    hitWorld(point: Point2D, state: RenderState): HitTestResult | null;

    /**
     * Test if a point hits any rendered content.
     * Point is in screen coordinates.
     * @returns Hit test result or null if no hit
     */
    hitScreen(point: Point2D, state: RenderState): HitTestResult | null;

    /**
     * Optional initialization
     */
    initialize?(): void;

    /**
     * Optional cleanup
     */
    destroy?(): void;
}

/**
 * Abstract base class providing common functionality for renderers
 */
export abstract class BaseRenderer implements Renderer {
    public readonly id: string;
    public readonly layer: LayerId;
    coordinator: CoordinateTransformer;

    constructor(
        id: string,
        layer: LayerId,
        coordinator: CoordinateTransformer
    ) {
        this.id = id;
        this.layer = layer;
        this.coordinator = coordinator;
    }

    /**
     * Render implementation must be provided by subclasses
     */
    abstract render(ctx: CanvasRenderingContext2D, state: RenderState): void;

    /**
     * Default hit test returns null (no hit detection)
     * Override in subclasses that need hit detection
     */
    hitWorld(_point: Point2D, _state: RenderState): HitTestResult | null {
        return null;
    }

    /**
     * Default hit test returns null (no hit detection)
     * Override in subclasses that need hit detection
     */
    hitScreen(point: Point2D, state: RenderState): HitTestResult | null {
        const worldPos = this.coordinator.screenToWorld(point);
        return this.hitWorld(worldPos, state);
    }

    /**
     * Optional initialization
     */
    initialize(): void {
        // Override in subclasses if needed
    }

    /**
     * Optional cleanup
     */
    destroy(): void {
        // Override in subclasses if needed
    }
}
