/**
 * Prepare Stage Store
 * 
 * Manages state specific to the Prepare stage including algorithm parameters,
 * chain normalization results, and UI layout preferences.
 */

import { writable } from 'svelte/store';
import type { AlgorithmParameters } from '../../types/algorithm-parameters';
import { DEFAULT_ALGORITHM_PARAMETERS } from '../../types/algorithm-parameters';
import type { ChainNormalizationResult } from '../algorithms/chain-normalization';

export interface PrepareStageState {
  // Algorithm parameters
  algorithmParams: AlgorithmParameters;
  
  // Chain normalization results (expensive to recalculate)
  chainNormalizationResults: ChainNormalizationResult[];
  
  // UI layout preferences
  leftColumnWidth: number;
  rightColumnWidth: number;
  
  // Analysis flags
  lastAnalysisTimestamp: number;
}

function createPrepareStageStore() {
  const { subscribe, set, update } = writable<PrepareStageState>({
    algorithmParams: { ...DEFAULT_ALGORITHM_PARAMETERS },
    chainNormalizationResults: [],
    leftColumnWidth: 280,
    rightColumnWidth: 280,
    lastAnalysisTimestamp: 0
  });

  return {
    subscribe,
    
    /**
     * Update algorithm parameters
     */
    setAlgorithmParams: (params: AlgorithmParameters) => {
      update(state => ({
        ...state,
        algorithmParams: params
      }));
    },
    
    /**
     * Update specific algorithm parameter
     */
    updateAlgorithmParam: <K extends keyof AlgorithmParameters>(
      category: K, 
      params: Partial<AlgorithmParameters[K]>
    ) => {
      update(state => ({
        ...state,
        algorithmParams: {
          ...state.algorithmParams,
          [category]: {
            ...state.algorithmParams[category],
            ...params
          }
        }
      }));
    },
    
    /**
     * Set chain normalization results
     */
    setChainNormalizationResults: (results: ChainNormalizationResult[]) => {
      update(state => ({
        ...state,
        chainNormalizationResults: results,
        lastAnalysisTimestamp: Date.now()
      }));
    },
    
    /**
     * Clear chain normalization results
     */
    clearChainNormalizationResults: () => {
      update(state => ({
        ...state,
        chainNormalizationResults: [],
        lastAnalysisTimestamp: 0
      }));
    },
    
    /**
     * Update UI layout
     */
    setColumnWidths: (leftWidth: number, rightWidth: number) => {
      update(state => ({
        ...state,
        leftColumnWidth: leftWidth,
        rightColumnWidth: rightWidth
      }));
    },
    
    /**
     * Reset to defaults
     */
    reset: () => {
      set({
        algorithmParams: { ...DEFAULT_ALGORITHM_PARAMETERS },
        chainNormalizationResults: [],
        leftColumnWidth: 280,
        rightColumnWidth: 280,
        lastAnalysisTimestamp: 0
      });
    },
    
    /**
     * Get chain normalization result for specific chain
     */
    getChainNormalizationResult: (chainId: string): ChainNormalizationResult | null => {
      let result: ChainNormalizationResult | null = null;
      update(state => {
        result = state.chainNormalizationResults.find(r => r.chainId === chainId) || null;
        return state;
      });
      return result;
    }
  };
}

export const prepareStageStore = createPrepareStageStore();