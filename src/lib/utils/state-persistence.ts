/**
 * State Persistence Utilities
 * 
 * Provides comprehensive state saving and restoration for the CAM-OCCT application.
 * Saves all application state to browser localStorage to maintain state across sessions.
 */

export interface PersistedState {
  // Drawing state
  drawing: any;
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
  chains: any[];
  tolerance: number;
  selectedChainId: string | null;
  
  // Parts state
  parts: any[];
  partWarnings: any[];
  highlightedPartId: string | null;
  
  // Rapids state
  rapids: any[];
  showRapids: boolean;
  selectedRapidId: string | null;
  highlightedRapidId: string | null;
  
  // UI state
  showToolTable: boolean;
  
  // Tessellation state
  tessellationActive: boolean;
  tessellationPoints: any[];
  
  // Overlay state
  overlayStage: string;
  overlays: any;
  
  // Lead warnings
  leadWarnings: any[];
  
  // Prepare stage state
  prepareStageState: any;
  
  // Operations, paths, and tools
  operations: any[];
  paths: any[];
  tools: any[];
  
  // Timestamp for debugging
  savedAt: string;
}

const STATE_STORAGE_KEY = 'cam-occt-state';
const STATE_VERSION = '1.0.0';

/**
 * Save complete application state to localStorage
 */
export function saveState(state: PersistedState): void {
  try {
    const stateWithMeta = {
      version: STATE_VERSION,
      ...state,
      savedAt: new Date().toISOString()
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
        localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify({
          version: STATE_VERSION,
          ...state,
          savedAt: new Date().toISOString()
        }));
        console.log('Application state saved after clearing old data');
      } catch (retryError) {
        console.error('Failed to save state even after clearing:', retryError);
      }
    }
  }
}

/**
 * Load complete application state from localStorage
 */
export function loadState(): PersistedState | null {
  try {
    const savedData = localStorage.getItem(STATE_STORAGE_KEY);
    if (!savedData) {
      console.log('No saved state found');
      return null;
    }
    
    const parsedState = JSON.parse(savedData);
    
    // Version check
    if (parsedState.version !== STATE_VERSION) {
      console.warn(`State version mismatch: saved=${parsedState.version}, current=${STATE_VERSION}`);
      // Could implement migration logic here in the future
      return null;
    }
    
    console.log('Application state loaded from localStorage', parsedState.savedAt);
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
  const savedData = localStorage.getItem(STATE_STORAGE_KEY);
  return savedData ? new Blob([savedData]).size : 0;
}

/**
 * Debounce utility for auto-saving
 */
export function debounce<T extends (...args: any[]) => void>(
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
export const debouncedSave = debounce(saveState, 1000); // Save 1 second after last change