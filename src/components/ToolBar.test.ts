// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import ToolBar from './ToolBar.svelte';
import { drawingStore } from '$lib/stores/drawing/store';
import { Unit } from '$lib/config/units/units';
import type { Drawing } from '$lib/geometry/shape';
import { GeometryType } from '$lib/geometry/shape';

// Mock window.prompt and window.alert
Object.defineProperty(window, 'prompt', {
    value: vi.fn(),
    writable: true,
});

Object.defineProperty(window, 'alert', {
    value: vi.fn(),
    writable: true,
});

describe('ToolBar Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        drawingStore.setDisplayUnit(Unit.MM);
    });

    it('should render without errors', () => {
        const { container } = render(ToolBar);
        expect(container).toBeDefined();
    });

    it('should show selection count in delete button', () => {
        const mockDrawing: Drawing = {
            shapes: [
                {
                    id: '1',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
                    layer: '0',
                },
                {
                    id: '2',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 5, y: 5 } },
                    layer: '0',
                },
            ],
            bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
            units: Unit.MM,
        };

        drawingStore.setDrawing(mockDrawing);
        drawingStore.selectShape('1');
        drawingStore.selectShape('2', true);

        const { getByText } = render(ToolBar);
        expect(getByText('Delete (2)')).toBeDefined();
    });

    it('should disable buttons when no shapes are selected', () => {
        // Clear any existing selection
        drawingStore.clearSelection();

        const { getByText } = render(ToolBar);

        const deleteButton = getByText(/Delete \(\d+\)/);
        const scaleButton = getByText('Scale');
        const rotateButton = getByText('Rotate');

        expect(deleteButton.closest('button')?.disabled).toBe(true);
        expect(scaleButton.closest('button')?.disabled).toBe(true);
        expect(rotateButton.closest('button')?.disabled).toBe(true);
    });

    it('should enable buttons when shapes are selected', () => {
        const mockDrawing: Drawing = {
            shapes: [
                {
                    id: '1',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
                    layer: '0',
                },
            ],
            bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
            units: Unit.MM,
        };

        drawingStore.setDrawing(mockDrawing);
        drawingStore.selectShape('1');

        const { getByText } = render(ToolBar);

        const deleteButton = getByText(/Delete \(1\)/);
        const scaleButton = getByText('Scale');

        expect(deleteButton.closest('button')?.disabled).toBe(false);
        expect(scaleButton.closest('button')?.disabled).toBe(false);
    });
});
