import { describe, expect, it } from 'vitest';
import WorkflowBreadcrumbs from './WorkflowBreadcrumbs.svelte';
import WorkflowContainer from './WorkflowContainer.svelte';
import ImportStage from './stages/ImportStage.svelte';
import EditStage from './stages/EditStage.svelte';
import PrepareStage from './stages/PrepareStage.svelte';
import ProgramStage from './stages/ProgramStage.svelte';
import SimulateStage from './stages/SimulateStage.svelte';
import ExportStage from './stages/ExportStage.svelte';
import { workflowStore } from '$lib/stores/workflow/store';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import {
    getStageDescription,
    getStageDisplayName,
} from '$lib/stores/workflow/functions';

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

        it('should import EditStage without errors', async () => {
            expect(EditStage).toBeDefined();
        });

        it('should import PrepareStage without errors', async () => {
            expect(PrepareStage).toBeDefined();
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
            expect(getStageDisplayName(WorkflowStage.EDIT)).toBe('Edit');
            expect(getStageDisplayName(WorkflowStage.PREPARE)).toBe('Prepare');
            expect(getStageDisplayName(WorkflowStage.PROGRAM)).toBe('Program');
            expect(getStageDisplayName(WorkflowStage.SIMULATE)).toBe(
                'Simulate'
            );
            expect(getStageDisplayName(WorkflowStage.EXPORT)).toBe('Export');

            expect(getStageDescription(WorkflowStage.IMPORT)).toContain(
                'Import DXF or SVG'
            );
            expect(getStageDescription(WorkflowStage.EDIT)).toContain(
                'Edit drawing'
            );
            expect(getStageDescription(WorkflowStage.PREPARE)).toContain(
                'Analyze chains'
            );
            expect(getStageDescription(WorkflowStage.PROGRAM)).toContain(
                'Build tool paths'
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
            expect(workflowStore.getNextStage()).toBe(WorkflowStage.EDIT);

            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.setStage(WorkflowStage.EDIT);
            expect(workflowStore.getNextStage()).toBe(WorkflowStage.PREPARE);

            workflowStore.completeStage(WorkflowStage.EDIT);
            workflowStore.setStage(WorkflowStage.PREPARE);
            expect(workflowStore.getNextStage()).toBe(WorkflowStage.PROGRAM);

            workflowStore.completeStage(WorkflowStage.PREPARE);
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
