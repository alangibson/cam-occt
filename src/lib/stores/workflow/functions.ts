import { WorkflowStage } from './enums';

// Define the workflow progression order
const WORKFLOW_ORDER: WorkflowStage[] = [
    WorkflowStage.IMPORT,
    WorkflowStage.EDIT,
    WorkflowStage.PREPARE,
    WorkflowStage.PROGRAM,
    WorkflowStage.SIMULATE,
    WorkflowStage.EXPORT,
];

/**
 * Validates if a stage can be advanced to based on completed stages
 * @param targetStage Stage to check advancement to
 * @param completedStages Set of already completed stages
 * @param enabledStages Optional array of enabled stages (defaults to all stages)
 * @returns Whether the target stage can be advanced to
 */
export function validateStageAdvancement(
    targetStage: WorkflowStage,
    completedStages: Set<WorkflowStage>,
    enabledStages?: WorkflowStage[]
): boolean {
    // If enabledStages is provided, check if target stage is enabled
    if (enabledStages && !enabledStages.includes(targetStage)) {
        return false;
    }

    const targetIndex = WORKFLOW_ORDER.indexOf(targetStage);

    // Special case: Export stage becomes available when Program is completed (same as Simulate)
    if (targetStage === WorkflowStage.EXPORT) {
        // Export requires all previous enabled stages to be completed
        // Check Import, Edit, Prepare, Program (skip Simulate if not checking all)
        const requiredStages = [
            WorkflowStage.IMPORT,
            WorkflowStage.EDIT,
            WorkflowStage.PREPARE,
            WorkflowStage.PROGRAM,
        ];

        for (const stage of requiredStages) {
            // Skip disabled stages
            if (enabledStages && !enabledStages.includes(stage)) {
                continue;
            }
            if (!completedStages.has(stage)) {
                return false;
            }
        }
        return true;
    }

    // For sequential workflow, all previous enabled stages must be completed
    for (let i: number = 0; i < targetIndex; i++) {
        const stage = WORKFLOW_ORDER[i];
        // Skip disabled stages
        if (enabledStages && !enabledStages.includes(stage)) {
            continue;
        }
        if (!completedStages.has(stage)) {
            return false;
        }
    }
    return true;
}

// Helper function to get stage display names
export function getStageDisplayName(stage: WorkflowStage): string {
    switch (stage) {
        case WorkflowStage.IMPORT:
            return 'Import';
        case WorkflowStage.EDIT:
            return 'Edit';
        case WorkflowStage.PREPARE:
            return 'Prepare';
        case WorkflowStage.PROGRAM:
            return 'Program';
        case WorkflowStage.SIMULATE:
            return 'Simulate';
        case WorkflowStage.EXPORT:
            return 'Export';
        default:
            return stage;
    }
}

// Helper function to get stage descriptions
export function getStageDescription(stage: WorkflowStage): string {
    switch (stage) {
        case WorkflowStage.IMPORT:
            return 'Import DXF or SVG drawings';
        case WorkflowStage.EDIT:
            return 'Edit drawing using basic tools';
        case WorkflowStage.PREPARE:
            return 'Analyze chains and detect parts';
        case WorkflowStage.PROGRAM:
            return 'Build cuts with cut parameters';
        case WorkflowStage.SIMULATE:
            return 'Simulate cutting process';
        case WorkflowStage.EXPORT:
            return 'Generate and download G-code';
        default:
            return '';
    }
}

/**
 * Type guard for checking if a value is a valid WorkflowStage
 */
export function isWorkflowStage(value: string): value is WorkflowStage {
    return Object.values(WorkflowStage).includes(value as WorkflowStage);
}

export { WORKFLOW_ORDER };
