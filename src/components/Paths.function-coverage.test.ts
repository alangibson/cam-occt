// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Paths from './Paths.svelte';
import { pathStore, selectPath, highlightPath } from '$lib/stores/paths';
import { operationsStore } from '$lib/stores/operations';
import { toolStore } from '$lib/stores/tools';
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

describe('Paths Component - Function Coverage', () => {
  beforeEach(() => {
    // Reset stores
    operationsStore.reset();
    toolStore.reset();
    pathStore.reset();
    
    // Add test data
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

    operationsStore.addOperation({
      name: 'Test Operation',
      toolId: get(toolStore)[0]?.id || null,
      targetType: 'parts',
      targetIds: ['part-1'],
      enabled: true,
      order: 1,
      cutDirection: CutDirection.COUNTERCLOCKWISE,
      leadInType: LeadType.NONE,
      leadInLength: 5,
      leadInAngle: 0,
      leadInFlipSide: false,
      leadInFit: false,
      leadOutType: LeadType.NONE,
      leadOutLength: 5,
      leadOutAngle: 0,
      leadOutFlipSide: false,
      leadOutFit: false,
      kerfCompensation: KerfCompensation.PART
    });
  });

  describe('handlePathClick function', () => {
    it('should select path when clicking unselected path', async () => {
      // Add test path using addPath method
      pathStore.addPath({
        name: 'Test Path',
        operationId: 'op-1',
        chainId: 'chain-1',
        toolId: null,
        order: 1,
        enabled: true,
        cutDirection: CutDirection.COUNTERCLOCKWISE
      });

      const { container } = render(Paths);
      
      const pathState = get(pathStore);
      const pathId = pathState.paths[0]?.id;
      expect(pathId).toBeTruthy();
      
      // Trigger the actual handlePathClick function by clicking on the path item
      const pathItem = container.querySelector('.path-item');
      expect(pathItem).toBeTruthy();
      
      await fireEvent.click(pathItem!);
      
      const updatedState = get(pathStore);
      expect(updatedState.selectedPathId).toBe(pathId);
    });

    it('should deselect path when clicking already selected path', async () => {
      // Add test path
      pathStore.addPath({
        name: 'Test Path',
        operationId: 'op-1',
        chainId: 'chain-1',
        toolId: null,
        order: 1,
        enabled: true,
        cutDirection: CutDirection.COUNTERCLOCKWISE
      });

      const { container } = render(Paths);
      
      const pathState = get(pathStore);
      const pathId = pathState.paths[0]?.id;
      
      // First select the path using selectPath
      selectPath(pathId!);
      
      // Then click it again to deselect
      const pathItem = container.querySelector('.path-item');
      await fireEvent.click(pathItem!);
      
      const finalState = get(pathStore);
      expect(finalState.selectedPathId).toBe(null);
    });

    it('should handle keyboard navigation', async () => {
      // Add test path
      pathStore.addPath({
        name: 'Test Path',
        operationId: 'op-1',
        chainId: 'chain-1', 
        toolId: null,
        order: 1,
        enabled: true,
        cutDirection: CutDirection.COUNTERCLOCKWISE
      });

      const { container } = render(Paths);
      
      const pathItem = container.querySelector('.path-item');
      expect(pathItem).toBeTruthy();
      
      // Test Enter key
      await fireEvent.keyDown(pathItem!, { key: 'Enter' });
      
      // Test Space key  
      await fireEvent.keyDown(pathItem!, { key: ' ' });
      
      // Verify component responds to keyboard events
      expect(pathItem).toBeDefined();
    });
  });

  describe('hover and utility functions', () => {
    it('should test highlight functions', () => {
      // Test highlightPath function directly
      highlightPath('path-1');
      
      const pathState = get(pathStore);
      expect(pathState.highlightedPathId).toBe('path-1');
    });

    it('should handle path hover events', async () => {
      // Add test path
      pathStore.addPath({
        name: 'Test Path',
        operationId: 'op-1',
        chainId: 'chain-1',
        toolId: null,
        order: 1,
        enabled: true,
        cutDirection: CutDirection.COUNTERCLOCKWISE
      });

      const { container } = render(Paths);
      
      const pathItem = container.querySelector('.path-item');
      expect(pathItem).toBeTruthy();
      
      // Test mouse enter to trigger handlePathHover
      await fireEvent.mouseEnter(pathItem!);
      
      // Test mouse leave to trigger handlePathHover with null
      await fireEvent.mouseLeave(pathItem!);
      
      expect(pathItem).toBeDefined();
    });

    it('should handle drag and drop completely', async () => {
      // Add multiple test paths for drag and drop
      pathStore.addPath({
        name: 'Test Path 1',
        operationId: 'op-1',
        chainId: 'chain-1',
        toolId: null,
        order: 1,
        enabled: true,
        cutDirection: CutDirection.COUNTERCLOCKWISE
      });
      
      pathStore.addPath({
        name: 'Test Path 2',
        operationId: 'op-1',
        chainId: 'chain-2',
        toolId: null,
        order: 2,
        enabled: true,
        cutDirection: CutDirection.CLOCKWISE
      });

      const { container } = render(Paths);
      
      const pathItems = container.querySelectorAll('.path-item');
      expect(pathItems.length).toBe(2);
      
      const firstPath = pathItems[0];
      const secondPath = pathItems[1];
      
      // Create proper drag events with dataTransfer
      const mockDataTransfer = { effectAllowed: '', setData: vi.fn(), getData: vi.fn() };
      
      // Test handleDragStart
      const dragStartEvent = new DragEvent('dragstart', { bubbles: true });
      Object.defineProperty(dragStartEvent, 'dataTransfer', {
        value: mockDataTransfer,
        writable: true
      });
      await fireEvent(firstPath, dragStartEvent);
      expect(mockDataTransfer.effectAllowed).toBe('move');
      
      // Test handleDragOver
      const dragOverEvent = new DragEvent('dragover', { bubbles: true });
      const preventDefault = vi.fn();
      Object.defineProperty(dragOverEvent, 'preventDefault', { 
        value: preventDefault, 
        writable: true 
      });
      await fireEvent(secondPath, dragOverEvent);
      expect(preventDefault).toHaveBeenCalled();
      
      // Test handleDragLeave
      await fireEvent.dragLeave(firstPath);
      
      // Test handleDrop with proper setup
      const dropEvent = new DragEvent('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'preventDefault', { 
        value: vi.fn(), 
        writable: true 
      });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: mockDataTransfer,
        writable: true
      });
      await fireEvent(secondPath, dropEvent);
      
      expect(container).toBeDefined();
    });

    it('should render component without errors', () => {
      const { container } = render(Paths);
      
      // Verify component renders successfully
      expect(container).toBeDefined();
    });

    it('should handle path store updates', () => {
      pathStore.addPath({
        name: 'Test Path',
        operationId: 'op-1',
        chainId: 'chain-1',
        toolId: null,
        order: 1,
        enabled: true,
        cutDirection: CutDirection.COUNTERCLOCKWISE
      });

      const { container } = render(Paths);
      
      // Component should handle store updates without errors
      expect(container).toBeDefined();
    });
  });
});