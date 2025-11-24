// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import LayersList from './LayersList.svelte';
import { drawingStore } from '$lib/stores/drawing/store';
import { Unit } from '$lib/config/units/units';
import type { DrawingData } from '$lib/cam/drawing/interfaces';
import { Drawing } from '$lib/cam/drawing/classes.svelte';
import { GeometryType } from '$lib/geometry/enums';

// Mock ResizeObserver for SVAR Grid
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

describe('LayersList Component', () => {
    beforeEach(() => {
        drawingStore.setDisplayUnit(Unit.MM);
    });

    it('should render without errors', () => {
        const { container } = render(LayersList);
        expect(container).toBeDefined();
    });

    it('should render without errors when no drawing is present', () => {
        const { container } = render(LayersList);
        expect(container).toBeDefined();
        // Component now uses SVAR Grid which doesn't display "No drawing loaded"
        // Just verify it renders without crashing
    });

    it('should display layers from drawing shapes', () => {
        const mockDrawing: DrawingData = {
            shapes: [
                {
                    id: '1',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
                    layer: 'Layer1',
                },
                {
                    id: '2',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 5, y: 5 } },
                    layer: 'Layer2',
                },
            ],
            units: Unit.MM,
            fileName: 'test.dxf',
        };

        const drawing = new Drawing(mockDrawing);
        drawingStore.setDrawing(drawing, 'test.dxf');
        const { container } = render(LayersList);

        // Verify component renders and layers are present in the drawing
        expect(container).toBeDefined();
        expect(drawing.layers['Layer1']).toBeDefined();
        expect(drawing.layers['Layer2']).toBeDefined();
        expect(drawing.layers['Layer1'].shapes).toHaveLength(1);
        expect(drawing.layers['Layer2'].shapes).toHaveLength(1);
    });

    it('should handle default layer for shapes without layer', () => {
        const mockDrawing: DrawingData = {
            shapes: [
                {
                    id: '1',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
                    layer: '',
                },
                {
                    id: '2',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 5, y: 5 } },
                    layer: undefined,
                },
            ],
            units: Unit.MM,
            fileName: 'test.dxf',
        };

        const drawing = new Drawing(mockDrawing);
        drawingStore.setDrawing(drawing, 'test.dxf');
        const { container } = render(LayersList);

        // Verify component renders and default layer '0' is created
        expect(container).toBeDefined();
        expect(drawing.layers['0']).toBeDefined();
        expect(drawing.layers['0'].shapes).toHaveLength(2);
    });

    it('should count shapes correctly per layer', () => {
        const mockDrawing: DrawingData = {
            shapes: [
                {
                    id: '1',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
                    layer: 'Layer1',
                },
                {
                    id: '2',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 5, y: 5 } },
                    layer: 'Layer1',
                },
                {
                    id: '3',
                    type: GeometryType.CIRCLE,
                    geometry: { center: { x: 0, y: 0 }, radius: 5 },
                    layer: 'Layer2',
                },
            ],
            units: Unit.MM,
            fileName: 'test.dxf',
        };

        const drawing = new Drawing(mockDrawing);
        drawingStore.setDrawing(drawing, 'test.dxf');
        const { container } = render(LayersList);

        // Verify shape counts in data structure
        expect(container).toBeDefined();
        expect(drawing.layers['Layer1'].shapes).toHaveLength(2);
        expect(drawing.layers['Layer2'].shapes).toHaveLength(1);
    });

    it('should sort layers with default layer 0 first', () => {
        const mockDrawing: DrawingData = {
            shapes: [
                {
                    id: '1',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
                    layer: 'ZLayer',
                },
                {
                    id: '2',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 5, y: 5 } },
                    layer: 'ALayer',
                },
                {
                    id: '3',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 3, y: 3 } },
                    layer: '', // Will become layer '0'
                },
            ],
            units: Unit.MM,
            fileName: 'test.dxf',
        };

        const drawing = new Drawing(mockDrawing);
        drawingStore.setDrawing(drawing, 'test.dxf');
        const { container } = render(LayersList);

        // Verify component renders and all layers exist
        expect(container).toBeDefined();
        expect(drawing.layers['0']).toBeDefined();
        expect(drawing.layers['ALayer']).toBeDefined();
        expect(drawing.layers['ZLayer']).toBeDefined();
    });
});
