import type { WorkflowStage } from '$lib/stores/workflow/enums';

export interface CanvasConfiguration {
    respectLayerVisibility: boolean;
    onChainClick: ((chainId: string) => void) | null;
    onPartClick: ((partId: string) => void) | null;
    interactionMode: 'shapes' | 'chains' | 'paths';
}

export interface StageEventHandlers {
    onChainClick?: (chainId: string) => void;
    onPartClick?: (partId: string) => void;
}

/**
 * Get canvas configuration for a specific workflow stage
 */
export function getCanvasConfigForStage(
    stage: WorkflowStage,
    handlers: StageEventHandlers = {}
): CanvasConfiguration {
    switch (stage) {
        case 'import':
            return {
                respectLayerVisibility: true,
                onChainClick: null,
                onPartClick: null,
                interactionMode: 'shapes',
            };

        case 'edit':
            return {
                respectLayerVisibility: true,
                onChainClick: null,
                onPartClick: null,
                interactionMode: 'shapes',
            };

        case 'prepare':
            return {
                respectLayerVisibility: false, // Show all layers in prepare
                onChainClick: handlers.onChainClick || null,
                onPartClick: handlers.onPartClick || null,
                interactionMode: 'chains',
            };

        case 'program':
            return {
                respectLayerVisibility: false, // Show all layers in program
                onChainClick: handlers.onChainClick || null,
                onPartClick: handlers.onPartClick || null,
                interactionMode: 'chains',
            };

        case 'simulate':
            return {
                respectLayerVisibility: false, // Show all layers in simulate
                onChainClick: null,
                onPartClick: null,
                interactionMode: 'paths',
            };

        case 'export':
            return {
                respectLayerVisibility: false, // Show all layers in export
                onChainClick: null,
                onPartClick: null,
                interactionMode: 'paths',
            };

        default:
            // Default configuration
            return {
                respectLayerVisibility: true,
                onChainClick: null,
                onPartClick: null,
                interactionMode: 'shapes',
            };
    }
}

/**
 * Create event handlers object from stage-specific handler functions
 */
export function createStageEventHandlers(
    stage: WorkflowStage,
    stageHandlers: {
        editHandlers?: object;
        prepareHandlers?: {
            handleChainClick?: (chainId: string) => void;
            handlePartClick?: (partId: string) => void;
        };
        programHandlers?: {
            handleChainClick?: (chainId: string) => void;
            handlePartClick?: (partId: string) => void;
        };
        simulateHandlers?: object;
        exportHandlers?: object;
    } = {}
): StageEventHandlers {
    switch (stage) {
        case 'prepare':
            return {
                onChainClick: stageHandlers.prepareHandlers?.handleChainClick,
                onPartClick: stageHandlers.prepareHandlers?.handlePartClick,
            };

        case 'program':
            return {
                onChainClick: stageHandlers.programHandlers?.handleChainClick,
                onPartClick: stageHandlers.programHandlers?.handlePartClick,
            };

        default:
            return {};
    }
}
