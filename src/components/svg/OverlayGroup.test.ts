/**
 * Tests for OverlayGroup toolhead rendering
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mount, unmount } from 'svelte';
import { overlayStore } from '$lib/stores/overlay/store.svelte';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import OverlayGroup from './OverlayGroup.svelte';

describe('OverlayGroup Toolhead Rendering', () => {
    beforeEach(() => {
        // Clear all overlays before each test
        overlayStore.clearAllOverlays();
    });

    it('should not render toolhead when not set', () => {
        // Arrange
        const target = document.createElement('div');
        document.body.appendChild(target);

        // Act
        const component = mount(OverlayGroup, {
            target,
            props: {
                currentStage: WorkflowStage.SIMULATE,
                zoomScale: 1,
            },
        });

        // Assert - no toolhead elements should be rendered
        const lines = target.querySelectorAll('line');
        expect(lines.length).toBe(0);

        // Cleanup
        unmount(component);
        document.body.removeChild(target);
    });

    it('should render toolhead at specified position', () => {
        // Arrange
        const target = document.createElement('div');
        document.body.appendChild(target);

        // Set toolhead position
        overlayStore.setToolHead(WorkflowStage.SIMULATE, { x: 100, y: 200 });

        // Act
        const component = mount(OverlayGroup, {
            target,
            props: {
                currentStage: WorkflowStage.SIMULATE,
                zoomScale: 1,
            },
        });

        // Assert - should render 2 lines forming a cross
        const lines = target.querySelectorAll('line');
        expect(lines.length).toBe(2);

        // Check horizontal line
        const horizontalLine = lines[0];
        expect(horizontalLine.getAttribute('y1')).toBe('200');
        expect(horizontalLine.getAttribute('y2')).toBe('200');
        expect(horizontalLine.getAttribute('stroke')).toBe('rgb(133, 18, 0)'); // Red

        // Check vertical line
        const verticalLine = lines[1];
        expect(verticalLine.getAttribute('x1')).toBe('100');
        expect(verticalLine.getAttribute('x2')).toBe('100');
        expect(verticalLine.getAttribute('stroke')).toBe('rgb(133, 18, 0)'); // Red

        // Cleanup
        unmount(component);
        document.body.removeChild(target);
    });

    it('should update toolhead position reactively', () => {
        // Arrange
        const target = document.createElement('div');
        document.body.appendChild(target);

        // Set initial toolhead position
        overlayStore.setToolHead(WorkflowStage.SIMULATE, { x: 100, y: 200 });

        const component = mount(OverlayGroup, {
            target,
            props: {
                currentStage: WorkflowStage.SIMULATE,
                zoomScale: 1,
            },
        });

        // Verify initial position
        let lines = target.querySelectorAll('line');
        expect(lines[0].getAttribute('y1')).toBe('200');
        expect(lines[1].getAttribute('x1')).toBe('100');

        // Act - update toolhead position
        overlayStore.setToolHead(WorkflowStage.SIMULATE, { x: 300, y: 400 });

        // Force a DOM update by waiting for next tick
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                // Assert - position should be updated
                lines = target.querySelectorAll('line');
                expect(lines[0].getAttribute('y1')).toBe('400');
                expect(lines[0].getAttribute('y2')).toBe('400');
                expect(lines[1].getAttribute('x1')).toBe('300');
                expect(lines[1].getAttribute('x2')).toBe('300');

                // Cleanup
                unmount(component);
                document.body.removeChild(target);
                resolve();
            }, 0);
        });
    });

    it('should not render toolhead for wrong workflow stage', () => {
        // Arrange
        const target = document.createElement('div');
        document.body.appendChild(target);

        // Set toolhead for SIMULATE stage
        overlayStore.setToolHead(WorkflowStage.SIMULATE, { x: 100, y: 200 });

        // Act - render overlay for PROGRAM stage (different stage)
        const component = mount(OverlayGroup, {
            target,
            props: {
                currentStage: WorkflowStage.PROGRAM,
                zoomScale: 1,
            },
        });

        // Assert - no toolhead should be rendered
        const lines = target.querySelectorAll('line');
        expect(lines.length).toBe(0);

        // Cleanup
        unmount(component);
        document.body.removeChild(target);
    });

    it('should use vector-effect non-scaling-stroke', () => {
        // Arrange
        const target = document.createElement('div');
        document.body.appendChild(target);

        overlayStore.setToolHead(WorkflowStage.SIMULATE, { x: 100, y: 200 });

        // Act
        const component = mount(OverlayGroup, {
            target,
            props: {
                currentStage: WorkflowStage.SIMULATE,
                zoomScale: 1,
            },
        });

        // Assert - lines should have vector-effect for constant stroke width
        const lines = target.querySelectorAll('line');
        expect(lines[0].getAttribute('vector-effect')).toBe(
            'non-scaling-stroke'
        );
        expect(lines[1].getAttribute('vector-effect')).toBe(
            'non-scaling-stroke'
        );

        // Cleanup
        unmount(component);
        document.body.removeChild(target);
    });
});
