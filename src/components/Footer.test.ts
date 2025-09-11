// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import Footer from './Footer.svelte';
import { drawingStore } from '$lib/stores/drawing';
import { Unit } from '$lib/utils/units';
import type { Drawing } from '$lib/types';
import type { DrawingSize } from '$lib/algorithms/drawing-size/drawing-size';
import { GeometryType } from '$lib/geometry/shape';

// Mock the drawing size calculation
vi.mock('$lib/algorithms/drawing-size/drawing-size', () => ({
    calculateDrawingSize: vi.fn(),
}));

describe('Footer Component', () => {
    beforeEach(() => {
        drawingStore.setDisplayUnit(Unit.MM);
    });

    it('should render without errors', () => {
        const { container } = render(Footer);
        expect(container).toBeDefined();
    });

    it('should show "No drawing loaded" when no drawing is present', () => {
        const { getByText } = render(Footer);
        expect(getByText('No drawing loaded')).toBeDefined();
    });

    it('should show zoom percentage', () => {
        // Set zoom to 150%
        drawingStore.setViewTransform(1.5, { x: 0, y: 0 });

        const { getByText } = render(Footer);
        expect(getByText('Zoom: 150%')).toBeDefined();
    });

    it('should format zoom percentage correctly', async () => {
        const { getByText, rerender } = render(Footer);

        // Test various zoom levels
        drawingStore.setViewTransform(0.5, { x: 0, y: 0 });
        await rerender({});
        expect(getByText('Zoom: 50%')).toBeDefined();

        drawingStore.setViewTransform(2.25, { x: 0, y: 0 });
        await rerender({});
        expect(getByText('Zoom: 225%')).toBeDefined();
    });

    it('should show calculating message during size calculation', async () => {
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

        // Mock a delayed calculation
        const { calculateDrawingSize } = await import(
            '$lib/algorithms/drawing-size/drawing-size'
        );
        vi.mocked(calculateDrawingSize).mockImplementation(() => ({
            width: 10,
            height: 10,
            units: Unit.MM,
            source: 'calculated',
        }));

        drawingStore.setDrawing(mockDrawing);
        const { getByText } = render(Footer);

        // Should show calculating initially
        expect(getByText('Calculating size...')).toBeDefined();
    });

    it('should display drawing size when calculation completes', async () => {
        const mockDrawing: Drawing = {
            shapes: [
                {
                    id: '1',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 50, y: 30 } },
                    layer: '0',
                },
            ],
            bounds: { min: { x: 0, y: 0 }, max: { x: 50, y: 30 } },
            units: Unit.MM,
        };

        // Mock successful calculation
        const { calculateDrawingSize } = await import(
            '$lib/algorithms/drawing-size/drawing-size'
        );
        vi.mocked(calculateDrawingSize).mockResolvedValue({
            width: 50,
            height: 30,
            units: Unit.MM,
            source: 'calculated',
        } as DrawingSize);

        drawingStore.setDrawing(mockDrawing);
        const { getByText } = render(Footer);

        // Wait for calculation to complete and check parts separately since text is split
        await waitFor(() => {
            expect(getByText(/Size: 50\.00 mm × 30\.00 mm/)).toBeDefined();
            expect(getByText('(calculated)')).toBeDefined();
        });
    });

    it('should show error state when size calculation fails', async () => {
        const mockDrawing: Drawing = {
            shapes: [],
            bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
            units: Unit.MM,
        };

        // Mock failed calculation
        const { calculateDrawingSize } = await import(
            '$lib/algorithms/drawing-size/drawing-size'
        );
        vi.mocked(calculateDrawingSize).mockRejectedValue(
            new Error('Calculation failed')
        );

        drawingStore.setDrawing(mockDrawing);

        // Suppress console error for this test since we expect an error
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        const { getByText } = render(Footer);

        // Wait for error state
        await waitFor(() => {
            expect(getByText('Unable to calculate size')).toBeDefined();
        });

        // Restore console.error
        consoleSpy.mockRestore();
    });
});
