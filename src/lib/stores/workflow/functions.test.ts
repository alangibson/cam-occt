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

        it('should allow edit stage after import is completed', () => {
            const completedStages = new Set([WorkflowStage.IMPORT]);
            const result = validateStageAdvancement(
                WorkflowStage.EDIT,
                completedStages
            );
            expect(result).toBe(true);
        });

        it('should not allow edit stage without import completed', () => {
            const completedStages = new Set<WorkflowStage>();
            const result = validateStageAdvancement(
                WorkflowStage.EDIT,
                completedStages
            );
            expect(result).toBe(false);
        });

        it('should allow export stage when program is completed (special case)', () => {
            const completedStages = new Set([
                WorkflowStage.IMPORT,
                WorkflowStage.EDIT,
                WorkflowStage.PREPARE,
                WorkflowStage.PROGRAM,
            ]);
            const result = validateStageAdvancement(
                WorkflowStage.EXPORT,
                completedStages
            );
            expect(result).toBe(true);
        });

        it('should not allow export stage without program completed', () => {
            const completedStages = new Set([
                WorkflowStage.IMPORT,
                WorkflowStage.EDIT,
                WorkflowStage.PREPARE,
            ]);
            const result = validateStageAdvancement(
                WorkflowStage.EXPORT,
                completedStages
            );
            expect(result).toBe(false);
        });

        it('should not allow export stage with missing intermediate stages', () => {
            const completedStages = new Set([
                WorkflowStage.IMPORT,
                WorkflowStage.PROGRAM, // Missing EDIT and PREPARE
            ]);
            const result = validateStageAdvancement(
                WorkflowStage.EXPORT,
                completedStages
            );
            expect(result).toBe(false);
        });

        it('should validate sequential stages properly', () => {
            const completedStages = new Set([
                WorkflowStage.IMPORT,
                WorkflowStage.EDIT,
            ]);

            expect(
                validateStageAdvancement(WorkflowStage.PREPARE, completedStages)
            ).toBe(true);
            expect(
                validateStageAdvancement(WorkflowStage.PROGRAM, completedStages)
            ).toBe(false);
            expect(
                validateStageAdvancement(
                    WorkflowStage.SIMULATE,
                    completedStages
                )
            ).toBe(false);
        });
    });

    describe('getStageDisplayName', () => {
        it('should return correct display names for all stages', () => {
            expect(getStageDisplayName(WorkflowStage.IMPORT)).toBe('Import');
            expect(getStageDisplayName(WorkflowStage.EDIT)).toBe('Edit');
            expect(getStageDisplayName(WorkflowStage.PREPARE)).toBe('Prepare');
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
            expect(getStageDescription(WorkflowStage.EDIT)).toBe(
                'Edit drawing using basic tools'
            );
            expect(getStageDescription(WorkflowStage.PREPARE)).toBe(
                'Analyze chains and detect parts'
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
            expect(isWorkflowStage(WorkflowStage.EDIT)).toBe(true);
            expect(isWorkflowStage(WorkflowStage.PREPARE)).toBe(true);
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
                WorkflowStage.EDIT,
                WorkflowStage.PREPARE,
                WorkflowStage.PROGRAM,
                WorkflowStage.SIMULATE,
                WorkflowStage.EXPORT,
            ]);
        });

        it('should have 6 stages', () => {
            expect(WORKFLOW_ORDER).toHaveLength(6);
        });
    });
});
