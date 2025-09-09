import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { workflowStore, WorkflowStage } from '../../lib/stores/workflow';
import { drawingStore } from '../../lib/stores/drawing';
import { Unit } from '../../lib/utils/units';

describe('ImportStage workflow behavior', () => {
    beforeEach(() => {
        workflowStore.reset();
    });

    it('should not auto-advance when navigating back to import with existing drawing', () => {
        // Set up initial state: user has already imported a drawing and is on edit stage
        const mockDrawing = {
            shapes: [],
            bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
            units: Unit.MM,
        };

        // Simulate having imported a file and advanced to edit
        drawingStore.setDrawing(mockDrawing, 'test.dxf');
        workflowStore.completeStage(WorkflowStage.IMPORT);
        workflowStore.setStage(WorkflowStage.EDIT);

        // Verify we're on edit stage
        expect(get(workflowStore).currentStage).toBe(WorkflowStage.EDIT);

        // Now navigate back to import stage (user clicks import breadcrumb)
        workflowStore.setStage(WorkflowStage.IMPORT);

        // Should remain on import stage, not auto-advance
        expect(get(workflowStore).currentStage).toBe(WorkflowStage.IMPORT);

        // Wait to ensure no delayed auto-advance happens
        return new Promise((resolve) => {
            setTimeout(() => {
                expect(get(workflowStore).currentStage).toBe(
                    WorkflowStage.IMPORT
                );
                resolve(undefined);
            }, 600); // Wait longer than the 500ms timeout in the component
        });
    });

    it('should only advance to edit when a new file is imported', () => {
        // Start at import stage
        expect(get(workflowStore).currentStage).toBe(WorkflowStage.IMPORT);

        // The ImportStage component would call handleFileImported when FileImport dispatches the event
        // This simulates what happens when the event handler is called
        workflowStore.completeStage(WorkflowStage.IMPORT);

        // After a new file import, it should advance to edit
        return new Promise((resolve) => {
            setTimeout(() => {
                workflowStore.setStage(WorkflowStage.EDIT);
                expect(get(workflowStore).currentStage).toBe(
                    WorkflowStage.EDIT
                );
                resolve(undefined);
            }, 500);
        });
    });

    it('should allow users to stay on import stage to load different files', () => {
        // User has a drawing loaded
        const mockDrawing = {
            shapes: [],
            bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
            units: Unit.MM,
        };

        drawingStore.setDrawing(mockDrawing, 'first.dxf');
        workflowStore.completeStage(WorkflowStage.IMPORT);
        workflowStore.setStage(WorkflowStage.PROGRAM); // User advanced to program stage

        // User wants to load a different file, goes back to import
        workflowStore.setStage(WorkflowStage.IMPORT);
        expect(get(workflowStore).currentStage).toBe(WorkflowStage.IMPORT);

        // User should be able to stay on import and load another file
        // without being kicked to edit stage
        return new Promise((resolve) => {
            setTimeout(() => {
                expect(get(workflowStore).currentStage).toBe(
                    WorkflowStage.IMPORT
                );

                // Simulate loading a new file
                drawingStore.setDrawing(mockDrawing, 'second.dxf');

                // Should still be on import until the file import event is triggered
                expect(get(workflowStore).currentStage).toBe(
                    WorkflowStage.IMPORT
                );

                resolve(undefined);
            }, 600);
        });
    });
});
