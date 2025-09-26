/**
 * Interaction manager for handling mouse and keyboard events on the interaction canvas
 */

import type { Point2D } from '$lib/types';
import type { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';

/**
 * Interface for interaction callbacks that the host component should provide
 */
export interface InteractionCallbacks {
    onMouseDown?: (e: MouseEvent) => void;
    onMouseMove?: (e: MouseEvent) => void;
    onMouseUp?: (e: MouseEvent) => void;
    onMouseLeave?: (e: MouseEvent) => void;
    onWheel?: (e: WheelEvent) => void;
    onKeyDown?: (e: KeyboardEvent) => void;
    onContextMenu?: (e: MouseEvent) => void;
}

/**
 * Current interaction state
 */
export interface InteractionState {
    mousePos: Point2D;
    isMouseDown: boolean;
    dragStart: Point2D | null;
    mouseButton: number;
}

/**
 * Manager for handling canvas interactions
 */
export class InteractionManager {
    private canvas: HTMLCanvasElement | null = null;
    private callbacks: InteractionCallbacks = {};
    private state: InteractionState = {
        mousePos: { x: 0, y: 0 },
        isMouseDown: false,
        dragStart: null,
        mouseButton: 0,
    };
    private coordinator: CoordinateTransformer | null = null;

    constructor(coordinator: CoordinateTransformer | null = null) {
        this.coordinator = coordinator;
    }

    /**
     * Initialize interaction handling for a canvas
     */
    initialize(canvas: HTMLCanvasElement): void {
        this.canvas = canvas;
        this.attachEventListeners();
    }

    /**
     * Set the callbacks that will handle interaction events
     */
    setCallbacks(callbacks: InteractionCallbacks): void {
        this.callbacks = callbacks;
    }

    /**
     * Update the coordinate transformer
     */
    setCoordinator(coordinator: CoordinateTransformer): void {
        this.coordinator = coordinator;
    }

    /**
     * Get current interaction state
     */
    getState(): InteractionState {
        return { ...this.state };
    }

    /**
     * Attach event listeners to the canvas
     */
    private attachEventListeners(): void {
        if (!this.canvas) return;

        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
        this.canvas.addEventListener('wheel', this.handleWheel);
        this.canvas.addEventListener('contextmenu', this.handleContextMenu);

        // Set tabindex and focus for keyboard events
        this.canvas.tabIndex = 0;
        this.canvas.addEventListener('keydown', this.handleKeyDown);
    }

    /**
     * Remove event listeners from the canvas
     */
    private removeEventListeners(): void {
        if (!this.canvas) return;

        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
        this.canvas.removeEventListener('wheel', this.handleWheel);
        this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
        this.canvas.removeEventListener('keydown', this.handleKeyDown);
    }

    /**
     * Handle mouse down events
     */
    private handleMouseDown = (e: MouseEvent): void => {
        this.state.isMouseDown = true;
        this.state.mousePos = { x: e.offsetX, y: e.offsetY };
        this.state.dragStart = this.state.mousePos;
        this.state.mouseButton = e.button;

        if (this.callbacks.onMouseDown) {
            this.callbacks.onMouseDown(e);
        }
    };

    /**
     * Handle mouse move events
     */
    private handleMouseMove = (e: MouseEvent): void => {
        this.state.mousePos = { x: e.offsetX, y: e.offsetY };

        if (this.callbacks.onMouseMove) {
            this.callbacks.onMouseMove(e);
        }
    };

    /**
     * Handle mouse up events
     */
    private handleMouseUp = (e: MouseEvent): void => {
        this.state.isMouseDown = false;
        this.state.dragStart = null;
        this.state.mouseButton = 0;

        if (this.callbacks.onMouseUp) {
            this.callbacks.onMouseUp(e);
        }
    };

    /**
     * Handle mouse leave events
     */
    private handleMouseLeave = (e: MouseEvent): void => {
        this.state.isMouseDown = false;
        this.state.dragStart = null;
        this.state.mouseButton = 0;

        if (this.callbacks.onMouseLeave) {
            this.callbacks.onMouseLeave(e);
        }
    };

    /**
     * Handle wheel events
     */
    private handleWheel = (e: WheelEvent): void => {
        if (this.callbacks.onWheel) {
            this.callbacks.onWheel(e);
        }
    };

    /**
     * Handle keyboard events
     */
    private handleKeyDown = (e: KeyboardEvent): void => {
        if (this.callbacks.onKeyDown) {
            this.callbacks.onKeyDown(e);
        }
    };

    /**
     * Handle context menu events
     */
    private handleContextMenu = (e: MouseEvent): void => {
        if (this.callbacks.onContextMenu) {
            this.callbacks.onContextMenu(e);
        }
    };

    /**
     * Destroy the interaction manager and clean up resources
     */
    destroy(): void {
        this.removeEventListeners();
        this.canvas = null;
        this.callbacks = {};
        this.coordinator = null;
        this.state = {
            mousePos: { x: 0, y: 0 },
            isMouseDown: false,
            dragStart: null,
            mouseButton: 0,
        };
    }
}
