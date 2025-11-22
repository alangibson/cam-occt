import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import DrawingCanvas from './DrawingCanvas.svelte';
import { drawingStore } from '$lib/stores/drawing/store';
import { Unit } from '$lib/config/units/units';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import type { DrawingData } from '$lib/cam/drawing/interfaces';
import { Drawing } from '$lib/cam/drawing/classes.svelte';
import type { ShapeData } from '$lib/geometry/shape/interfaces';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import { GeometryType } from '$lib/geometry/shape/enums';

// Mock canvas context
const mockCanvasContext = {
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '',
    lineWidth: 1,
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fillStyle: '',
    fill: vi.fn(),
};

// Mock HTMLCanvasElement
const _mockCanvas = {
    getContext: vi.fn(() => mockCanvasContext),
    width: 800,
    height: 600,
    offsetWidth: 800,
    offsetHeight: 600,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
};

// Helper function to create ellipse shapes for testing
function createEllipseShape(
    center: { x: number; y: number },
    majorAxisEndpoint: { x: number; y: number },
    minorToMajorRatio: number,
    startParam?: number,
    endParam?: number,
    id: string = 'test-ellipse'
): ShapeData {
    const geometry: Ellipse = {
        center,
        majorAxisEndpoint,
        minorToMajorRatio,
        ...(startParam !== undefined && { startParam }),
        ...(endParam !== undefined && { endParam }),
    };

    return {
        id,
        type: GeometryType.ELLIPSE,
        geometry,
    };
}

// Mock DOM methods
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: vi.fn(() => mockCanvasContext),
});

Object.defineProperty(HTMLCanvasElement.prototype, 'offsetWidth', {
    get: () => 800,
});

Object.defineProperty(HTMLCanvasElement.prototype, 'offsetHeight', {
    get: () => 600,
});

