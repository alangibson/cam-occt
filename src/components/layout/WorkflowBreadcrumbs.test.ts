// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import WorkflowBreadcrumbs from './WorkflowBreadcrumbs.svelte';
import { workflowStore } from '$lib/stores/workflow/store';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import { uiStore } from '$lib/stores/ui/store';

// Mock the stores with corrected paths
vi.mock('$lib/stores/workflow/store', () => ({
    workflowStore: {
        subscribe: vi.fn(),
        currentStage: 'import',
        completedStages: new Set(),
        canAdvanceTo: vi.fn().mockReturnValue(true),
        setStage: vi.fn(),
    },
}));

vi.mock('$lib/stores/workflow/enums', () => ({
    WorkflowStage: {
        IMPORT: 'import',
        EDIT: 'edit',
        PREPARE: 'prepare',
        PROGRAM: 'program',
        SIMULATE: 'simulate',
        EXPORT: 'export',
    },
}));

vi.mock('$lib/stores/workflow/functions', () => ({
    getStageDisplayName: vi.fn((stage: string) => {
        const names = {
            import: 'Import',
            edit: 'Edit',
            prepare: 'Prepare',
            program: 'Program',
            simulate: 'Simulate',
            export: 'Export',
        };
        return names[stage as keyof typeof names] || stage;
    }),
}));

vi.mock('$lib/stores/ui/store', () => ({
    uiStore: {
        hideToolTable: vi.fn(),
        hideSettings: vi.fn(),
    },
}));

vi.mock('$lib/stores/settings/store', () => ({
    settingsStore: {
        subscribe: vi.fn((callback) => {
            callback({
                settings: {
                    enabledStages: [
                        'import',
                        'edit',
                        'prepare',
                        'program',
                        'simulate',
                        'export',
                    ],
                },
            });
            return () => {};
        }),
    },
}));

describe('WorkflowBreadcrumbs Component', () => {
    beforeEach(async () => {
        vi.clearAllMocks();

        // Mock store subscription
        vi.mocked(workflowStore.subscribe).mockImplementation((callback) => {
            callback({
                currentStage: WorkflowStage.IMPORT,
                completedStages: new Set(),
                canAdvanceTo: workflowStore.canAdvanceTo,
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
        vi.mocked(workflowStore.canAdvanceTo).mockReturnValue(true);

        const { getByText } = render(WorkflowBreadcrumbs);
        const editButton = getByText('Edit').closest('button');

        await fireEvent.click(editButton!);

        expect(workflowStore.setStage).toHaveBeenCalledWith(WorkflowStage.EDIT);
        expect(uiStore.hideToolTable).toHaveBeenCalled();
        expect(uiStore.hideSettings).toHaveBeenCalled();
    });

    it('should not call setStage when inaccessible stage is clicked', async () => {
        vi.mocked(workflowStore.canAdvanceTo).mockReturnValue(false);

        const { getByText } = render(WorkflowBreadcrumbs);
        const exportButton = getByText('Export').closest('button');

        await fireEvent.click(exportButton!);

        expect(workflowStore.setStage).not.toHaveBeenCalled();
    });

    it('should disable buttons for inaccessible stages', async () => {
        vi.mocked(workflowStore.canAdvanceTo).mockImplementation(
            (stage: string) => {
                return (
                    stage === WorkflowStage.IMPORT ||
                    stage === WorkflowStage.EDIT
                );
            }
        );

        const { getByText } = render(WorkflowBreadcrumbs);

        const importButton = getByText('Import').closest('button');
        const editButton = getByText('Edit').closest('button');
        const prepareButton = getByText('Prepare').closest('button');

        expect(importButton?.disabled).toBe(false);
        expect(editButton?.disabled).toBe(false);
        expect(prepareButton?.disabled).toBe(true);
    });

    it('should show completed stages with appropriate styling', async () => {
        vi.mocked(workflowStore.subscribe).mockImplementation((callback) => {
            callback({
                currentStage: WorkflowStage.PREPARE,
                completedStages: new Set([
                    WorkflowStage.IMPORT,
                    WorkflowStage.EDIT,
                ]),
                canAdvanceTo: workflowStore.canAdvanceTo,
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
