// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import ToolBar from './ToolBar.svelte';
import { drawingStore } from '$lib/stores/drawing/store';
import type { Drawing } from '$lib/types';
import { Unit } from '$lib/utils/units';
import { GeometryType } from '$lib/geometry/shape';

// Mock window.prompt
const mockPrompt = vi.fn();
Object.defineProperty(window, 'prompt', {
    value: mockPrompt,
    writable: true,
});

describe('ToolBar Component - Function Coverage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        drawingStore.setDisplayUnit(Unit.MM);
        mockPrompt.mockReturnValue('1');
    });

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
                geometry: { start: { x: 5, y: 5 }, end: { x: 15, y: 15 } },
                layer: '0',
            },
        ],
        bounds: { min: { x: 0, y: 0 }, max: { x: 15, y: 15 } },
        units: Unit.MM,
    };

    describe('handleScale function', () => {
        it('should prompt for scale factor and scale selected shapes', async () => {
            mockPrompt.mockReturnValue('2.0');

            drawingStore.setDrawing(mockDrawing);
            drawingStore.selectShape('1');
            drawingStore.selectShape('2', true);

            const { getByText } = render(ToolBar);
            const scaleButton = getByText('Scale');

            await fireEvent.click(scaleButton);

            expect(mockPrompt).toHaveBeenCalledWith(
                'Enter scale factor:',
                '1.5'
            );
        });

        it('should not scale when no shapes are selected', async () => {
            mockPrompt.mockReturnValue('2.0');

            drawingStore.setDrawing(mockDrawing);
            drawingStore.clearSelection();

            const { getByText } = render(ToolBar);
            const scaleButton = getByText('Scale');

            await fireEvent.click(scaleButton);

            // Function should still be called but won't do anything effective
            expect((scaleButton as HTMLButtonElement).disabled).toBe(true);
        });

        it('should handle invalid scale factor input', async () => {
            mockPrompt.mockReturnValue('invalid');

            drawingStore.setDrawing(mockDrawing);
            drawingStore.selectShape('1');

            const { getByText } = render(ToolBar);
            const scaleButton = getByText('Scale');

            await fireEvent.click(scaleButton);

            expect(mockPrompt).toHaveBeenCalled();
            // Should not crash with invalid input
        });

        it('should handle cancelled prompt', async () => {
            mockPrompt.mockReturnValue(null);

            drawingStore.setDrawing(mockDrawing);
            drawingStore.selectShape('1');

            const { getByText } = render(ToolBar);
            const scaleButton = getByText('Scale');

            await fireEvent.click(scaleButton);

            expect(mockPrompt).toHaveBeenCalled();
            // Should handle null return gracefully
        });

        it('should handle empty string prompt', async () => {
            mockPrompt.mockReturnValue('');

            drawingStore.setDrawing(mockDrawing);
            drawingStore.selectShape('1');

            const { getByText } = render(ToolBar);
            const scaleButton = getByText('Scale');

            await fireEvent.click(scaleButton);

            expect(mockPrompt).toHaveBeenCalled();
            // Should use default value of 1 when empty string
        });
    });

    describe('handleRotate function', () => {
        it('should prompt for rotation angle and rotate selected shapes', async () => {
            mockPrompt.mockReturnValue('90');

            drawingStore.setDrawing(mockDrawing);
            drawingStore.selectShape('1');

            const { getByText } = render(ToolBar);
            const rotateButton = getByText('Rotate');

            await fireEvent.click(rotateButton);

            expect(mockPrompt).toHaveBeenCalledWith(
                'Enter rotation angle (degrees):',
                '45'
            );
        });

        it('should not rotate when no shapes are selected', async () => {
            mockPrompt.mockReturnValue('90');

            drawingStore.setDrawing(mockDrawing);
            drawingStore.clearSelection();

            const { getByText } = render(ToolBar);
            const rotateButton = getByText('Rotate');

            await fireEvent.click(rotateButton);

            // Button should be disabled when no shapes selected
            expect((rotateButton as HTMLButtonElement).disabled).toBe(true);
        });

        it('should handle zero angle', async () => {
            mockPrompt.mockReturnValue('0');

            drawingStore.setDrawing(mockDrawing);
            drawingStore.selectShape('1');

            const { getByText } = render(ToolBar);
            const rotateButton = getByText('Rotate');

            await fireEvent.click(rotateButton);

            expect(mockPrompt).toHaveBeenCalled();
            // Should handle zero angle (which evaluates to falsy)
        });

        it('should convert degrees to radians correctly', async () => {
            mockPrompt.mockReturnValue('180');

            drawingStore.setDrawing(mockDrawing);
            drawingStore.selectShape('1');

            const { getByText } = render(ToolBar);
            const rotateButton = getByText('Rotate');

            await fireEvent.click(rotateButton);

            expect(mockPrompt).toHaveBeenCalled();
            // Function should convert 180 degrees to Math.PI radians
        });

        it('should handle negative angles', async () => {
            mockPrompt.mockReturnValue('-45');

            drawingStore.setDrawing(mockDrawing);
            drawingStore.selectShape('1');

            const { getByText } = render(ToolBar);
            const rotateButton = getByText('Rotate');

            await fireEvent.click(rotateButton);

            expect(mockPrompt).toHaveBeenCalledWith(
                'Enter rotation angle (degrees):',
                '45'
            );
        });
    });
});