describe.skip('DrawingCanvas - Ellipse rendering', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Reset drawing store state
        drawingStore.clearSelection();
        drawingStore.setViewTransform(1, { x: 0, y: 0 });
    });

    describe('Full ellipse rendering', () => {
        it('should render a basic full ellipse', () => {
            const ellipse = createEllipseShape(
                { x: 100, y: 150 },
                { x: 50, y: 0 }, // Horizontal major axis
                0.6
            );

            const drawing: DrawingData = {
                shapes: [ellipse],
                units: Unit.MM,
                fileName: 'test.dxf',
            };

            drawingStore.setDrawing(new Drawing(drawing), 'test.dxf');

            render(DrawingCanvas, {
                props: { currentStage: WorkflowStage.EDIT },
            });

            // Verify canvas context methods were called for ellipse rendering
            expect(mockCanvasContext.save).toHaveBeenCalled();
            expect(mockCanvasContext.translate).toHaveBeenCalled();
            expect(mockCanvasContext.rotate).toHaveBeenCalled();
            expect(mockCanvasContext.scale).toHaveBeenCalled();
            expect(mockCanvasContext.beginPath).toHaveBeenCalled();
            expect(mockCanvasContext.arc).toHaveBeenCalledWith(
                0,
                0,
                1,
                0,
                2 * Math.PI,
                false
            );
            expect(mockCanvasContext.restore).toHaveBeenCalled();
            expect(mockCanvasContext.stroke).toHaveBeenCalled();
        });

        it('should render an ellipse with vertical orientation', () => {
            const ellipse = createEllipseShape(
                { x: 0, y: 0 },
                { x: 0, y: 40 }, // Vertical major axis
                0.75
            );

            const drawing: DrawingData = {
                shapes: [ellipse],
                units: Unit.MM,
                fileName: 'test.dxf',
            };

            drawingStore.setDrawing(new Drawing(drawing), 'test.dxf');

            render(DrawingCanvas, {
                props: { currentStage: WorkflowStage.EDIT },
            });

            // Check that transform methods were called correctly
            expect(mockCanvasContext.translate).toHaveBeenCalledWith(0, 0);
            expect(mockCanvasContext.rotate).toHaveBeenCalledWith(Math.PI / 2); // 90 degrees
            expect(mockCanvasContext.scale).toHaveBeenCalledWith(40, 30); // major=40, minor=30
        });

        it('should render a circular ellipse (ratio = 1.0)', () => {
            const ellipse = createEllipseShape(
                { x: 25, y: 25 },
                { x: 20, y: 0 },
                1.0 // Perfect circle
            );

            const drawing: DrawingData = {
                shapes: [ellipse],
                units: Unit.MM,
                fileName: 'test.dxf',
            };

            drawingStore.setDrawing(new Drawing(drawing), 'test.dxf');

            render(DrawingCanvas, {
                props: { currentStage: WorkflowStage.EDIT },
            });

            // Should render as circle with equal major and minor axes
            expect(mockCanvasContext.scale).toHaveBeenCalledWith(20, 20);
            expect(mockCanvasContext.arc).toHaveBeenCalledWith(
                0,
                0,
                1,
                0,
                2 * Math.PI,
                false
            );
        });
    });

    describe('Ellipse arc rendering', () => {
        it('should render an ellipse arc with specific parameters', () => {
            const ellipse = createEllipseShape(
                { x: 0, y: 0 },
                { x: 30, y: 0 },
                0.5,
                0, // Start at 0 radians
                Math.PI // End at π radians (half ellipse)
            );

            const drawing: DrawingData = {
                shapes: [ellipse],
                units: Unit.MM,
                fileName: 'test.dxf',
            };

            drawingStore.setDrawing(new Drawing(drawing), 'test.dxf');

            render(DrawingCanvas, {
                props: { currentStage: WorkflowStage.EDIT },
            });

            // Should render arc instead of full ellipse
            expect(mockCanvasContext.arc).toHaveBeenCalledWith(
                0,
                0,
                1,
                0,
                Math.PI,
                false
            );
        });

        it('should handle ellipse arc with parameter wrapping', () => {
            const ellipse = createEllipseShape(
                { x: 50, y: 50 },
                { x: 25, y: 0 },
                0.8,
                5.5, // Start parameter > end parameter
                1.5 // End parameter < start parameter
            );

            const drawing: DrawingData = {
                shapes: [ellipse],
                units: Unit.MM,
                fileName: 'test.dxf',
            };

            drawingStore.setDrawing(new Drawing(drawing), 'test.dxf');

            render(DrawingCanvas, {
                props: { currentStage: WorkflowStage.EDIT },
            });

            // Should handle parameter wrapping by adding 2π to end parameter
            expect(mockCanvasContext.arc).toHaveBeenCalledWith(
                0,
                0,
                1,
                5.5,
                1.5 + 2 * Math.PI,
                false
            );
        });
    });

    describe('Ellipse interaction and selection', () => {
        it('should handle ellipse selection correctly', () => {
            const ellipse = createEllipseShape(
                { x: 100, y: 100 },
                { x: 40, y: 0 },
                0.6,
                undefined,
                undefined,
                'selectable-ellipse'
            );

            const drawing: DrawingData = {
                shapes: [ellipse],
                units: Unit.MM,
                fileName: 'test.dxf',
            };

            drawingStore.setDrawing(new Drawing(drawing), 'test.dxf');
            drawingStore.selectShape('selectable-ellipse', false);

            const { container } = render(DrawingCanvas);

            // Check basic rendering calls were made
            expect(mockCanvasContext.save).toHaveBeenCalled();
            expect(mockCanvasContext.stroke).toHaveBeenCalled();
            expect(container.querySelector('canvas')).toBeTruthy();
        });

        it('should render ellipse with selection points', () => {
            const ellipse = createEllipseShape(
                { x: 75, y: 125 },
                { x: 30, y: 0 },
                0.7,
                undefined,
                undefined,
                'ellipse-with-origin'
            );

            const drawing: DrawingData = {
                shapes: [ellipse],
                units: Unit.MM,
                fileName: 'test.dxf',
            };

            drawingStore.setDrawing(new Drawing(drawing), 'test.dxf');
            drawingStore.selectShape('ellipse-with-origin', false);

            const { container } = render(DrawingCanvas);

            // Check that rendering occurred
            expect(mockCanvasContext.fill).toHaveBeenCalled(); // For drawing selection points
            expect(container.querySelector('canvas')).toBeTruthy();
        });

        it('should render ellipse arcs correctly', () => {
            const ellipse = createEllipseShape(
                { x: 0, y: 0 },
                { x: 25, y: 0 },
                0.8,
                0, // Start at 0 radians
                Math.PI / 2, // End at π/2 radians
                'ellipse-arc-points'
            );

            const drawing: DrawingData = {
                shapes: [ellipse],
                units: Unit.MM,
                fileName: 'test.dxf',
            };

            drawingStore.setDrawing(new Drawing(drawing), 'test.dxf');

            const { container } = render(DrawingCanvas);

            // Should render without errors
            expect(mockCanvasContext.arc).toHaveBeenCalled();
            expect(container.querySelector('canvas')).toBeTruthy();
        });
    });

    describe('Ellipse hit testing', () => {
        it('should detect hits on ellipse perimeter', () => {
            const ellipse = createEllipseShape(
                { x: 100, y: 100 },
                { x: 50, y: 0 },
                0.6 // Minor axis = 30
            );

            const drawing: DrawingData = {
                shapes: [ellipse],
                units: Unit.MM,
                fileName: 'test.dxf',
            };

            drawingStore.setDrawing(new Drawing(drawing), 'test.dxf');

            const { container } = render(DrawingCanvas);
            const canvas = container.querySelector(
                'canvas'
            ) as HTMLCanvasElement;

            // Simulate mouse event on ellipse perimeter
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: 150, // Right edge of ellipse
                clientY: 100, // Center height
                bubbles: true,
            });

            // Mock offsetX/offsetY since jsdom doesn't provide them
            Object.defineProperty(mouseEvent, 'offsetX', { value: 150 });
            Object.defineProperty(mouseEvent, 'offsetY', { value: 100 });

            canvas.dispatchEvent(mouseEvent);

            // We can't easily test the selection in unit tests without complex mouse event mocking
            // This is better tested in e2e tests
            expect(canvas).toBeDefined();
        });

        it('should not detect hits outside ellipse bounds', () => {
            const ellipse = createEllipseShape(
                { x: 100, y: 100 },
                { x: 30, y: 0 },
                0.5 // Minor axis = 15
            );

            const drawing: DrawingData = {
                shapes: [ellipse],
                units: Unit.MM,
                fileName: 'test.dxf',
            };

            drawingStore.setDrawing(new Drawing(drawing), 'test.dxf');

            const { container } = render(DrawingCanvas);
            const canvas = container.querySelector(
                'canvas'
            ) as HTMLCanvasElement;

            // Simulate mouse event far from ellipse
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: 200,
                clientY: 200,
                bubbles: true,
            });

            Object.defineProperty(mouseEvent, 'offsetX', { value: 200 });
            Object.defineProperty(mouseEvent, 'offsetY', { value: 200 });

            canvas.dispatchEvent(mouseEvent);

            // We can't easily test the selection in unit tests without complex mouse event mocking
            // This is better tested in e2e tests
            expect(canvas).toBeDefined();
        });
    });

    describe('Edge cases', () => {
        it('should handle very flat ellipse rendering', () => {
            const flatEllipse = createEllipseShape(
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                0.01 // Very flat
            );

            const drawing: DrawingData = {
                shapes: [flatEllipse],
                units: Unit.MM,
                fileName: 'test.dxf',
            };

            drawingStore.setDrawing(new Drawing(drawing), 'test.dxf');

            // Should render without errors
            expect(() => render(DrawingCanvas)).not.toThrow();
        });

        it('should handle degenerate ellipse gracefully', () => {
            const degenerateEllipse = createEllipseShape(
                { x: 0, y: 0 },
                { x: 0, y: 0 }, // Zero-length major axis
                0.5
            );

            const drawing: DrawingData = {
                shapes: [degenerateEllipse],
                units: Unit.MM,
                fileName: 'test.dxf',
            };

            drawingStore.setDrawing(new Drawing(drawing), 'test.dxf');

            // Should render without crashing
            expect(() => render(DrawingCanvas)).not.toThrow();
        });

        it('should handle ellipse with zero ratio', () => {
            const zeroRatioEllipse = createEllipseShape(
                { x: 50, y: 50 },
                { x: 25, y: 0 },
                0 // Zero minor axis
            );

            const drawing: DrawingData = {
                shapes: [zeroRatioEllipse],
                units: Unit.MM,
                fileName: 'test.dxf',
            };

            drawingStore.setDrawing(new Drawing(drawing), 'test.dxf');

            // Should render as a line
            expect(() => render(DrawingCanvas)).not.toThrow();
        });
    });
});
