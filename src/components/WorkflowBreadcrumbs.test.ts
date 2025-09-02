// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import WorkflowBreadcrumbs from './WorkflowBreadcrumbs.svelte';

// Mock the stores
vi.mock('../lib/stores/workflow', () => ({
  workflowStore: {
    subscribe: vi.fn(),
    currentStage: 'import',
    completedStages: new Set(),
    canAdvanceTo: vi.fn().mockReturnValue(true),
    setStage: vi.fn()
  },
  getStageDisplayName: vi.fn((stage: string) => {
    const names = {
      import: 'Import',
      edit: 'Edit', 
      prepare: 'Prepare',
      program: 'Program',
      simulate: 'Simulate',
      export: 'Export'
    };
    return names[stage as keyof typeof names] || stage;
  })
}));

vi.mock('../lib/stores/ui', () => ({
  uiStore: {
    hideToolTable: vi.fn()
  }
}));

describe('WorkflowBreadcrumbs Component', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    
    const { workflowStore } = await import('../lib/stores/workflow');
    // Mock store subscription
    vi.mocked(workflowStore.subscribe).mockImplementation((callback) => {
      callback({
        currentStage: 'import',
        completedStages: new Set(),
        canAdvanceTo: workflowStore.canAdvanceTo
      });
      return () => {}; // Unsubscribe function
    });
  });

  it('should render without errors', () => {
    const { container } = render(WorkflowBreadcrumbs);
    expect(container).toBeDefined();
  });

  it('should display all workflow stages', () => {
    const { getByText } = render(WorkflowBreadcrumbs);
    
    expect(getByText('Import')).toBeDefined();
    expect(getByText('Edit')).toBeDefined();
    expect(getByText('Prepare')).toBeDefined();
    expect(getByText('Program')).toBeDefined();
    expect(getByText('Simulate')).toBeDefined();
    expect(getByText('Export')).toBeDefined();
  });

  it('should highlight current stage', () => {
    const { getByText } = render(WorkflowBreadcrumbs);
    
    const importButton = getByText('Import').closest('button');
    expect(importButton?.classList.contains('current')).toBe(true);
  });

  it('should call workflowStore.setStage when accessible stage is clicked', async () => {
    const { workflowStore } = await import('../lib/stores/workflow');
    const { uiStore } = await import('../lib/stores/ui');
    
    vi.mocked(workflowStore.canAdvanceTo).mockReturnValue(true);
    
    const { getByText } = render(WorkflowBreadcrumbs);
    const editButton = getByText('Edit').closest('button');
    
    await fireEvent.click(editButton!);
    
    expect(workflowStore.setStage).toHaveBeenCalledWith('edit');
    expect(uiStore.hideToolTable).toHaveBeenCalled();
  });

  it('should not call setStage when inaccessible stage is clicked', async () => {
    const { workflowStore } = await import('../lib/stores/workflow');
    vi.mocked(workflowStore.canAdvanceTo).mockReturnValue(false);
    
    const { getByText } = render(WorkflowBreadcrumbs);
    const exportButton = getByText('Export').closest('button');
    
    await fireEvent.click(exportButton!);
    
    expect(workflowStore.setStage).not.toHaveBeenCalled();
  });

  it('should disable buttons for inaccessible stages', async () => {
    const { workflowStore } = await import('../lib/stores/workflow');
    vi.mocked(workflowStore.canAdvanceTo).mockImplementation((stage: string) => {
      return stage === 'import' || stage === 'edit';
    });
    
    const { getByText } = render(WorkflowBreadcrumbs);
    
    const importButton = getByText('Import').closest('button');
    const editButton = getByText('Edit').closest('button');
    const prepareButton = getByText('Prepare').closest('button');
    
    expect(importButton?.disabled).toBe(false);
    expect(editButton?.disabled).toBe(false);
    expect(prepareButton?.disabled).toBe(true);
  });

  it('should show completed stages with appropriate styling', async () => {
    const { workflowStore } = await import('../lib/stores/workflow');
    vi.mocked(workflowStore.subscribe).mockImplementation((callback) => {
      callback({
        currentStage: 'prepare',
        completedStages: new Set(['import', 'edit']),
        canAdvanceTo: workflowStore.canAdvanceTo
      });
      return () => {};
    });
    
    const { getByText } = render(WorkflowBreadcrumbs);
    
    const importButton = getByText('Import').closest('button');
    const editButton = getByText('Edit').closest('button');
    const prepareButton = getByText('Prepare').closest('button');
    
    expect(importButton?.classList.contains('completed')).toBe(true);
    expect(editButton?.classList.contains('completed')).toBe(true);
    expect(prepareButton?.classList.contains('current')).toBe(true);
  });
});