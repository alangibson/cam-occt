import type { WorkflowStage } from '$lib/stores/workflow/enums';

export interface CanvasConfiguration {
    respectLayerVisibility: boolean;
    onChainClick: ((chainId: string) => void) | null;
    onPartClick: ((partId: string) => void) | null;
    interactionMode: 'shapes' | 'chains' | 'cuts';
}

export interface StageEventHandlers {
    onChainClick?: ((chainId: string) => void) | null;
    onPartClick?: ((partId: string) => void) | null;
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
                interactionMode: 'cuts',
            };

        case 'export':
            return {
                respectLayerVisibility: false, // Show all layers in export
                onChainClick: null,
                onPartClick: null,
                interactionMode: 'cuts',
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
