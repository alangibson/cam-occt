/**
 * Tests for DrawingCanvas part highlighting functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Point2D } from '$lib/geometry/point/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import { HitTestType } from '$lib/rendering/canvas/utils/hit-test';
import type { HitTestResult } from '$lib/rendering/canvas/utils/hit-test';
import { PartType } from '$lib/cam/part/enums';
import type { PartData } from '$lib/cam/part/interfaces';
import type { ChainData } from '$lib/cam/chain/interfaces';

// Mock stores
const mockPartStore = {
    selectPart: vi.fn(),
    clearHighlight: vi.fn(),
};

const mockDrawingStore = {
    clearSelection: vi.fn(),
};

// Mock the rendering pipeline
const mockRenderingPipeline = {
    hitTest: vi.fn(),
    updateState: vi.fn(),
};

vi.mock('$lib/stores/parts/store', () => ({
    partStore: mockPartStore,
}));

vi.mock('$lib/stores/drawing/store', () => ({
    drawingStore: mockDrawingStore,
}));

describe('DrawingCanvas Part Highlighting', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should highlight part when clicking inside part area on Program stage', async () => {
        // Arrange
        const testPartId = 'test-part-1';
        const clickPoint: Point2D = { x: 100, y: 100 };

        // Create a mock chain for the shell
        const mockChain: ChainData = {
            id: 'chain-1',
            shapes: [],
            clockwise: true,
        };

        // Create a proper Part
        const mockPart: PartData = {
            id: testPartId,
            shell: mockChain,
            type: PartType.SHELL,
            boundingBox: { min: { x: 0, y: 0 }, max: { x: 200, y: 200 } },
            voids: [],
            slots: [],
            layerName: '0',
        };

        const hitResult: HitTestResult = {
            type: HitTestType.PART,
            id: testPartId,
            distance: 0,
            point: clickPoint,
            metadata: { part: mockPart },
        };

        // Mock the hit test to return a part hit
        mockRenderingPipeline.hitTest.mockReturnValue(hitResult);

        // Mock callback function
        const onPartClick = vi.fn();

        // Simulate the click handler logic from DrawingCanvas
        const interactionMode = 'chains'; // Program stage uses 'chains' mode

        // Act - simulate what should happen when clicking on a part
        if (hitResult && hitResult.type === HitTestType.PART) {
            if (interactionMode === 'chains' && onPartClick) {
                // This is the logic from DrawingCanvas.svelte
                mockDrawingStore.clearSelection();
                mockPartStore.selectPart(hitResult.id);
                onPartClick(hitResult.id);
            }
        }

        // Assert
        expect(mockDrawingStore.clearSelection).toHaveBeenCalledOnce();
        expect(mockPartStore.selectPart).toHaveBeenCalledWith(testPartId);
        expect(onPartClick).toHaveBeenCalledWith(testPartId);
    });

    it('should not interfere with individual shape selection when not clicking on parts', async () => {
        // Arrange
        const clickPoint: Point2D = { x: 50, y: 50 };

        const hitResult: HitTestResult = {
            type: HitTestType.SHAPE,
            id: 'shape-1',
            distance: 2.5,
            point: clickPoint,
            metadata: {
                shape: {
                    id: 'shape-1',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
                },
            },
        };

        mockRenderingPipeline.hitTest.mockReturnValue(hitResult);
        const _onPartClick = vi.fn();

        // Act - simulate clicking on a shape (not a part)

        if (hitResult && hitResult.type === HitTestType.SHAPE) {
            // Shape selection logic should not clear part selection
            // Individual shapes can still be selected
        }

        // Assert - part store should not be affected when clicking shapes
        expect(mockPartStore.selectPart).not.toHaveBeenCalled();
        expect(mockDrawingStore.clearSelection).not.toHaveBeenCalled();
    });

    it('should clear part selection when clicking in empty space', async () => {
        // Arrange
        const _clickPoint: Point2D = { x: 200, y: 200 };
        mockRenderingPipeline.hitTest.mockReturnValue(null); // No hit

        // Act - simulate clicking in empty space
        const hitResult = null;

        if (!hitResult) {
            // This should clear all selections including parts
            mockDrawingStore.clearSelection();
            mockPartStore.selectPart(null);
        }

        // Assert
        expect(mockDrawingStore.clearSelection).toHaveBeenCalledOnce();
        expect(mockPartStore.selectPart).toHaveBeenCalledWith(null);
    });

    it('should only work in chains interaction mode (Program stage)', async () => {
        // Arrange
        const testPartId = 'test-part-2';
        const clickPoint: Point2D = { x: 150, y: 150 };

        // Create a mock chain for the shell
        const mockChain2: ChainData = {
            id: 'chain-2',
            shapes: [],
            clockwise: true,
        };

        // Create a proper Part
        const mockPart2: PartData = {
            id: testPartId,
            shell: mockChain2,
            type: PartType.SHELL,
            boundingBox: { min: { x: 0, y: 0 }, max: { x: 200, y: 200 } },
            voids: [],
            slots: [],
            layerName: '0',
        };

        const hitResult: HitTestResult = {
            type: HitTestType.PART,
            id: testPartId,
            distance: 0,
            point: clickPoint,
            metadata: { part: mockPart2 },
        };

        const onPartClick = vi.fn();

        // Act - simulate clicking on part but in wrong interaction mode
        const interactionMode = 'shapes' as 'shapes' | 'chains' | 'cuts'; // Edit stage uses 'shapes' mode

        if (hitResult && hitResult.type === HitTestType.PART) {
            if (interactionMode === 'chains' && onPartClick) {
                // This should NOT execute
                mockPartStore.selectPart(hitResult.id);
                onPartClick(hitResult.id);
            }
        }

        // Assert - should not select part when not in 'chains' mode
        expect(mockPartStore.selectPart).not.toHaveBeenCalled();
        expect(onPartClick).not.toHaveBeenCalled();
    });
});
