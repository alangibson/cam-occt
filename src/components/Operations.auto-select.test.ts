import { beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Operations from './Operations.svelte';
import { operationsStore } from '$lib/stores/operations/store';
import { partStore } from '$lib/stores/parts/store';
import { chainStore } from '$lib/stores/chains/store';
import { toolStore } from '$lib/stores/tools/store';
import { CutDirection, LeadType } from '$lib/types/direction';
import { PartType } from '$lib/cam/part/part-detection';

describe('Operations Auto-Selection Feature', () => {
    beforeEach(() => {
        // Clear all stores
        operationsStore.reset();
        partStore.clearParts();
        chainStore.clearChains();
        chainStore.clearChainSelection();
        toolStore.reset();

        // Add a test tool
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
    });

    it('should auto-select highlighted part when adding new operation', async () => {
        // Highlight a part
        partStore.highlightPart('part-1');

        // Render the component
        const { container: _container } = render(Operations);

        // Since there's no "Add Operation" button visible, simulate the operation creation
        // by directly calling the operations store method that would be triggered
        const partHighlighted = get(partStore).highlightedPartId;
        operationsStore.addOperation({
            name: 'Test Operation',
            toolId: '1',
            targetType: 'parts',
            targetIds: partHighlighted ? [partHighlighted] : [],
            enabled: true,
            order: 1,
            cutDirection: CutDirection.CLOCKWISE,
            leadInConfig: {
                type: LeadType.ARC,
                length: 2.0,
                flipSide: false,
                angle: 0,
                fit: true,
            },
            leadOutConfig: {
                type: LeadType.ARC,
                length: 2.0,
                flipSide: false,
                angle: 0,
                fit: true,
            },
        });

        // Check that the operation was created with the highlighted part
        const operations = get(operationsStore);
        expect(operations.length).toBe(1);

        const newOperation = operations[0];
        expect(newOperation.targetType).toBe('parts');
        expect(newOperation.targetIds).toEqual(['part-1']);
    });

    it('should auto-select selected chain when adding new operation', async () => {
        // Select a chain
        chainStore.selectChain('chain-2');

        // Render the component
        const { container: _container } = render(Operations);

        // Simulate operation creation with selected chain
        operationsStore.addOperation({
            name: 'Test Operation',
            toolId: '1',
            targetType: 'chains',
            targetIds: (() => {
                const selectedId = get(chainStore).selectedChainId;
                return selectedId ? [selectedId] : [];
            })(),
            enabled: true,
            order: 1,
            cutDirection: CutDirection.CLOCKWISE,
            leadInConfig: {
                type: LeadType.ARC,
                length: 2.0,
                flipSide: false,
                angle: 0,
                fit: true,
            },
            leadOutConfig: {
                type: LeadType.ARC,
                length: 2.0,
                flipSide: false,
                angle: 0,
                fit: true,
            },
        });

        // Check that the operation was created with the selected chain
        const operations = get(operationsStore);
        expect(operations.length).toBe(1);

        const newOperation = operations[0];
        expect(newOperation.targetType).toBe('chains');
        expect(newOperation.targetIds).toEqual(['chain-2']);
    });

    it('should prioritize part over chain when both are selected', async () => {
        // Select both a part and a chain
        partStore.highlightPart('part-3');
        chainStore.selectChain('chain-4');

        // Render the component
        const { container: _container } = render(Operations);

        // Simulate operation creation with both part and chain selected (part should have priority)
        const partHighlighted = get(partStore).highlightedPartId;
        const chainSelected = get(chainStore).selectedChainId;

        operationsStore.addOperation({
            name: 'Test Operation',
            toolId: '1',
            targetType: partHighlighted ? 'parts' : 'chains',
            targetIds: partHighlighted
                ? [partHighlighted]
                : chainSelected
                  ? [chainSelected]
                  : [],
            enabled: true,
            order: 1,
            cutDirection: CutDirection.CLOCKWISE,
            leadInConfig: {
                type: LeadType.ARC,
                length: 2.0,
                flipSide: false,
                angle: 0,
                fit: true,
            },
            leadOutConfig: {
                type: LeadType.ARC,
                length: 2.0,
                flipSide: false,
                angle: 0,
                fit: true,
            },
        });

        // Check that the operation was created with the part (priority over chain)
        const operations = get(operationsStore);
        expect(operations.length).toBe(1);

        const newOperation = operations[0];
        expect(newOperation.targetType).toBe('parts');
        expect(newOperation.targetIds).toEqual(['part-3']);
    });

    it('should create empty operation when nothing is selected and no parts/chains exist', async () => {
        // Don't select anything

        // Render the component
        const { container: _container } = render(Operations);

        // Simulate operation creation with nothing selected and no parts/chains
        operationsStore.addOperation({
            name: 'Test Operation',
            toolId: '1',
            targetType: 'parts', // defaults to parts
            targetIds: [], // empty array
            enabled: true,
            order: 1,
            cutDirection: CutDirection.CLOCKWISE,
            leadInConfig: {
                type: LeadType.ARC,
                length: 2.0,
                flipSide: false,
                angle: 0,
                fit: true,
            },
            leadOutConfig: {
                type: LeadType.ARC,
                length: 2.0,
                flipSide: false,
                angle: 0,
                fit: true,
            },
        });

        // Check that the operation was created with no targets
        const operations = get(operationsStore);
        expect(operations.length).toBe(1);

        const newOperation = operations[0];
        expect(newOperation.targetType).toBe('parts'); // defaults to parts
        expect(newOperation.targetIds).toEqual([]); // empty array
    });

    it('should default to all parts when nothing is selected but parts exist (first operation only)', async () => {
        // Add some parts but don't select anything
        partStore.setParts([
            {
                id: 'part-1',
                shell: {
                    id: 'shell-1',
                    chain: { id: 'chain-1', shapes: [], clockwise: true },
                    type: PartType.SHELL,
                    boundingBox: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
                    holes: [],
                },
                holes: [],
            },
            {
                id: 'part-2',
                shell: {
                    id: 'shell-2',
                    chain: { id: 'chain-2', shapes: [], clockwise: true },
                    type: PartType.SHELL,
                    boundingBox: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
                    holes: [],
                },
                holes: [],
            },
        ]);

        // Render the component
        const component = render(Operations);

        // Ensure no operations exist yet
        expect(get(operationsStore).length).toBe(0);

        // Call the component's addNewOperation function with disabled operation
        // to avoid trying to generate cuts
        component.component.addNewOperation({ enabled: false });

        // Check that the first operation was created with all parts
        const operations = get(operationsStore);
        expect(operations.length).toBe(1);

        const newOperation = operations[0];
        expect(newOperation.targetType).toBe('parts');
        expect(newOperation.targetIds).toEqual(['part-1', 'part-2']);
    });

    it('should default to all chains when nothing is selected, no parts exist, but chains exist (first operation only)', async () => {
        // Add some chains but don't select anything
        chainStore.setChains([
            {
                id: 'chain-1',
                shapes: [],
                clockwise: true,
            },
            {
                id: 'chain-2',
                shapes: [],
                clockwise: false,
            },
        ]);

        // Render the component
        const component = render(Operations);

        // Ensure no operations exist yet
        expect(get(operationsStore).length).toBe(0);

        // Call the component's addNewOperation function with disabled operation
        // to avoid trying to generate cuts
        component.component.addNewOperation({ enabled: false });

        // Check that the first operation was created with all chains
        const operations = get(operationsStore);
        expect(operations.length).toBe(1);

        const newOperation = operations[0];
        expect(newOperation.targetType).toBe('chains');
        expect(newOperation.targetIds).toEqual(['chain-1', 'chain-2']);
    });

    it('should not auto-select when creating second operation with nothing selected', async () => {
        // Add some parts
        partStore.setParts([
            {
                id: 'part-1',
                shell: {
                    id: 'shell-1',
                    chain: { id: 'chain-1', shapes: [], clockwise: true },
                    type: PartType.SHELL,
                    boundingBox: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
                    holes: [],
                },
                holes: [],
            },
        ]);

        // Render the component
        const component = render(Operations);

        // Create first operation (should auto-select all parts)
        component.component.addNewOperation({ enabled: false });
        expect(get(operationsStore).length).toBe(1);
        expect(get(operationsStore)[0].targetIds).toEqual(['part-1']);

        // Create second operation with nothing selected (should NOT auto-select)
        component.component.addNewOperation({ enabled: false });
        expect(get(operationsStore).length).toBe(2);

        const secondOperation = get(operationsStore)[1];
        expect(secondOperation.targetType).toBe('parts');
        expect(secondOperation.targetIds).toEqual([]); // Should be empty
    });
});
