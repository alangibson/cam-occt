// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import { get } from 'svelte/store';
import ToolTable from './ToolTable.svelte';
import { toolStore } from '$lib/stores/tools';

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
});

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

// Mock getAnimations for jsdom
Object.defineProperty(Element.prototype, 'getAnimations', {
    value: function () {
        return [];
    },
    writable: true,
});

describe('ToolTable Component - Function Coverage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        toolStore.reset();
        // Prevent auto tool creation by default
        localStorageMock.getItem.mockReturnValue('[]');
    });

    afterEach(() => {
        // Svelte 5 doesn't use $destroy(), component cleanup happens automatically
    });

    describe('addNewTool function', () => {
        it('should create first tool with number 1', async () => {
            // Enable auto tool creation for this test
            localStorageMock.getItem.mockReturnValue(null);

            render(ToolTable);

            // Should automatically add a tool on mount when no saved tools
            const tools = get(toolStore);
            expect(tools.length).toBe(1);
            expect(tools[0].toolNumber).toBe(1);
            expect(tools[0].toolName).toBe('Tool 1');
        });

        it('should increment tool number correctly', async () => {
            // Component automatically adds Tool 1 on mount, then we add another manually
            localStorageMock.getItem.mockReturnValue(null);

            const { container } = render(ToolTable);

            // Should have 1 tool from auto-creation
            let tools = get(toolStore);
            expect(tools.length).toBe(1);

            const addButton =
                container.querySelector('.btn-primary') ||
                container.querySelector('button');
            if (addButton) {
                await fireEvent.click(addButton);
            }

            tools = get(toolStore);
            expect(tools.length).toBe(2);
            expect(tools[1].toolNumber).toBe(2);
            expect(tools[1].toolName).toBe('Tool 2');
        });

        it('should create tool with correct default values', async () => {
            const { container } = render(ToolTable);

            const addButton =
                container.querySelector('.btn-primary') ||
                container.querySelector('button');
            if (addButton) {
                await fireEvent.click(addButton);
            }

            const tools = get(toolStore);
            const newTool = tools[tools.length - 1];

            expect(newTool.feedRate).toBe(100);
            expect(newTool.rapidRate).toBe(3000);
            expect(newTool.pierceHeight).toBe(3.8);
            expect(newTool.pierceDelay).toBe(0.5);
            expect(newTool.arcVoltage).toBe(120);
            expect(newTool.kerfWidth).toBe(1.5);
            expect(newTool.thcEnable).toBe(true);
            expect(newTool.gasPressure).toBe(4.5);
            expect(newTool.pauseAtEnd).toBe(0);
            expect(newTool.puddleJumpHeight).toBe(50);
            expect(newTool.puddleJumpDelay).toBe(0);
            expect(newTool.plungeRate).toBe(500);
        });

        it('should handle max tool number calculation with gaps', async () => {
            // Use JSON with existing tools to prevent auto-creation of Tool 1
            const existingTools = JSON.stringify([
                {
                    toolNumber: 5,
                    toolName: 'Tool 5',
                    feedRate: 100,
                    rapidRate: 3000,
                    pierceHeight: 3.8,
                    pierceDelay: 0.5,
                    arcVoltage: 120,
                    kerfWidth: 1.5,
                    thcEnable: true,
                    gasPressure: 4.5,
                    pauseAtEnd: 0,
                    puddleJumpHeight: 50,
                    puddleJumpDelay: 0,
                    plungeRate: 500,
                    id: 'tool-5',
                },
                {
                    toolNumber: 10,
                    toolName: 'Tool 10',
                    feedRate: 100,
                    rapidRate: 3000,
                    pierceHeight: 3.8,
                    pierceDelay: 0.5,
                    arcVoltage: 120,
                    kerfWidth: 1.5,
                    thcEnable: true,
                    gasPressure: 4.5,
                    pauseAtEnd: 0,
                    puddleJumpHeight: 50,
                    puddleJumpDelay: 0,
                    plungeRate: 500,
                    id: 'tool-10',
                },
            ]);

            localStorageMock.getItem.mockReturnValue(existingTools);

            const { container } = render(ToolTable);

            // Should have 2 existing tools
            let tools = get(toolStore);
            expect(tools.length).toBe(2);

            const addButton = container.querySelector('.btn-primary');
            expect(addButton).toBeTruthy();
            await fireEvent.click(addButton!);

            tools = get(toolStore);
            const newTool = tools[tools.length - 1];
            expect(newTool.toolNumber).toBe(11); // Should be max + 1
        });
    });

    describe('localStorage integration', () => {
        it('should load tools from localStorage on mount', () => {
            const savedTools = [
                {
                    id: 'tool-1',
                    toolNumber: 1,
                    toolName: 'Saved Tool',
                    feedRate: 200,
                    rapidRate: 4000,
                    pierceHeight: 4.0,
                    pierceDelay: 0.6,
                    arcVoltage: 130,
                    kerfWidth: 2.0,
                    thcEnable: false,
                    gasPressure: 5.0,
                    pauseAtEnd: 1,
                    puddleJumpHeight: 60,
                    puddleJumpDelay: 0.5,
                    plungeRate: 600,
                },
            ];

            localStorageMock.getItem.mockReturnValue(
                JSON.stringify(savedTools)
            );

            render(ToolTable);

            expect(localStorageMock.getItem).toHaveBeenCalledWith(
                'metalheadcam-tools'
            );
        });

        it('should handle invalid localStorage data gracefully', () => {
            const consoleSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            localStorageMock.getItem.mockReturnValue('invalid json');

            render(ToolTable);

            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to load tools from localStorage:',
                expect.any(Error)
            );
            consoleSpy.mockRestore();
        });

        it('should add default tool when no localStorage data', () => {
            localStorageMock.getItem.mockReturnValue(null);

            render(ToolTable);

            const tools = get(toolStore);
            expect(tools.length).toBe(1);
            expect(tools[0].toolName).toBe('Tool 1');
        });
    });

    describe('tool operations', () => {
        beforeEach(() => {
            // Use JSON with existing tool to prevent auto-creation
            const existingTools = JSON.stringify([
                {
                    toolNumber: 1,
                    toolName: 'Test Tool',
                    feedRate: 100,
                    rapidRate: 3000,
                    pierceHeight: 3.8,
                    pierceDelay: 0.5,
                    arcVoltage: 120,
                    kerfWidth: 1.5,
                    thcEnable: true,
                    gasPressure: 4.5,
                    pauseAtEnd: 0,
                    puddleJumpHeight: 50,
                    puddleJumpDelay: 0,
                    plungeRate: 500,
                    id: 'test-tool-1',
                },
            ]);
            localStorageMock.getItem.mockReturnValue(existingTools);
        });

        it('should delete tool', async () => {
            const { container } = render(ToolTable);

            // Look for delete button specifically
            const deleteButton = container.querySelector(
                '[title="Delete tool"]'
            );
            expect(deleteButton).toBeTruthy();
            await fireEvent.click(deleteButton!);

            const tools = get(toolStore);
            expect(tools.length).toBe(0);
        });

        it('should duplicate tool with incremented number', async () => {
            const { container } = render(ToolTable);

            const duplicateButton = container.querySelector(
                '[title="Duplicate tool"]'
            );
            expect(duplicateButton).toBeTruthy();
            await fireEvent.click(duplicateButton!);

            const tools = get(toolStore);
            expect(tools.length).toBe(2);
            expect(tools[1].toolNumber).toBe(2);
            expect(tools[1].toolName).toBe('Test Tool (Copy)');
            expect(tools[1].feedRate).toBe(100); // Should copy other properties
        });

        it('should update tool properties through input fields', async () => {
            const { container } = render(ToolTable);

            const toolNameInput = container.querySelector(
                'input[type="text"]'
            ) as HTMLInputElement;
            if (toolNameInput) {
                // Use change event instead of input since component uses onchange
                await fireEvent.change(toolNameInput, {
                    target: { value: 'Updated Tool Name' },
                });

                const tools = get(toolStore);
                expect(tools[0].toolName).toBe('Updated Tool Name');
            }
        });
    });

    describe('drag and drop functionality', () => {
        beforeEach(() => {
            // Use JSON with existing tools to prevent auto-creation
            const existingTools = JSON.stringify([
                {
                    toolNumber: 1,
                    toolName: 'Tool 1',
                    feedRate: 100,
                    rapidRate: 3000,
                    pierceHeight: 3.8,
                    pierceDelay: 0.5,
                    arcVoltage: 120,
                    kerfWidth: 1.5,
                    thcEnable: true,
                    gasPressure: 4.5,
                    pauseAtEnd: 0,
                    puddleJumpHeight: 50,
                    puddleJumpDelay: 0,
                    plungeRate: 500,
                    id: 'tool-1',
                },
                {
                    toolNumber: 2,
                    toolName: 'Tool 2',
                    feedRate: 200,
                    rapidRate: 4000,
                    pierceHeight: 4.0,
                    pierceDelay: 0.6,
                    arcVoltage: 130,
                    kerfWidth: 2.0,
                    thcEnable: false,
                    gasPressure: 5.0,
                    pauseAtEnd: 1,
                    puddleJumpHeight: 60,
                    puddleJumpDelay: 0.5,
                    plungeRate: 600,
                    id: 'tool-2',
                },
            ]);
            localStorageMock.getItem.mockReturnValue(existingTools);
        });

        it('should handle drag start', async () => {
            const { container } = render(ToolTable);

            const toolRows = container.querySelectorAll('tbody tr');
            expect(toolRows.length).toBe(2);

            const dragEvent = new DragEvent('dragstart', { bubbles: true });
            Object.defineProperty(dragEvent, 'dataTransfer', {
                value: { effectAllowed: '' },
                writable: true,
            });

            await fireEvent(toolRows[0], dragEvent);

            expect(dragEvent.dataTransfer?.effectAllowed).toBe('move');
        });

        it('should handle drag over and drop', async () => {
            const { container } = render(ToolTable);

            const toolRows = container.querySelectorAll('tbody tr');
            expect(toolRows.length).toBe(2);

            // First simulate drag start to set up the dragged tool
            const dragStartEvent = new DragEvent('dragstart', {
                bubbles: true,
            });
            Object.defineProperty(dragStartEvent, 'dataTransfer', {
                value: { effectAllowed: '' },
                writable: true,
            });

            await fireEvent(toolRows[0], dragStartEvent);

            // Simulate drag over
            const dragOverEvent = new DragEvent('dragover', { bubbles: true });
            const preventDefault = vi.fn();
            Object.defineProperty(dragOverEvent, 'preventDefault', {
                value: preventDefault,
                writable: true,
            });

            await fireEvent(toolRows[1], dragOverEvent);

            expect(preventDefault).toHaveBeenCalled();

            // Test handleDragLeave
            await fireEvent.dragLeave(toolRows[0]);

            // Test handleDrop with proper event setup
            const dropEvent = new DragEvent('drop', { bubbles: true });
            const dropPreventDefault = vi.fn();
            Object.defineProperty(dropEvent, 'preventDefault', {
                value: dropPreventDefault,
                writable: true,
            });
            Object.defineProperty(dropEvent, 'dataTransfer', {
                value: { effectAllowed: 'move' },
                writable: true,
            });

            await fireEvent(toolRows[1], dropEvent);

            expect(dropPreventDefault).toHaveBeenCalled();
        });
    });

    describe('unit display functionality', () => {
        it('should show mm units correctly', () => {
            const { container } = render(ToolTable);

            // Check for mm units in table headers
            const headers = container.querySelectorAll('th');
            const hasMMUnit = Array.from(headers).some((header) =>
                header.textContent?.includes('mm')
            );
            expect(hasMMUnit).toBe(true);
        });
    });
});
