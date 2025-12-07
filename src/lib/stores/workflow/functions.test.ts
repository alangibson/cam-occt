import { describe, it, expect } from 'vitest';
import {
    validateStageAdvancement,
    getStageDisplayName,
    getStageDescription,
    isWorkflowStage,
    WORKFLOW_ORDER,
} from './functions';
import { WorkflowStage } from './enums';

describe('Workflow functions', () => {
    describe('validateStageAdvancement', () => {
        it('should allow import stage initially', () => {
            const completedStages = new Set<WorkflowStage>();
            const result = validateStageAdvancement(
                WorkflowStage.IMPORT,
                completedStages
            );
            expect(result).toBe(true);
        });

        it('should allow program stage after import is completed', () => {
            const completedStages = new Set([WorkflowStage.IMPORT]);
            const result = validateStageAdvancement(
                WorkflowStage.PROGRAM,
                completedStages
            );
            expect(result).toBe(true);
        });

        it('should not allow program stage without import completed', () => {
            const completedStages = new Set<WorkflowStage>();
            const result = validateStageAdvancement(
                WorkflowStage.PROGRAM,
                completedStages
            );
            expect(result).toBe(false);
        });

        it('should allow export stage when program is completed (special case)', () => {
            const completedStages = new Set([
                WorkflowStage.IMPORT,
                WorkflowStage.PROGRAM,
            ]);
            const result = validateStageAdvancement(
                WorkflowStage.EXPORT,
                completedStages
            );
            expect(result).toBe(true);
        });

        it('should not allow export stage without program completed', () => {
            const completedStages = new Set([WorkflowStage.IMPORT]);
            const result = validateStageAdvancement(
                WorkflowStage.EXPORT,
                completedStages
            );
            expect(result).toBe(false);
        });

        it('should not allow export stage without import completed', () => {
            const completedStages = new Set([WorkflowStage.PROGRAM]);
            const result = validateStageAdvancement(
                WorkflowStage.EXPORT,
                completedStages
            );
            expect(result).toBe(false);
        });

        it('should validate sequential stages properly', () => {
            const completedStages = new Set([
                WorkflowStage.IMPORT,
                WorkflowStage.PROGRAM,
            ]);

            expect(
                validateStageAdvancement(
                    WorkflowStage.SIMULATE,
                    completedStages
                )
            ).toBe(true);
            expect(
                validateStageAdvancement(WorkflowStage.EXPORT, completedStages)
            ).toBe(true);
        });
    });

    describe('getStageDisplayName', () => {
        it('should return correct display names for all stages', () => {
            expect(getStageDisplayName(WorkflowStage.IMPORT)).toBe('Import');
            expect(getStageDisplayName(WorkflowStage.PROGRAM)).toBe('Program');
            expect(getStageDisplayName(WorkflowStage.SIMULATE)).toBe(
                'Simulate'
            );
            expect(getStageDisplayName(WorkflowStage.EXPORT)).toBe('Export');
        });

        it('should return the input value for unknown stages (default case)', () => {
            const unknownStage = 'unknown-stage' as WorkflowStage;
            expect(getStageDisplayName(unknownStage)).toBe('unknown-stage');
        });
    });

    describe('getStageDescription', () => {
        it('should return correct descriptions for all stages', () => {
            expect(getStageDescription(WorkflowStage.IMPORT)).toBe(
                'Import DXF or SVG drawings'
            );
            expect(getStageDescription(WorkflowStage.PROGRAM)).toBe(
                'Build cuts with cut parameters'
            );
            expect(getStageDescription(WorkflowStage.SIMULATE)).toBe(
                'Simulate cutting process'
            );
            expect(getStageDescription(WorkflowStage.EXPORT)).toBe(
                'Generate and download G-code'
            );
        });

        it('should return empty string for unknown stages (default case)', () => {
            const unknownStage = 'unknown-stage' as WorkflowStage;
            expect(getStageDescription(unknownStage)).toBe('');
        });
    });

    describe('isWorkflowStage', () => {
        it('should return true for valid workflow stages', () => {
            expect(isWorkflowStage(WorkflowStage.IMPORT)).toBe(true);
            expect(isWorkflowStage(WorkflowStage.PROGRAM)).toBe(true);
            expect(isWorkflowStage(WorkflowStage.SIMULATE)).toBe(true);
            expect(isWorkflowStage(WorkflowStage.EXPORT)).toBe(true);
        });

        it('should return false for invalid values', () => {
            expect(isWorkflowStage('invalid-stage')).toBe(false);
            expect(isWorkflowStage(null as any)).toBe(false);
            expect(isWorkflowStage(undefined as any)).toBe(false);
            expect(isWorkflowStage(123 as any)).toBe(false);
            expect(isWorkflowStage({} as any)).toBe(false);
            expect(isWorkflowStage([] as any)).toBe(false);
            expect(isWorkflowStage('')).toBe(false);
        });
    });

    describe('WORKFLOW_ORDER', () => {
        it('should contain all workflow stages in correct order', () => {
            expect(WORKFLOW_ORDER).toEqual([
                WorkflowStage.IMPORT,
                WorkflowStage.PROGRAM,
                WorkflowStage.SIMULATE,
                WorkflowStage.EXPORT,
            ]);
        });

        it('should have 4 stages', () => {
            expect(WORKFLOW_ORDER).toHaveLength(4);
        });
    });
});
