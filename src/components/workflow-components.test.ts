import { describe, it, expect } from 'vitest';

describe('Workflow Components', () => {
  describe('Component imports', () => {
    it('should import WorkflowBreadcrumbs without errors', async () => {
      const module = await import('./WorkflowBreadcrumbs.svelte');
      expect(module.default).toBeDefined();
    });

    it('should import WorkflowContainer without errors', async () => {
      const module = await import('./WorkflowContainer.svelte');
      expect(module.default).toBeDefined();
    });

    it('should import ImportStage without errors', async () => {
      const module = await import('./stages/ImportStage.svelte');
      expect(module.default).toBeDefined();
    });

    it('should import EditStage without errors', async () => {
      const module = await import('./stages/EditStage.svelte');
      expect(module.default).toBeDefined();
    });

    it('should import PrepareStage without errors', async () => {
      const module = await import('./stages/PrepareStage.svelte');
      expect(module.default).toBeDefined();
    });

    it('should import NewProgramStage without errors', async () => {
      const module = await import('./stages/NewProgramStage.svelte');
      expect(module.default).toBeDefined();
    });

    it('should import SimulateStage without errors', async () => {
      const module = await import('./stages/SimulateStage.svelte');
      expect(module.default).toBeDefined();
    });

    it('should import ExportStage without errors', async () => {
      const module = await import('./stages/ExportStage.svelte');
      expect(module.default).toBeDefined();
    });
  });

  describe('Stage helper functions', () => {
    it('should import and use workflow utilities', async () => {
      const { getStageDisplayName, getStageDescription } = await import('../lib/stores/workflow');
      
      expect(getStageDisplayName('import')).toBe('Import');
      expect(getStageDisplayName('edit')).toBe('Edit');
      expect(getStageDisplayName('prepare')).toBe('Prepare');
      expect(getStageDisplayName('program')).toBe('Program');
      expect(getStageDisplayName('simulate')).toBe('Simulate');
      expect(getStageDisplayName('export')).toBe('Export');
      
      expect(getStageDescription('import')).toContain('Import DXF or SVG');
      expect(getStageDescription('edit')).toContain('Edit drawing');
      expect(getStageDescription('prepare')).toContain('Analyze chains');
      expect(getStageDescription('program')).toContain('Build tool paths');
      expect(getStageDescription('simulate')).toContain('Simulate cutting');
      expect(getStageDescription('export')).toContain('Generate and download');
    });
  });

  describe('Workflow stage progression logic', () => {
    it('should define correct stage order', async () => {
      const { workflowStore } = await import('../lib/stores/workflow');
      
      // Test the expected progression through store methods
      expect(workflowStore.getNextStage()).toBe('edit');
      
      workflowStore.completeStage('import');
      workflowStore.setStage('edit');
      expect(workflowStore.getNextStage()).toBe('prepare');
      
      workflowStore.completeStage('edit');
      workflowStore.setStage('prepare');
      expect(workflowStore.getNextStage()).toBe('program');
      
      workflowStore.completeStage('prepare');
      workflowStore.setStage('program');
      expect(workflowStore.getNextStage()).toBe('simulate');
      
      workflowStore.completeStage('program');
      workflowStore.setStage('simulate');
      expect(workflowStore.getNextStage()).toBe('export');
      
      workflowStore.completeStage('simulate');
      workflowStore.setStage('export');
      expect(workflowStore.getNextStage()).toBe(null); // Last stage
    });
  });
});