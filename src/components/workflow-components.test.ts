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
            const { getStageDisplayName, getStageDescription, WorkflowStage } =
                await import('../lib/stores/workflow');

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
            const { workflowStore, WorkflowStage } = await import(
                '../lib/stores/workflow'
            );

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
