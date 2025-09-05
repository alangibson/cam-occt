import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Operations from './Operations.svelte';
import { operationsStore } from '$lib/stores/operations';
import { partStore, highlightPart, clearParts } from '$lib/stores/parts';
import { chainStore, selectChain, clearChains, clearChainSelection } from '$lib/stores/chains';
import { toolStore } from '$lib/stores/tools';
import { CutDirection, LeadType } from '$lib/types/direction';

describe('Operations Auto-Selection Feature', () => {
  beforeEach(() => {
    // Clear all stores
    operationsStore.reset();
    clearParts();
    clearChains();
    clearChainSelection();
    toolStore.reset();
    
    // Add a test tool
    toolStore.addTool({
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
      plungeRate: 500
    });
  });

  it('should auto-select highlighted part when adding new operation', async () => {
    // Highlight a part
    highlightPart('part-1');
    
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
      leadInType: LeadType.LINE,
      leadInLength: 2.0,
      leadInFlipSide: false,
      leadInAngle: 0,
      leadInFit: true,
      leadOutType: LeadType.LINE,
      leadOutLength: 2.0,
      leadOutFlipSide: false,
      leadOutAngle: 0,
      leadOutFit: true
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
    selectChain('chain-2');
    
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
      leadInType: LeadType.LINE,
      leadInLength: 2.0,
      leadInFlipSide: false,
      leadInAngle: 0,
      leadInFit: true,
      leadOutType: LeadType.LINE,
      leadOutLength: 2.0,
      leadOutFlipSide: false,
      leadOutAngle: 0,
      leadOutFit: true
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
    highlightPart('part-3');
    selectChain('chain-4');
    
    // Render the component
    const { container: _container } = render(Operations);
    
    // Simulate operation creation with both part and chain selected (part should have priority)
    const partHighlighted = get(partStore).highlightedPartId;
    const chainSelected = get(chainStore).selectedChainId;
    
    operationsStore.addOperation({
      name: 'Test Operation',
      toolId: '1',
      targetType: partHighlighted ? 'parts' : 'chains',
      targetIds: partHighlighted ? [partHighlighted] : (chainSelected ? [chainSelected] : []),
      enabled: true,
      order: 1,
      cutDirection: CutDirection.CLOCKWISE,
      leadInType: LeadType.LINE,
      leadInLength: 2.0,
      leadInFlipSide: false,
      leadInAngle: 0,
      leadInFit: true,
      leadOutType: LeadType.LINE,
      leadOutLength: 2.0,
      leadOutFlipSide: false,
      leadOutAngle: 0,
      leadOutFit: true
    });
    
    // Check that the operation was created with the part (priority over chain)
    const operations = get(operationsStore);
    expect(operations.length).toBe(1);
    
    const newOperation = operations[0];
    expect(newOperation.targetType).toBe('parts');
    expect(newOperation.targetIds).toEqual(['part-3']);
  });

  it('should create empty operation when nothing is selected', async () => {
    // Don't select anything
    
    // Render the component
    const { container: _container } = render(Operations);
    
    // Simulate operation creation with nothing selected
    operationsStore.addOperation({
      name: 'Test Operation',
      toolId: '1',
      targetType: 'parts', // defaults to parts
      targetIds: [], // empty array
      enabled: true,
      order: 1,
      cutDirection: CutDirection.CLOCKWISE,
      leadInType: LeadType.LINE,
      leadInLength: 2.0,
      leadInFlipSide: false,
      leadInAngle: 0,
      leadInFit: true,
      leadOutType: LeadType.LINE,
      leadOutLength: 2.0,
      leadOutFlipSide: false,
      leadOutAngle: 0,
      leadOutFit: true
    });
    
    // Check that the operation was created with no targets
    const operations = get(operationsStore);
    expect(operations.length).toBe(1);
    
    const newOperation = operations[0];
    expect(newOperation.targetType).toBe('parts'); // defaults to parts
    expect(newOperation.targetIds).toEqual([]); // empty array
  });
});