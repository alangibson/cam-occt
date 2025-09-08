/**
 * Render State Manager for Canvas Performance Optimization
 *
 * Tracks what aspects of the canvas need re-rendering and batches updates
 * to avoid expensive full re-renders during pan operations.
 */

import type { Point2D } from '../types/geometry';

export interface RenderFlags {
    geometry: boolean; // Shapes, paths, overlays changed
    transforms: boolean; // Pan, zoom, or coordinate changes
    selection: boolean; // Selection or hover state changed
    paths: boolean; // Path calculations or visibility changed
    overlays: boolean; // Stage overlays changed
}

export class RenderStateManager {
    private flags: RenderFlags = {
        geometry: false,
        transforms: false,
        selection: false,
        paths: false,
        overlays: false,
    };

    private pendingRender = false;
    private lastRenderTime = 0;
    private minFrameInterval = 16; // ~60fps max

    /**
     * Mark specific aspects as needing re-render
     */
    markDirty(aspect: keyof RenderFlags): void {
        this.flags[aspect] = true;
    }

    /**
     * Mark multiple aspects as dirty
     */
    markMultipleDirty(aspects: (keyof RenderFlags)[]): void {
        aspects.forEach((aspect) => (this.flags[aspect] = true));
    }

    /**
     * Check if any aspect needs re-rendering
     */
    needsRender(): boolean {
        return Object.values(this.flags).some((flag) => flag);
    }

    /**
     * Check if a specific aspect needs re-rendering
     */
    needsRenderFor(aspect: keyof RenderFlags): boolean {
        return this.flags[aspect];
    }

    /**
     * Clear all dirty flags after render
     */
    clearFlags(): void {
        this.flags = {
            geometry: false,
            transforms: false,
            selection: false,
            paths: false,
            overlays: false,
        };
    }

    /**
     * Request a throttled render using requestAnimationFrame
     */
    requestRender(renderFn: () => void): void {
        if (this.pendingRender) return;

        const now = Date.now();
        const timeSinceLastRender = now - this.lastRenderTime;

        if (timeSinceLastRender < this.minFrameInterval) {
            // Throttle to max frame rate
            this.pendingRender = true;
            setTimeout(() => {
                this.pendingRender = false;
                this.executeRender(renderFn);
            }, this.minFrameInterval - timeSinceLastRender);
        } else {
            this.executeRender(renderFn);
        }
    }

    private executeRender(renderFn: () => void): void {
        if (!this.needsRender()) return;

        this.pendingRender = true;
        requestAnimationFrame(() => {
            renderFn();
            this.clearFlags();
            this.lastRenderTime = Date.now();
            this.pendingRender = false;
        });
    }

    /**
     * Get current dirty flags for debugging
     */
    getFlags(): RenderFlags {
        return { ...this.flags };
    }
}

/**
 * Pan operation state for smooth panning without full re-renders
 */
export class PanStateManager {
    private isAnimating = false;
    private animationId: number | null = null;
    private targetOffset: Point2D | null = null;
    private currentOffset: Point2D = { x: 0, y: 0 };
    private panVelocity: Point2D = { x: 0, y: 0 };
    private friction = 0.85; // Deceleration factor

    /**
     * Start smooth pan animation to target offset
     */
    animatePanTo(target: Point2D, onUpdate: (offset: Point2D) => void): void {
        this.targetOffset = target;

        if (!this.isAnimating) {
            this.startPanAnimation(onUpdate);
        }
    }

    /**
     * Immediately set pan offset without animation
     */
    setPanOffset(offset: Point2D): void {
        this.currentOffset = { ...offset };
        this.targetOffset = null;
        this.stopPanAnimation();
    }

    /**
     * Add velocity to current pan (for momentum-based panning)
     */
    addPanVelocity(velocity: Point2D): void {
        this.panVelocity.x += velocity.x;
        this.panVelocity.y += velocity.y;
    }

    private startPanAnimation(onUpdate: (offset: Point2D) => void): void {
        if (this.isAnimating) return;

        this.isAnimating = true;

        const animate = () => {
            if (!this.isAnimating) return;

            let needsUpdate = false;

            // Apply velocity (for momentum)
            if (
                Math.abs(this.panVelocity.x) > 0.1 ||
                Math.abs(this.panVelocity.y) > 0.1
            ) {
                this.currentOffset.x += this.panVelocity.x;
                this.currentOffset.y += this.panVelocity.y;

                // Apply friction
                this.panVelocity.x *= this.friction;
                this.panVelocity.y *= this.friction;

                needsUpdate = true;
            }

            // Move towards target
            if (this.targetOffset) {
                const dx = this.targetOffset.x - this.currentOffset.x;
                const dy = this.targetOffset.y - this.currentOffset.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 1) {
                    // Move 20% towards target each frame
                    this.currentOffset.x += dx * 0.2;
                    this.currentOffset.y += dy * 0.2;
                    needsUpdate = true;
                } else {
                    // Snap to target
                    this.currentOffset = { ...this.targetOffset };
                    this.targetOffset = null;
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                onUpdate({ ...this.currentOffset });
                this.animationId = requestAnimationFrame(animate);
            } else {
                this.stopPanAnimation();
            }
        };

        this.animationId = requestAnimationFrame(animate);
    }

    private stopPanAnimation(): void {
        this.isAnimating = false;
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.panVelocity = { x: 0, y: 0 };
    }

    /**
     * Get current pan offset
     */
    getCurrentOffset(): Point2D {
        return { ...this.currentOffset };
    }

    /**
     * Stop any ongoing pan animation
     */
    stop(): void {
        this.stopPanAnimation();
    }

    /**
     * Check if pan animation is active
     */
    isActive(): boolean {
        return this.isAnimating;
    }
}
