import { describe, expect, it, vi } from 'vitest';

// Mock settings store to return all stages enabled (for testing workflow logic)
vi.mock('$lib/stores/settings/store.svelte', () => ({
    settingsStore: {
        settings: {
            enabledStages: ['import', 'program', 'simulate', 'export'],
        },
    },
}));

/* eslint-disable import/first */
import WorkflowBreadcrumbs from './WorkflowBreadcrumbs.svelte';
import WorkflowContainer from './WorkflowContainer.svelte';
import ImportStage from '$components/pages/import/ImportStage.svelte';
import ProgramStage from '$components/pages/program/ProgramStage.svelte';
import SimulateStage from '$components/pages/simulate/SimulateStage.svelte';
import ExportStage from '$components/pages/export/ExportStage.svelte';
import { workflowStore } from '$lib/stores/workflow/store.svelte';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import {
    getStageDescription,
    getStageDisplayName,
} from '$lib/stores/workflow/functions';
/* eslint-enable import/first */

describe('Workflow Components', () => {
    describe('Component imports', () => {
        it('should import WorkflowBreadcrumbs without errors', async () => {
            expect(WorkflowBreadcrumbs).toBeDefined();
        });

        it('should import WorkflowContainer without errors', async () => {
            expect(WorkflowContainer).toBeDefined();
        });

        it('should import ImportStage without errors', async () => {
            expect(ImportStage).toBeDefined();
        });

        it('should import ProgramStage without errors', async () => {
            expect(ProgramStage).toBeDefined();
        });

        it('should import SimulateStage without errors', async () => {
            expect(SimulateStage).toBeDefined();
        });

        it('should import ExportStage without errors', async () => {
            expect(ExportStage).toBeDefined();
        });
    });

    describe('Stage helper functions', () => {
        it('should import and use workflow utilities', async () => {
            expect(getStageDisplayName(WorkflowStage.IMPORT)).toBe('Import');
            expect(getStageDisplayName(WorkflowStage.PROGRAM)).toBe('Program');
            expect(getStageDisplayName(WorkflowStage.SIMULATE)).toBe(
                'Simulate'
            );
            expect(getStageDisplayName(WorkflowStage.EXPORT)).toBe('Export');

            expect(getStageDescription(WorkflowStage.IMPORT)).toContain(
                'Import DXF or SVG'
            );
            expect(getStageDescription(WorkflowStage.PROGRAM)).toContain(
                'Build cuts'
            );
            expect(getStageDescription(WorkflowStage.SIMULATE)).toContain(
                'Simulate cutting'
            );
            expect(getStageDescription(WorkflowStage.EXPORT)).toContain(
                'Generate and download'
            );
        });
    });

    describe('Workflow stage progression logic', () => {
        it('should define correct stage order', async () => {
            // Test the expected progression through store methods
            expect(workflowStore.getNextStage()).toBe(WorkflowStage.PROGRAM);

            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.setStage(WorkflowStage.PROGRAM);
            expect(workflowStore.getNextStage()).toBe(WorkflowStage.SIMULATE);

            workflowStore.completeStage(WorkflowStage.PROGRAM);
            workflowStore.setStage(WorkflowStage.SIMULATE);
            expect(workflowStore.getNextStage()).toBe(WorkflowStage.EXPORT);

            workflowStore.completeStage(WorkflowStage.SIMULATE);
            workflowStore.setStage(WorkflowStage.EXPORT);
            expect(workflowStore.getNextStage()).toBe(null); // Last stage
        });
    });
});
