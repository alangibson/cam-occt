// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import { SvelteSet } from 'svelte/reactivity';

// Import after mocks
import WorkflowBreadcrumbs from './WorkflowBreadcrumbs.svelte';
import { workflowStore } from '$lib/stores/workflow/store.svelte';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import { uiStore } from '$lib/stores/ui/store.svelte';

// Mock the stores with corrected paths
vi.mock('$lib/stores/workflow/store.svelte', () => ({
    workflowStore: {
        currentStage: 'import',
        completedStages: new SvelteSet(),
        canAdvanceTo: vi.fn().mockReturnValue(true),
        setStage: vi.fn(),
    },
}));

vi.mock('$lib/stores/workflow/enums', () => ({
    WorkflowStage: {
        IMPORT: 'import',
        PROGRAM: 'program',
        SIMULATE: 'simulate',
        EXPORT: 'export',
    },
}));

vi.mock('$lib/stores/workflow/functions', () => ({
    getStageDisplayName: vi.fn((stage: string) => {
        const names = {
            import: 'Import',
            program: 'Program',
            simulate: 'Simulate',
            export: 'Export',
        };
        return names[stage as keyof typeof names] || stage;
    }),
}));

vi.mock('$lib/stores/ui/store.svelte', () => ({
    uiStore: {
        toolTableVisible: false,
        settingsVisible: false,
        showToolTable: vi.fn(),
        hideToolTable: vi.fn(),
        showSettings: vi.fn(),
        hideSettings: vi.fn(),
        toggleToolTable: vi.fn(),
        toggleSettings: vi.fn(),
        restore: vi.fn(),
    },
}));

vi.mock('$lib/stores/settings/store.svelte', () => ({
    settingsStore: {
        settings: {
            enabledStages: ['import', 'program', 'simulate', 'export'],
        },
    },
}));

describe('WorkflowBreadcrumbs Component', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
    });

    it('should render without errors', () => {
        const { container } = render(WorkflowBreadcrumbs);
        expect(container).toBeDefined();
    });

    it('should display all workflow stages', () => {
        const { getByText } = render(WorkflowBreadcrumbs);

        expect(getByText('Import')).toBeDefined();
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
        const programButton = getByText('Program').closest('button');

        await fireEvent.click(programButton!);

        expect(workflowStore.setStage).toHaveBeenCalledWith(
            WorkflowStage.PROGRAM
        );
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
                    stage === WorkflowStage.PROGRAM
                );
            }
        );

        const { getByText } = render(WorkflowBreadcrumbs);

        const importButton = getByText('Import').closest('button');
        const programButton = getByText('Program').closest('button');
        const simulateButton = getByText('Simulate').closest('button');

        expect(importButton?.disabled).toBe(false);
        expect(programButton?.disabled).toBe(false);
        expect(simulateButton?.disabled).toBe(true);
    });

    it('should show completed stages with appropriate styling', async () => {
        // Update the mock to show completed stages
        vi.mocked(workflowStore).currentStage = WorkflowStage.PROGRAM;
        vi.mocked(workflowStore).completedStages = new SvelteSet([
            WorkflowStage.IMPORT,
        ]);

        const { getByText } = render(WorkflowBreadcrumbs);

        const importButton = getByText('Import').closest('button');
        const programButton = getByText('Program').closest('button');

        expect(importButton?.classList.contains('completed')).toBe(true);
        expect(programButton?.classList.contains('current')).toBe(true);
    });
});
