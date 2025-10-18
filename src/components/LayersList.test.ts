// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import LayersList from './LayersList.svelte';
import { drawingStore } from '$lib/stores/drawing/store';
import { Unit } from '$lib/config/units/units';
import type { Drawing } from '$lib/geometry/shape';
import { GeometryType } from '$lib/geometry/shape';

describe('LayersList Component', () => {
    beforeEach(() => {
        drawingStore.setDisplayUnit(Unit.MM);
    });

    it('should render without errors', () => {
        const { container } = render(LayersList);
        expect(container).toBeDefined();
    });

    it('should show "No drawing loaded" when no drawing is present', () => {
        const { getByText } = render(LayersList);
        expect(getByText('No drawing loaded')).toBeDefined();
    });

    it('should display layers from drawing shapes', () => {
        const mockDrawing: Drawing = {
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
            bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
            units: Unit.MM,
        };

        drawingStore.setDrawing(mockDrawing);
        const { getByText, getAllByText } = render(LayersList);

        expect(getByText('Layer1')).toBeDefined();
        expect(getByText('Layer2')).toBeDefined();
        expect(getAllByText('1 shapes')).toHaveLength(2);
    });

    it('should handle default layer for shapes without layer', () => {
        const mockDrawing: Drawing = {
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
            bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
            units: Unit.MM,
        };

        drawingStore.setDrawing(mockDrawing);
        const { getByText } = render(LayersList);

        expect(getByText('0')).toBeDefined(); // Default layer
        expect(getByText('2 shapes')).toBeDefined();
    });

    it('should count shapes correctly per layer', () => {
        const mockDrawing: Drawing = {
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
            bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
            units: Unit.MM,
        };

        drawingStore.setDrawing(mockDrawing);
        const { getByText } = render(LayersList);

        // Check shape counts
        const layer1Items = getByText('Layer1').parentElement;
        const layer2Items = getByText('Layer2').parentElement;

        expect(layer1Items?.textContent).toContain('2 shapes');
        expect(layer2Items?.textContent).toContain('1 shapes');
    });

    it('should toggle layer visibility when clicked', async () => {
        const mockDrawing: Drawing = {
            shapes: [
                {
                    id: '1',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
                    layer: 'TestLayer',
                },
            ],
            bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
            units: Unit.MM,
        };

        drawingStore.setDrawing(mockDrawing);
        const { getByTitle } = render(LayersList);

        const visibilityButton = getByTitle('Hide layer');
        expect(visibilityButton).toBeDefined();

        // Click to hide layer
        await fireEvent.click(visibilityButton);

        // Should now show "Show layer" tooltip
        expect(getByTitle('Show layer')).toBeDefined();
    });

    it('should sort layers with default layer 0 first', () => {
        const mockDrawing: Drawing = {
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
            bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
            units: Unit.MM,
        };

        drawingStore.setDrawing(mockDrawing);
        const { container } = render(LayersList);

        const layerElements = container.querySelectorAll('.layer-name');
        const layerNames = Array.from(layerElements).map(
            (el) => el.textContent
        );

        // Should be sorted with '0' first, then alphabetical
        expect(layerNames).toEqual(['0', 'ALayer', 'ZLayer']);
    });
});
