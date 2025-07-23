import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { workflowStore } from './stores/workflow';
import { drawingStore } from './stores/drawing';

describe('Workflow Integration', () => {
  beforeEach(() => {
    workflowStore.reset();
  });

  describe('Import to Edit transition', () => {
    it('should allow advancing to edit stage after completing import', () => {
      // Initially should be at import stage
      expect(get(workflowStore).currentStage).toBe('import');
      expect(get(workflowStore).canAdvanceTo('edit')).toBe(false);

      // Complete import stage
      workflowStore.completeStage('import');
      
      // Should now be able to advance to edit
      expect(get(workflowStore).canAdvanceTo('edit')).toBe(true);
      
      workflowStore.setStage('edit');
      expect(get(workflowStore).currentStage).toBe('edit');
    });

    it('should auto-complete edit stage when drawing exists', () => {
      // Progress to edit stage
      workflowStore.completeStage('import');
      workflowStore.setStage('edit');
      
      // Simulate drawing being loaded (this would happen in ImportStage component)
      const mockDrawing = {
        shapes: [],
        bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
        units: 'mm' as const
      };
      
      drawingStore.setDrawing(mockDrawing);
      
      // Edit stage should be completable now
      workflowStore.completeStage('edit');
      expect(get(workflowStore).completedStages.has('edit')).toBe(true);
      expect(get(workflowStore).canAdvanceTo('program')).toBe(true);
    });
  });

  describe('Full workflow progression', () => {
    it('should allow complete workflow progression with proper stages', () => {
      const stages = ['import', 'edit', 'program', 'simulate', 'export'] as const;
      
      // Progress through each stage
      for (let i = 0; i < stages.length; i++) {
        const currentStage = stages[i];
        
        // Should be able to set current stage
        workflowStore.setStage(currentStage);
        expect(get(workflowStore).currentStage).toBe(currentStage);
        
        // Complete current stage
        workflowStore.completeStage(currentStage);
        expect(get(workflowStore).completedStages.has(currentStage)).toBe(true);
        
        // Next stage should be accessible (if there is one)
        if (i < stages.length - 1) {
          const nextStage = stages[i + 1];
          expect(get(workflowStore).canAdvanceTo(nextStage)).toBe(true);
        }
      }
      
      // All stages should be completed
      expect(get(workflowStore).completedStages.size).toBe(5);
    });
  });

  describe('Workflow reset', () => {
    it('should reset workflow state completely', () => {
      // Progress through some stages
      workflowStore.completeStage('import');
      workflowStore.setStage('edit');
      workflowStore.completeStage('edit');
      
      // Add a drawing
      const mockDrawing = {
        shapes: [],
        bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
        units: 'mm' as const
      };
      drawingStore.setDrawing(mockDrawing);
      
      // Reset workflow
      workflowStore.reset();
      
      // Should be back to initial state
      const state = get(workflowStore);
      expect(state.currentStage).toBe('import');
      expect(state.completedStages.size).toBe(0);
      expect(state.canAdvanceTo('edit')).toBe(false);
      
      // Drawing should still exist (workflow reset doesn't clear drawing)
      expect(get(drawingStore).drawing).toBeTruthy();
    });
  });

  describe('Stage validation', () => {
    it('should prevent skipping stages', () => {
      // Try to jump directly to program stage
      workflowStore.setStage('program');
      expect(get(workflowStore).currentStage).toBe('import'); // Should remain at import
      
      // Try to jump to export
      workflowStore.setStage('export');
      expect(get(workflowStore).currentStage).toBe('import'); // Should remain at import
      
      // Complete import, should still not be able to skip to program
      workflowStore.completeStage('import');
      workflowStore.setStage('program');
      expect(get(workflowStore).currentStage).toBe('import'); // Should remain at import (edit not completed)
      
      // Only after completing edit should program be accessible
      workflowStore.setStage('edit');
      workflowStore.completeStage('edit');
      workflowStore.setStage('program');
      expect(get(workflowStore).currentStage).toBe('program'); // Now should work
    });
  });
});