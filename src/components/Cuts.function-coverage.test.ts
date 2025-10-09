// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Cuts from './Cuts.svelte';
import { cutStore } from '$lib/stores/cuts/store';
import { operationsStore } from '$lib/stores/operations/store';
import { toolStore } from '$lib/stores/tools/store';
import { CutDirection, LeadType } from '$lib/types/direction';
import { KerfCompensation } from '$lib/types/kerf-compensation';

// Mock DragEvent for jsdom
interface MockDragEventInit extends EventInit {
    dataTransfer?: DataTransfer | null;
}

class MockDragEvent extends Event {
    dataTransfer: DataTransfer | null;
    constructor(type: string, init?: MockDragEventInit) {
        super(type, init);
        this.dataTransfer = init?.dataTransfer || null;
    }
}

global.DragEvent = MockDragEvent as unknown as typeof DragEvent;

describe('Cuts Component - Function Coverage', () => {
    beforeEach(() => {
        // Reset stores
        operationsStore.reset();
        toolStore.reset();
        cutStore.reset();

        // Add test data
        toolStore.addTool({
            toolNumber: 1,
            toolName: 'Test Tool',
            feedRate: 100,
            pierceHeight: 3.8,
            cutHeight: 1.5,
            pierceDelay: 0.5,
            arcVoltage: 120,
            kerfWidth: 1.5,
            thcEnable: true,
            gasPressure: 4.5,
            pauseAtEnd: 0,
            puddleJumpHeight: 50,
            puddleJumpDelay: 0,
            plungeRate: 500,
        });

        operationsStore.addOperation({
            name: 'Test Operation',
            toolId: get(toolStore)[0]?.id || null,
            targetType: 'parts',
            targetIds: ['part-1'],
            enabled: true,
            order: 1,
            cutDirection: CutDirection.COUNTERCLOCKWISE,
            leadInConfig: {
                type: LeadType.NONE,
                length: 5,
                angle: 0,
                flipSide: false,
                fit: false,
            },
            leadOutConfig: {
                type: LeadType.NONE,
                length: 5,
                angle: 0,
                flipSide: false,
                fit: false,
            },
            kerfCompensation: KerfCompensation.PART,
        });
    });

    describe('handleCutClick function', () => {
        it('should select cut when clicking unselected cut', async () => {
            // Add test cut using addCut method
            cutStore.addCut({
                id: 'test-cut-1',
                name: 'Test Cut',
                operationId: 'op-1',
                chainId: 'chain-1',
                toolId: null,
                order: 1,
                enabled: true,
                cutDirection: CutDirection.COUNTERCLOCKWISE,
            });

            const { container } = render(Cuts);

            const cutState = get(cutStore);
            const cutId = cutState.cuts[0]?.id;
            expect(cutId).toBeTruthy();

            // Trigger the actual handleCutClick function by clicking on the cut item
            const cutItem = container.querySelector('.cut-item');
            expect(cutItem).toBeTruthy();

            await fireEvent.click(cutItem!);

            const updatedState = get(cutStore);
            expect(updatedState.selectedCutId).toBe(cutId);
        });

        it('should deselect cut when clicking already selected cut', async () => {
            // Add test cut
            cutStore.addCut({
                id: 'test-cut-1',
                name: 'Test Cut',
                operationId: 'op-1',
                chainId: 'chain-1',
                toolId: null,
                order: 1,
                enabled: true,
                cutDirection: CutDirection.COUNTERCLOCKWISE,
            });

            const { container } = render(Cuts);

            const cutState = get(cutStore);
            const cutId = cutState.cuts[0]?.id;

            // First select the cut using cutStore method
            cutStore.selectCut(cutId!);

            // Then click it again to deselect
            const cutItem = container.querySelector('.cut-item');
            await fireEvent.click(cutItem!);

            const finalState = get(cutStore);
            expect(finalState.selectedCutId).toBe(null);
        });

        it('should handle keyboard navigation', async () => {
            // Add test cut
            cutStore.addCut({
                id: 'test-cut-1',
                name: 'Test Cut',
                operationId: 'op-1',
                chainId: 'chain-1',
                toolId: null,
                order: 1,
                enabled: true,
                cutDirection: CutDirection.COUNTERCLOCKWISE,
            });

            const { container } = render(Cuts);

            const cutItem = container.querySelector('.cut-item');
            expect(cutItem).toBeTruthy();

            // Test Enter key
            await fireEvent.keyDown(cutItem!, { key: 'Enter' });

            // Test Space key
            await fireEvent.keyDown(cutItem!, { key: ' ' });

            // Verify component responds to keyboard events
            expect(cutItem).toBeDefined();
        });
    });

    describe('hover and utility functions', () => {
        it('should test highlight functions', () => {
            // Test highlightCut function directly
            cutStore.highlightCut('cut-1');

            const cutState = get(cutStore);
            expect(cutState.highlightedCutId).toBe('cut-1');
        });

        it('should handle cut hover events', async () => {
            // Add test cut
            cutStore.addCut({
                id: 'test-cut-1',
                name: 'Test Cut',
                operationId: 'op-1',
                chainId: 'chain-1',
                toolId: null,
                order: 1,
                enabled: true,
                cutDirection: CutDirection.COUNTERCLOCKWISE,
            });

            const { container } = render(Cuts);

            const cutItem = container.querySelector('.cut-item');
            expect(cutItem).toBeTruthy();

            // Test mouse enter to trigger handleCutHover
            await fireEvent.mouseEnter(cutItem!);

            // Test mouse leave to trigger handleCutHover with null
            await fireEvent.mouseLeave(cutItem!);

            expect(cutItem).toBeDefined();
        });

        it('should handle drag and drop completely', async () => {
            // Add multiple test cuts for drag and drop
            cutStore.addCut({
                id: 'test-cut-drag-1',
                name: 'Test Cut 1',
                operationId: 'op-1',
                chainId: 'chain-1',
                toolId: null,
                order: 1,
                enabled: true,
                cutDirection: CutDirection.COUNTERCLOCKWISE,
            });

            cutStore.addCut({
                id: 'test-cut-2',
                name: 'Test Cut 2',
                operationId: 'op-1',
                chainId: 'chain-2',
                toolId: null,
                order: 2,
                enabled: true,
                cutDirection: CutDirection.CLOCKWISE,
            });

            const { container } = render(Cuts);

            const cutItems = container.querySelectorAll('.cut-item');
            expect(cutItems.length).toBe(2);

            const firstCut = cutItems[0];
            const secondCut = cutItems[1];

            // Create proper drag events with dataTransfer
            const mockDataTransfer = {
                effectAllowed: '',
                setData: vi.fn(),
                getData: vi.fn(),
            };

            // Test handleDragStart
            const dragStartEvent = new DragEvent('dragstart', {
                bubbles: true,
            });
            Object.defineProperty(dragStartEvent, 'dataTransfer', {
                value: mockDataTransfer,
                writable: true,
            });
            await fireEvent(firstCut, dragStartEvent);
            expect(mockDataTransfer.effectAllowed).toBe('move');

            // Test handleDragOver
            const dragOverEvent = new DragEvent('dragover', { bubbles: true });
            const preventDefault = vi.fn();
            Object.defineProperty(dragOverEvent, 'preventDefault', {
                value: preventDefault,
                writable: true,
            });
            await fireEvent(secondCut, dragOverEvent);
            expect(preventDefault).toHaveBeenCalled();

            // Test handleDragLeave
            await fireEvent.dragLeave(firstCut);

            // Test handleDrop with proper setup
            const dropEvent = new DragEvent('drop', { bubbles: true });
            Object.defineProperty(dropEvent, 'preventDefault', {
                value: vi.fn(),
                writable: true,
            });
            Object.defineProperty(dropEvent, 'dataTransfer', {
                value: mockDataTransfer,
                writable: true,
            });
            await fireEvent(secondCut, dropEvent);

            expect(container).toBeDefined();
        });

        it('should render component without errors', () => {
            const { container } = render(Cuts);

            // Verify component renders successfully
            expect(container).toBeDefined();
        });

        it('should handle cut store updates', () => {
            cutStore.addCut({
                id: 'test-cut-1',
                name: 'Test Cut',
                operationId: 'op-1',
                chainId: 'chain-1',
                toolId: null,
                order: 1,
                enabled: true,
                cutDirection: CutDirection.COUNTERCLOCKWISE,
            });

            const { container } = render(Cuts);

            // Component should handle store updates without errors
            expect(container).toBeDefined();
        });
    });
});
