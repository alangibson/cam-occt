// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import ToolTable from './ToolTable.svelte';
import { toolStore } from '$lib/stores/tools/store.svelte';

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
    });

    afterEach(() => {
        // Svelte 5 doesn't use $destroy(), component cleanup happens automatically
    });

    describe('addNewTool function', () => {
        it('should create first tool with number 1', async () => {
            const { container } = render(ToolTable);

            // Click add button to create first tool
            const addButton = container.querySelector('.btn-primary');
            expect(addButton).toBeTruthy();
            await fireEvent.click(addButton!);

            const tools = toolStore.tools;
            expect(tools.length).toBe(1);
            expect(tools[0].toolNumber).toBe(1);
            expect(tools[0].toolName).toBe('Tool 1');
        });

        it('should increment tool number correctly', async () => {
            const { container } = render(ToolTable);

            // Click add button twice to create two tools
            const addButton = container.querySelector('.btn-primary');
            expect(addButton).toBeTruthy();

            await fireEvent.click(addButton!);
            let tools = toolStore.tools;
            expect(tools.length).toBe(1);
            expect(tools[0].toolNumber).toBe(1);

            await fireEvent.click(addButton!);
            tools = toolStore.tools;
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

            const tools = toolStore.tools;
            const newTool = tools[tools.length - 1];

            expect(newTool.feedRate).toBe(1000);
            expect(newTool.pierceHeight).toBe(1);
            expect(newTool.pierceDelay).toBe(0.5);
            expect(newTool.arcVoltage).toBe(120);
            expect(newTool.kerfWidth).toBe(1.5);
            expect(newTool.thcEnable).toBe(true);
            expect(newTool.gasPressure).toBe(4.5);
            expect(newTool.pauseAtEnd).toBe(0);
            expect(newTool.puddleJumpHeight).toBe(0.5);
            expect(newTool.puddleJumpDelay).toBe(0);
            expect(newTool.plungeRate).toBe(500);
        });

        it('should handle max tool number calculation with gaps', async () => {
            // Manually add tools with gaps in tool numbers
            toolStore.reorderTools([
                {
                    toolNumber: 5,
                    toolName: 'Tool 5',
                    feedRate: 100,
                    feedRateMetric: 100,
                    feedRateImperial: 3.937,
                    pierceHeight: 3.8,
                    pierceHeightMetric: 3.8,
                    pierceHeightImperial: 0.15,
                    cutHeight: 3.8,
                    cutHeightMetric: 3.8,
                    cutHeightImperial: 0.15,
                    pierceDelay: 0.5,
                    arcVoltage: 120,
                    kerfWidth: 1.5,
                    kerfWidthMetric: 1.5,
                    kerfWidthImperial: 0.06,
                    thcEnable: true,
                    gasPressure: 4.5,
                    pauseAtEnd: 0,
                    puddleJumpHeight: 50,
                    puddleJumpHeightMetric: 50,
                    puddleJumpHeightImperial: 1.97,
                    puddleJumpDelay: 0,
                    plungeRate: 500,
                    plungeRateMetric: 500,
                    plungeRateImperial: 19.685,
                    id: 'tool-5',
                },
                {
                    toolNumber: 10,
                    toolName: 'Tool 10',
                    feedRate: 100,
                    feedRateMetric: 100,
                    feedRateImperial: 3.937,
                    pierceHeight: 3.8,
                    pierceHeightMetric: 3.8,
                    pierceHeightImperial: 0.15,
                    cutHeight: 3.8,
                    cutHeightMetric: 3.8,
                    cutHeightImperial: 0.15,
                    pierceDelay: 0.5,
                    arcVoltage: 120,
                    kerfWidth: 1.5,
                    kerfWidthMetric: 1.5,
                    kerfWidthImperial: 0.06,
                    thcEnable: true,
                    gasPressure: 4.5,
                    pauseAtEnd: 0,
                    puddleJumpHeight: 50,
                    puddleJumpHeightMetric: 50,
                    puddleJumpHeightImperial: 1.97,
                    puddleJumpDelay: 0,
                    plungeRate: 500,
                    plungeRateMetric: 500,
                    plungeRateImperial: 19.685,
                    id: 'tool-10',
                },
            ]);

            const { container } = render(ToolTable);

            // Should have 2 existing tools
            let tools = toolStore.tools;
            expect(tools.length).toBe(2);

            const addButton = container.querySelector('.btn-primary');
            expect(addButton).toBeTruthy();
            await fireEvent.click(addButton!);

            tools = toolStore.tools;
            const newTool = tools[tools.length - 1];
            expect(newTool.toolNumber).toBe(11); // Should be max + 1
        });
    });

    // localStorage integration tests removed - tool persistence is now handled
    // by the main application storage system in src/lib/stores/storage/store.ts

    describe('tool operations', () => {
        beforeEach(() => {
            // Add test tool directly to store
            toolStore.reorderTools([
                {
                    toolNumber: 1,
                    toolName: 'Test Tool',
                    feedRate: 100,
                    feedRateMetric: 100,
                    feedRateImperial: 3.937,
                    pierceHeight: 3.8,
                    pierceHeightMetric: 3.8,
                    pierceHeightImperial: 0.15,
                    cutHeight: 3.8,
                    cutHeightMetric: 3.8,
                    cutHeightImperial: 0.15,
                    pierceDelay: 0.5,
                    arcVoltage: 120,
                    kerfWidth: 1.5,
                    kerfWidthMetric: 1.5,
                    kerfWidthImperial: 0.06,
                    thcEnable: true,
                    gasPressure: 4.5,
                    pauseAtEnd: 0,
                    puddleJumpHeight: 50,
                    puddleJumpHeightMetric: 50,
                    puddleJumpHeightImperial: 1.97,
                    puddleJumpDelay: 0,
                    plungeRate: 500,
                    plungeRateMetric: 500,
                    plungeRateImperial: 19.685,
                    id: 'test-tool-1',
                },
            ]);
        });

        it('should delete tool', async () => {
            const { container } = render(ToolTable);

            // Look for delete button specifically
            const deleteButton = container.querySelector(
                '[title="Delete tool"]'
            );
            expect(deleteButton).toBeTruthy();
            await fireEvent.click(deleteButton!);

            const tools = toolStore.tools;
            expect(tools.length).toBe(0);
        });

        it('should duplicate tool with incremented number', async () => {
            const { container } = render(ToolTable);

            const duplicateButton = container.querySelector(
                '[title="Duplicate tool"]'
            );
            expect(duplicateButton).toBeTruthy();
            await fireEvent.click(duplicateButton!);

            const tools = toolStore.tools;
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

                const tools = toolStore.tools;
                expect(tools[0].toolName).toBe('Updated Tool Name');
            }
        });

        it('should update toolNumber field through numeric input', async () => {
            const { container } = render(ToolTable);

            const toolNumberInput = container.querySelector(
                'input[type="number"]'
            ) as HTMLInputElement;
            if (toolNumberInput) {
                await fireEvent.change(toolNumberInput, {
                    target: { value: '5' },
                });

                const tools = toolStore.tools;
                expect(tools[0].toolNumber).toBe(5);
            }
        });

        it('should update feedRate field through numeric input', async () => {
            const { container } = render(ToolTable);

            const inputs = container.querySelectorAll('input[type="number"]');
            // Now we have dual-unit inputs (metric and imperial) for feedRate
            // inputs[0] = toolNumber
            // inputs[1] = feedRateMetric
            // inputs[2] = feedRateImperial
            const feedRateMetricInput = inputs[1] as HTMLInputElement;
            if (feedRateMetricInput) {
                await fireEvent.change(feedRateMetricInput, {
                    target: { value: '150.5' },
                });

                const tools = toolStore.tools;
                expect(tools[0].feedRateMetric).toBe(150.5);
            }
        });

        it('should update pierceHeight field through numeric input', async () => {
            const { container } = render(ToolTable);

            const inputs = container.querySelectorAll('input[type="number"]');
            // inputs[3] = pierceHeightMetric, inputs[4] = pierceHeightImperial
            const pierceHeightMetricInput = inputs[3] as HTMLInputElement;
            if (pierceHeightMetricInput) {
                await fireEvent.change(pierceHeightMetricInput, {
                    target: { value: '4.2' },
                });

                const tools = toolStore.tools;
                expect(tools[0].pierceHeightMetric).toBe(4.2);
            }
        });

        it('should update cutHeight field through numeric input', async () => {
            const { container } = render(ToolTable);

            const inputs = container.querySelectorAll('input[type="number"]');
            // inputs[5] = cutHeightMetric, inputs[6] = cutHeightImperial
            const cutHeightMetricInput = inputs[5] as HTMLInputElement;
            if (cutHeightMetricInput) {
                await fireEvent.change(cutHeightMetricInput, {
                    target: { value: '2.0' },
                });

                const tools = toolStore.tools;
                expect(tools[0].cutHeightMetric).toBe(2.0);
            }
        });

        it('should update pierceDelay field through numeric input', async () => {
            const { container } = render(ToolTable);

            const inputs = container.querySelectorAll('input[type="number"]');
            // inputs[7] = pierceDelay (single input)
            const pierceDelayInput = inputs[7] as HTMLInputElement;
            if (pierceDelayInput) {
                await fireEvent.change(pierceDelayInput, {
                    target: { value: '0.8' },
                });

                const tools = toolStore.tools;
                expect(tools[0].pierceDelay).toBe(0.8);
            }
        });

        it('should update arcVoltage field through numeric input', async () => {
            const { container } = render(ToolTable);

            const inputs = container.querySelectorAll('input[type="number"]');
            // inputs[8] = arcVoltage (single input)
            const arcVoltageInput = inputs[8] as HTMLInputElement;
            if (arcVoltageInput) {
                await fireEvent.change(arcVoltageInput, {
                    target: { value: '135' },
                });

                const tools = toolStore.tools;
                expect(tools[0].arcVoltage).toBe(135);
            }
        });

        it('should update kerfWidth field through numeric input', async () => {
            const { container } = render(ToolTable);

            const inputs = container.querySelectorAll('input[type="number"]');
            // inputs[9] = kerfWidthMetric, inputs[10] = kerfWidthImperial
            const kerfWidthMetricInput = inputs[9] as HTMLInputElement;
            if (kerfWidthMetricInput) {
                await fireEvent.change(kerfWidthMetricInput, {
                    target: { value: '1.8' },
                });

                const tools = toolStore.tools;
                expect(tools[0].kerfWidthMetric).toBe(1.8);
            }
        });

        it('should update thcEnable field through checkbox input', async () => {
            const { container } = render(ToolTable);

            const checkboxInput = container.querySelector(
                'input[type="checkbox"]'
            ) as HTMLInputElement;
            if (checkboxInput) {
                await fireEvent.change(checkboxInput, {
                    target: { checked: false },
                });

                const tools = toolStore.tools;
                expect(tools[0].thcEnable).toBe(false);
            }
        });

        it('should update gasPressure field through numeric input', async () => {
            const { container } = render(ToolTable);

            const inputs = container.querySelectorAll('input[type="number"]');
            // inputs[11] = gasPressure (single input)
            const gasPressureInput = inputs[11] as HTMLInputElement;
            if (gasPressureInput) {
                await fireEvent.change(gasPressureInput, {
                    target: { value: '5.2' },
                });

                const tools = toolStore.tools;
                expect(tools[0].gasPressure).toBe(5.2);
            }
        });

        it('should update pauseAtEnd field through numeric input', async () => {
            const { container } = render(ToolTable);

            const inputs = container.querySelectorAll('input[type="number"]');
            // inputs[12] = pauseAtEnd (single input)
            const pauseAtEndInput = inputs[12] as HTMLInputElement;
            if (pauseAtEndInput) {
                await fireEvent.change(pauseAtEndInput, {
                    target: { value: '1.5' },
                });

                const tools = toolStore.tools;
                expect(tools[0].pauseAtEnd).toBe(1.5);
            }
        });

        it('should update puddleJumpHeight field through numeric input', async () => {
            const { container } = render(ToolTable);

            const inputs = container.querySelectorAll('input[type="number"]');
            // inputs[13] = puddleJumpHeightMetric, inputs[14] = puddleJumpHeightImperial
            const puddleJumpHeightMetricInput = inputs[13] as HTMLInputElement;
            if (puddleJumpHeightMetricInput) {
                await fireEvent.change(puddleJumpHeightMetricInput, {
                    target: { value: '75' },
                });

                const tools = toolStore.tools;
                expect(tools[0].puddleJumpHeightMetric).toBe(75);
            }
        });

        it('should update puddleJumpDelay field through numeric input', async () => {
            const { container } = render(ToolTable);

            const inputs = container.querySelectorAll('input[type="number"]');
            // inputs[15] = puddleJumpDelay (single input)
            const puddleJumpDelayInput = inputs[15] as HTMLInputElement;
            if (puddleJumpDelayInput) {
                await fireEvent.change(puddleJumpDelayInput, {
                    target: { value: '0.3' },
                });

                const tools = toolStore.tools;
                expect(tools[0].puddleJumpDelay).toBe(0.3);
            }
        });

        it('should update plungeRate field through numeric input', async () => {
            const { container } = render(ToolTable);

            const inputs = container.querySelectorAll('input[type="number"]');
            // inputs[16] = plungeRateMetric, inputs[17] = plungeRateImperial
            const plungeRateMetricInput = inputs[16] as HTMLInputElement;
            if (plungeRateMetricInput) {
                await fireEvent.change(plungeRateMetricInput, {
                    target: { value: '700' },
                });

                const tools = toolStore.tools;
                expect(tools[0].plungeRateMetric).toBe(700);
            }
        });
    });

    describe('drag and drop functionality', () => {
        beforeEach(() => {
            // Add test tools directly to store
            toolStore.reorderTools([
                {
                    toolNumber: 1,
                    toolName: 'Tool 1',
                    feedRate: 100,
                    feedRateMetric: 100,
                    feedRateImperial: 3.937,
                    pierceHeight: 3.8,
                    pierceHeightMetric: 3.8,
                    pierceHeightImperial: 0.15,
                    cutHeight: 3.8,
                    cutHeightMetric: 3.8,
                    cutHeightImperial: 0.15,
                    pierceDelay: 0.5,
                    arcVoltage: 120,
                    kerfWidth: 1.5,
                    kerfWidthMetric: 1.5,
                    kerfWidthImperial: 0.06,
                    thcEnable: true,
                    gasPressure: 4.5,
                    pauseAtEnd: 0,
                    puddleJumpHeight: 50,
                    puddleJumpHeightMetric: 50,
                    puddleJumpHeightImperial: 1.97,
                    puddleJumpDelay: 0,
                    plungeRate: 500,
                    plungeRateMetric: 500,
                    plungeRateImperial: 19.685,
                    id: 'tool-1',
                },
                {
                    toolNumber: 2,
                    toolName: 'Tool 2',
                    feedRate: 200,
                    feedRateMetric: 200,
                    feedRateImperial: 7.874,
                    pierceHeight: 4.0,
                    pierceHeightMetric: 4.0,
                    pierceHeightImperial: 0.157,
                    cutHeight: 4.0,
                    cutHeightMetric: 4.0,
                    cutHeightImperial: 0.157,
                    pierceDelay: 0.6,
                    arcVoltage: 130,
                    kerfWidth: 2.0,
                    kerfWidthMetric: 2.0,
                    kerfWidthImperial: 0.079,
                    thcEnable: false,
                    gasPressure: 5.0,
                    pauseAtEnd: 1,
                    puddleJumpHeight: 60,
                    puddleJumpHeightMetric: 60,
                    puddleJumpHeightImperial: 2.362,
                    puddleJumpDelay: 0.5,
                    plungeRate: 600,
                    plungeRateMetric: 600,
                    plungeRateImperial: 23.622,
                    id: 'tool-2',
                },
            ]);
        });

        it('should handle drag start', async () => {
            const { container } = render(ToolTable);

            // Component uses divs with class 'tool-item' instead of tbody tr
            const toolRows = container.querySelectorAll('.tool-item');
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

            // Component uses divs with class 'tool-item' instead of tbody tr
            const toolRows = container.querySelectorAll('.tool-item');
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
            // Add a test tool so we have at least one tool row
            toolStore.addTool({
                toolNumber: 1,
                toolName: 'Test Tool',
                feedRate: 100,
                feedRateMetric: 100,
                feedRateImperial: 3.937,
                pierceHeight: 3.8,
                pierceHeightMetric: 3.8,
                pierceHeightImperial: 0.15,
                cutHeight: 3.8,
                cutHeightMetric: 3.8,
                cutHeightImperial: 0.15,
                pierceDelay: 0.5,
                arcVoltage: 120,
                kerfWidth: 1.5,
                kerfWidthMetric: 1.5,
                kerfWidthImperial: 0.06,
                thcEnable: true,
                gasPressure: 4.5,
                pauseAtEnd: 0,
                puddleJumpHeight: 50,
                puddleJumpHeightMetric: 50,
                puddleJumpHeightImperial: 1.97,
                puddleJumpDelay: 0,
                plungeRate: 500,
                plungeRateMetric: 500,
                plungeRateImperial: 19.685,
            });

            const { container } = render(ToolTable);

            // Check for mm units in the unit-suffix spans within tool rows
            const unitSuffixes = container.querySelectorAll('.unit-suffix');
            const hasMMUnit = Array.from(unitSuffixes).some((span) =>
                span.textContent?.includes('mm')
            );
            expect(hasMMUnit).toBe(true);
        });
    });
});
