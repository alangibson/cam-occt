import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Footer from './Footer.svelte';
import { drawingStore } from '$lib/stores/drawing/store';
import { Unit } from '$lib/config/units/units';
import { GeometryType } from '$lib/geometry/shape/enums';
import type { DrawingData } from '$lib/cam/drawing/interfaces';
import { Drawing } from '$lib/cam/drawing/classes.svelte';

describe('Footer Fit Button', () => {
    beforeEach(() => {
        // Reset store state and set canvas dimensions
        drawingStore.setCanvasDimensions(800, 600);
    });

    it('should render the Fit button', () => {
        const { getByText } = render(Footer);
        const fitButton = getByText('Fit');

        expect(fitButton).toBeTruthy();
        expect(fitButton.tagName).toBe('BUTTON');
    });

    it('should disable the Fit button when no drawing is loaded', () => {
        const { getByText } = render(Footer);
        const fitButton = getByText('Fit') as HTMLButtonElement;

        expect(fitButton.disabled).toBe(true);
    });

    it('should enable the Fit button when a drawing is loaded', () => {
        // Load a test drawing
        const testDrawing: DrawingData = {
            shapes: [
                {
                    id: '1',
                    type: GeometryType.CIRCLE,
                    layer: '0',
                    center: { x: 50, y: 50 },
                    radius: 25,
                } as any,
            ],
            units: Unit.MM,
            fileName: 'test.dxf',
        };

        drawingStore.setDrawing(new Drawing(testDrawing), 'test.dxf');

        const { getByText } = render(Footer);
        const fitButton = getByText('Fit') as HTMLButtonElement;

        expect(fitButton.disabled).toBe(false);
    });

    it('should call zoomToFit when the Fit button is clicked', async () => {
        // Load a test drawing
        const testDrawing: DrawingData = {
            shapes: [
                {
                    id: '1',
                    type: GeometryType.CIRCLE,
                    layer: '0',
                    center: { x: 50, y: 50 },
                    radius: 25,
                } as any,
            ],
            units: Unit.MM,
            fileName: 'test.dxf',
        };

        drawingStore.setDrawing(new Drawing(testDrawing), 'test.dxf');

        // Set an initial zoom that's not the zoom-to-fit value
        drawingStore.setViewTransform(2.5, { x: 100, y: 100 });

        const initialState = get(drawingStore);
        expect(initialState.scale).toBe(2.5);
        expect(initialState.offset).toEqual({ x: 100, y: 100 });

        const { getByText } = render(Footer);
        const fitButton = getByText('Fit') as HTMLButtonElement;

        // Click the Fit button
        await fireEvent.click(fitButton);

        const stateAfterFit = get(drawingStore);

        // The scale and offset should have changed after clicking Fit
        // Note: The exact values depend on the calculateZoomToFit algorithm
        expect(stateAfterFit.scale).not.toBe(2.5);
        expect(stateAfterFit.offset).not.toEqual({ x: 100, y: 100 });
    });

    it('should display the Fit button next to the zoom percentage', () => {
        const testDrawing: DrawingData = {
            shapes: [],
            units: Unit.MM,
            fileName: 'test.dxf',
        };

        drawingStore.setDrawing(new Drawing(testDrawing), 'test.dxf');

        const { getByText, container } = render(Footer);
        const fitButton = getByText('Fit');
        const zoomInfo = container.querySelector('.zoom-info');
        const zoomControls = container.querySelector('.zoom-controls');

        // The Fit button and zoom info should be within the same container
        expect(zoomControls).toBeTruthy();
        expect(zoomControls?.contains(fitButton)).toBe(true);
        expect(zoomControls?.contains(zoomInfo)).toBe(true);
    });

    it('should show appropriate hover state', () => {
        const testDrawing: DrawingData = {
            shapes: [],
            units: Unit.MM,
            fileName: 'test.dxf',
        };

        drawingStore.setDrawing(new Drawing(testDrawing), 'test.dxf');

        const { getByText } = render(Footer);
        const fitButton = getByText('Fit') as HTMLButtonElement;

        // Check that the button has the expected classes
        expect(fitButton.classList.contains('fit-button')).toBe(true);

        // Check the title attribute for tooltip
        expect(fitButton.title).toBe('Zoom to fit');
    });
});
