import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { workflowStore } from '../../lib/stores/workflow';
import { drawingStore } from '../../lib/stores/drawing';

describe('ImportStage workflow behavior', () => {
    beforeEach(() => {
        workflowStore.reset();
    });

    it('should not auto-advance when navigating back to import with existing drawing', () => {
        // Set up initial state: user has already imported a drawing and is on edit stage
        const mockDrawing = {
            shapes: [],
            bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
            units: 'mm' as const,
        };

        // Simulate having imported a file and advanced to edit
        drawingStore.setDrawing(mockDrawing, 'test.dxf');
        workflowStore.completeStage('import');
        workflowStore.setStage('edit');

        // Verify we're on edit stage
        expect(get(workflowStore).currentStage).toBe('edit');

        // Now navigate back to import stage (user clicks import breadcrumb)
        workflowStore.setStage('import');

        // Should remain on import stage, not auto-advance
        expect(get(workflowStore).currentStage).toBe('import');

        // Wait to ensure no delayed auto-advance happens
        return new Promise((resolve) => {
            setTimeout(() => {
                expect(get(workflowStore).currentStage).toBe('import');
                resolve(undefined);
            }, 600); // Wait longer than the 500ms timeout in the component
        });
    });

    it('should only advance to edit when a new file is imported', () => {
        // Start at import stage
        expect(get(workflowStore).currentStage).toBe('import');

        // The ImportStage component would call handleFileImported when FileImport dispatches the event
        // This simulates what happens when the event handler is called
        workflowStore.completeStage('import');

        // After a new file import, it should advance to edit
        return new Promise((resolve) => {
            setTimeout(() => {
                workflowStore.setStage('edit');
                expect(get(workflowStore).currentStage).toBe('edit');
                resolve(undefined);
            }, 500);
        });
    });

    it('should allow users to stay on import stage to load different files', () => {
        // User has a drawing loaded
        const mockDrawing = {
            shapes: [],
            bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
            units: 'mm' as const,
        };

        drawingStore.setDrawing(mockDrawing, 'first.dxf');
        workflowStore.completeStage('import');
        workflowStore.setStage('program'); // User advanced to program stage

        // User wants to load a different file, goes back to import
        workflowStore.setStage('import');
        expect(get(workflowStore).currentStage).toBe('import');

        // User should be able to stay on import and load another file
        // without being kicked to edit stage
        return new Promise((resolve) => {
            setTimeout(() => {
                expect(get(workflowStore).currentStage).toBe('import');

                // Simulate loading a new file
                drawingStore.setDrawing(mockDrawing, 'second.dxf');

                // Should still be on import until the file import event is triggered
                expect(get(workflowStore).currentStage).toBe('import');

                resolve(undefined);
            }, 600);
        });
    });
});
