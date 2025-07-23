import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { workflowStore, getStageDisplayName, getStageDescription, type WorkflowStage } from './workflow';

describe('Workflow Store', () => {
  beforeEach(() => {
    workflowStore.reset();
  });

  describe('Initial state', () => {
    it('should start at import stage', () => {
      const state = get(workflowStore);
      expect(state.currentStage).toBe('import');
    });

    it('should have no completed stages initially', () => {
      const state = get(workflowStore);
      expect(state.completedStages.size).toBe(0);
    });

    it('should only allow access to import stage initially', () => {
      const state = get(workflowStore);
      expect(state.canAdvanceTo('import')).toBe(true);
      expect(state.canAdvanceTo('edit')).toBe(false);
      expect(state.canAdvanceTo('program')).toBe(false);
      expect(state.canAdvanceTo('simulate')).toBe(false);
      expect(state.canAdvanceTo('export')).toBe(false);
    });
  });

  describe('Stage progression', () => {
    it('should allow setting stage to accessible stages only', () => {
      // Initially only import is accessible
      workflowStore.setStage('edit');
      expect(get(workflowStore).currentStage).toBe('import');

      // Complete import to make edit accessible
      workflowStore.completeStage('import');
      workflowStore.setStage('edit');
      expect(get(workflowStore).currentStage).toBe('edit');
    });

    it('should complete stages and update accessibility', () => {
      workflowStore.completeStage('import');
      
      const state = get(workflowStore);
      expect(state.completedStages.has('import')).toBe(true);
      expect(state.canAdvanceTo('edit')).toBe(true);
      expect(state.canAdvanceTo('program')).toBe(false);
    });

    it('should allow progression through all stages sequentially', () => {
      const stages: WorkflowStage[] = ['import', 'edit', 'program', 'simulate', 'export'];
      
      for (let i = 0; i < stages.length; i++) {
        const currentStage = stages[i];
        
        // Should be able to set to current stage
        workflowStore.setStage(currentStage);
        expect(get(workflowStore).currentStage).toBe(currentStage);
        
        // Complete current stage
        workflowStore.completeStage(currentStage);
        
        // Check that next stage is now accessible (if there is one)
        if (i < stages.length - 1) {
          const nextStage = stages[i + 1];
          expect(get(workflowStore).canAdvanceTo(nextStage)).toBe(true);
        }
      }
    });

    it('should not allow skipping stages', () => {
      // Complete import and edit
      workflowStore.completeStage('import');
      workflowStore.completeStage('edit');
      
      const state = get(workflowStore);
      expect(state.canAdvanceTo('program')).toBe(true);
      expect(state.canAdvanceTo('simulate')).toBe(false); // Should not skip program
      expect(state.canAdvanceTo('export')).toBe(false);
    });
  });

  describe('Navigation helpers', () => {
    it('should get next stage correctly', () => {
      expect(workflowStore.getNextStage()).toBe('edit');
      
      workflowStore.completeStage('import');
      workflowStore.setStage('edit');
      expect(workflowStore.getNextStage()).toBe('program');
      
      // Progress through all stages to reach export
      workflowStore.completeStage('edit');
      workflowStore.setStage('program');
      workflowStore.completeStage('program');
      workflowStore.setStage('simulate');
      workflowStore.completeStage('simulate');
      workflowStore.setStage('export');
      expect(workflowStore.getNextStage()).toBe(null); // Last stage
    });

    it('should get previous stage correctly', () => {
      expect(workflowStore.getPreviousStage()).toBe(null); // First stage
      
      workflowStore.completeStage('import');
      workflowStore.setStage('edit');
      expect(workflowStore.getPreviousStage()).toBe('import');
      
      workflowStore.completeStage('edit');
      workflowStore.setStage('program');
      expect(workflowStore.getPreviousStage()).toBe('edit');
    });
  });

  describe('Reset functionality', () => {
    it('should reset to initial state', () => {
      // Progress through some stages
      workflowStore.completeStage('import');
      workflowStore.setStage('edit');
      workflowStore.completeStage('edit');
      
      // Reset
      workflowStore.reset();
      
      const state = get(workflowStore);
      expect(state.currentStage).toBe('import');
      expect(state.completedStages.size).toBe(0);
      expect(state.canAdvanceTo('edit')).toBe(false);
    });
  });
});

describe('Workflow Utilities', () => {
  describe('getStageDisplayName', () => {
    it('should return correct display names', () => {
      expect(getStageDisplayName('import')).toBe('Import');
      expect(getStageDisplayName('edit')).toBe('Edit');
      expect(getStageDisplayName('program')).toBe('Program');
      expect(getStageDisplayName('simulate')).toBe('Simulate');
      expect(getStageDisplayName('export')).toBe('Export');
    });
  });

  describe('getStageDescription', () => {
    it('should return correct descriptions', () => {
      expect(getStageDescription('import')).toBe('Import DXF or SVG drawings');
      expect(getStageDescription('edit')).toBe('Edit drawing using basic tools');
      expect(getStageDescription('program')).toBe('Build tool paths with cut parameters');
      expect(getStageDescription('simulate')).toBe('Simulate cutting process');
      expect(getStageDescription('export')).toBe('Generate and download G-code');
    });
  });
});