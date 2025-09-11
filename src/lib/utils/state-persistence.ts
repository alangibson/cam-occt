/**
 * State Persistence Utilities
 *
 * Provides comprehensive state saving and restoration for the MetalHead CAM application.
 * Saves all application state to browser localStorage to maintain state across sessions.
 */

import type { Drawing } from '$lib/types/geometry';
import type { Chain } from '../algorithms/chain-detection/chain-detection';
import type {
    DetectedPart,
    PartDetectionWarning,
} from '$lib/algorithms/part-detection/part-detection';
import type { Rapid } from '../algorithms/optimize-cut-order';
import type { TessellationPoint, DrawingOverlay } from '$lib/stores/overlay';
import type { LeadWarning } from '$lib/stores/lead-warnings';
import type { PrepareStageState } from '$lib/stores/prepare-stage';
import type { Operation } from '$lib/stores/operations';
import type { Path } from '$lib/stores/paths';
import type { Tool } from '$lib/stores/tools';
/**
 * Time conversion constant
 */
const MILLISECONDS_IN_SECOND = 1000;

export interface PersistedState {
    // Drawing state
    drawing: Drawing | null;
    selectedShapes: string[];
    hoveredShape: string | null;
    scale: number;
    offset: { x: number; y: number };
    fileName: string | null;
    layerVisibility: Record<string, boolean>;
    displayUnit: 'mm' | 'inch';

    // Workflow state
    currentStage: string;
    completedStages: string[];

    // Chains state
    chains: Chain[];
    tolerance: number;
    selectedChainId: string | null;

    // Parts state
    parts: DetectedPart[];
    partWarnings: PartDetectionWarning[];
    highlightedPartId: string | null;

    // Rapids state
    rapids: Rapid[];
    showRapids: boolean;
    selectedRapidId: string | null;
    highlightedRapidId: string | null;

    // UI state
    showToolTable: boolean;

    // Tessellation state
    tessellationActive: boolean;
    tessellationPoints: TessellationPoint[];

    // Overlay state
    overlayStage: string;
    overlays: Record<string, DrawingOverlay>;

    // Lead warnings
    leadWarnings: LeadWarning[];

    // Prepare stage state
    prepareStageState: PrepareStageState | null;

    // Operations, paths, and tools
    operations: Operation[];
    paths: Path[];
    tools: Tool[];

    // Timestamp for debugging
    savedAt: string;

    selectedPathId: string | null;
    highlightedPathId: string | null;
}

const STATE_STORAGE_KEY: string = 'metalheadcam-state';
const STATE_VERSION: string = '1.0.0';

/**
 * Save complete application state to localStorage
 */
export function saveState(state: PersistedState): void {
    try {
        const stateWithMeta: PersistedState & {
            version: string;
            savedAt: string;
        } = {
            version: STATE_VERSION,
            ...state,
            savedAt: new Date().toISOString(),
        };

        localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(stateWithMeta));
        console.log('Application state saved to localStorage');
    } catch (error) {
        console.error('Failed to save application state:', error);

        // If localStorage is full, try to clear old data and retry
        if (error instanceof Error && error.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded, clearing old data');
            clearPersistedState();
            try {
                localStorage.setItem(
                    STATE_STORAGE_KEY,
                    JSON.stringify({
                        version: STATE_VERSION,
                        ...state,
                        savedAt: new Date().toISOString(),
                    })
                );
                console.log('Application state saved after clearing old data');
            } catch (retryError) {
                console.error(
                    'Failed to save state even after clearing:',
                    retryError
                );
            }
        }
    }
}

/**
 * Load complete application state from localStorage
 */
export function loadState(): PersistedState | null {
    try {
        const savedData: string | null =
            localStorage.getItem(STATE_STORAGE_KEY);
        if (!savedData) {
            console.log('No saved state found');
            return null;
        }

        const parsedState: PersistedState & { version?: string } =
            JSON.parse(savedData);

        // Version check
        if (parsedState.version !== STATE_VERSION) {
            console.log(
                `State version mismatch: saved=${parsedState.version}, current=${STATE_VERSION}`
            );
            // Could implement migration logic here in the future
            return null;
        }

        console.log(
            'Application state loaded from localStorage',
            parsedState.savedAt
        );
        return parsedState;
    } catch (error) {
        console.log('Failed to load application state:', error);
        return null;
    }
}

/**
 * Clear all persisted state
 */
export function clearPersistedState(): void {
    try {
        localStorage.removeItem(STATE_STORAGE_KEY);
        console.log('Persisted state cleared');
    } catch (error) {
        console.error('Failed to clear persisted state:', error);
    }
}

/**
 * Check if persisted state exists
 */
export function hasPersistedState(): boolean {
    return localStorage.getItem(STATE_STORAGE_KEY) !== null;
}

/**
 * Get the size of persisted state in bytes (for debugging)
 */
export function getPersistedStateSize(): number {
    const savedData: string | null = localStorage.getItem(STATE_STORAGE_KEY);
    return savedData ? new Blob([savedData]).size : 0;
}

/**
 * Debounce utility for auto-saving
 */
export function debounce<T extends (...args: never[]) => void>(
    func: T,
    delay: number
): T {
    let timeoutId: ReturnType<typeof setTimeout>;

    return ((...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    }) as T;
}

/**
 * Create a debounced save function
 */
export const debouncedSave = debounce(saveState, MILLISECONDS_IN_SECOND); // Save 1 second after last change
