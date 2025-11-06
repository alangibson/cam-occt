/**
 * State Persistence Utilities
 *
 * Provides comprehensive state saving and restoration for the MetalHead CAM application.
 * Saves all application state to browser localStorage to maintain state across sessions.
 */

import {
    STATE_VERSION,
    STATE_STORAGE_KEY,
    MILLISECONDS_IN_SECOND,
} from './constants';
import type { PersistedState } from './interfaces';

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
                console.warn('Application state saved after clearing old data');
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
            return null;
        }

        const parsedState: PersistedState & { version?: string } =
            JSON.parse(savedData);

        // Version check
        if (parsedState.version !== STATE_VERSION) {
            console.warn(
                `State version mismatch: saved=${parsedState.version}, current=${STATE_VERSION}`
            );
            // Could implement migration logic here in the future
            return null;
        }
        return parsedState;
    } catch (error) {
        console.error('Failed to load application state:', error);
        return null;
    }
}

/**
 * Clear all persisted state
 */
export function clearPersistedState(): void {
    try {
        localStorage.removeItem(STATE_STORAGE_KEY);
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
function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
    func: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;

    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}

/**
 * Create a debounced save function
 */
export const debouncedSave = debounce(saveState, MILLISECONDS_IN_SECOND); // Save 1 second after last change
