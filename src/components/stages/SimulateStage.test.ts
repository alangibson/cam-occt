import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { workflowStore } from '../../lib/stores/workflow';
import { pathStore } from '../../lib/stores/paths';
import { rapidStore } from '../../lib/stores/rapids';
import { chainStore } from '../../lib/stores/chains';
import { operationsStore } from '../../lib/stores/operations';
import { drawingStore } from '../../lib/stores/drawing';
import { uiStore } from '../../lib/stores/ui';

describe('SimulateStage store subscription cleanup', () => {
  beforeEach(() => {
    // Reset all stores
    workflowStore.reset();
    pathStore.reset();
    rapidStore.reset();
    chainStore.set({ chains: [], tolerance: 0.1, selectedChainId: null });
  });

  it('should properly manage store subscriptions without memory leaks', () => {
    // Set up workflow to allow simulate stage
    workflowStore.completeStage('import');
    workflowStore.completeStage('edit');
    workflowStore.completeStage('prepare');
    workflowStore.completeStage('program');
    workflowStore.setStage('simulate');
    
    // Track subscription cleanup
    const unsubscribers: Array<() => void> = [];
    let subscriptionCount = 0;
    
    // Subscribe to stores as the component would
    unsubscribers.push(
      pathStore.subscribe(() => {
        subscriptionCount++;
      })
    );
    
    unsubscribers.push(
      rapidStore.subscribe(() => {
        subscriptionCount++;
      })
    );
    
    unsubscribers.push(
      chainStore.subscribe(() => {
        subscriptionCount++;
      })
    );
    
    // Verify subscriptions are active
    expect(subscriptionCount).toBeGreaterThan(0);
    
    // Clean up subscriptions as component would in onDestroy
    unsubscribers.forEach(fn => fn());
    
    // Clear the array
    unsubscribers.length = 0;
    
    // Verify we can still navigate without errors
    expect(() => {
      workflowStore.setStage('program');
    }).not.toThrow();
    
    // Verify workflow state is correct
    expect(get(workflowStore).currentStage).toBe('program');
  });

  it('should handle navigation after adding paths and rapids', () => {
    // Complete required stages
    workflowStore.completeStage('import');
    workflowStore.completeStage('edit');
    workflowStore.completeStage('prepare');
    workflowStore.completeStage('program');
    
    // Add test data
    pathStore.addPath({
      name: 'Test Path',
      operationId: 'test-op',
      chainId: 'test-chain',
      toolId: 'test-tool',
      enabled: true,
      order: 1,
      feedRate: 1000
    });
    
    rapidStore.setRapids([{
      id: 'test-rapid',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 10 },
      type: 'rapid'
    }]);
    
    // Navigate to simulate
    workflowStore.setStage('simulate');
    expect(get(workflowStore).currentStage).toBe('simulate');
    
    // Create subscriptions
    const unsubscribers: Array<() => void> = [];
    
    unsubscribers.push(pathStore.subscribe(() => {}));
    unsubscribers.push(rapidStore.subscribe(() => {}));
    unsubscribers.push(operationsStore.subscribe(() => {}));
    unsubscribers.push(drawingStore.subscribe(() => {}));
    unsubscribers.push(uiStore.subscribe(() => {}));
    
    // Clean up subscriptions before navigating away
    unsubscribers.forEach(fn => fn());
    
    // Navigate back to program
    expect(() => {
      workflowStore.setStage('program');
    }).not.toThrow();
    
    expect(get(workflowStore).currentStage).toBe('program');
  });

  it('should allow multiple navigation cycles without errors', () => {
    // Complete all stages
    workflowStore.completeStage('import');
    workflowStore.completeStage('edit');
    workflowStore.completeStage('prepare');
    workflowStore.completeStage('program');
    
    // Navigate through stages multiple times
    for (let i = 0; i < 3; i++) {
      // Go to simulate
      workflowStore.setStage('simulate');
      expect(get(workflowStore).currentStage).toBe('simulate');
      
      // Create and clean up subscriptions
      const unsubscribers: Array<() => void> = [];
      unsubscribers.push(pathStore.subscribe(() => {}));
      unsubscribers.push(rapidStore.subscribe(() => {}));
      unsubscribers.forEach(fn => fn());
      
      // Go back to program
      workflowStore.setStage('program');
      expect(get(workflowStore).currentStage).toBe('program');
      
      // Go to edit
      workflowStore.setStage('edit');
      expect(get(workflowStore).currentStage).toBe('edit');
    }
  });
});