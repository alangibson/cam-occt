/**
 * OpenCascade.js test setup for Node.js environment
 * 
 * This module provides proper initialization of OpenCascade.js WASM module
 * for use in unit tests running in Node.js with Vitest.
 */

import initOpenCascade from 'opencascade.js/dist/node.js';

let openCascadeInstance: any = null;

/**
 * Initialize OpenCascade.js for testing
 * This should be called once before running geometric tests
 */
export async function initOpenCascadeForTests(): Promise<any> {
  if (!openCascadeInstance) {
    try {
      console.log('Initializing OpenCascade.js for Node.js tests...');
      openCascadeInstance = await initOpenCascade();
      console.log('OpenCascade.js initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OpenCascade.js:', error);
      throw error;
    }
  }
  return openCascadeInstance;
}

/**
 * Get the current OpenCascade.js instance
 * Must call initOpenCascadeForTests() first
 */
export function getOpenCascadeInstance(): any {
  if (!openCascadeInstance) {
    throw new Error('OpenCascade.js not initialized. Call initOpenCascadeForTests() first.');
  }
  return openCascadeInstance;
}

/**
 * Check if OpenCascade.js is available and initialized
 */
export function isOpenCascadeAvailable(): boolean {
  return openCascadeInstance !== null;
}

/**
 * Clean up OpenCascade.js instance (for test teardown)
 */
export function cleanupOpenCascade(): void {
  openCascadeInstance = null;
}