/**
 * Lead Configuration Utilities
 * 
 * Shared utilities for creating lead-in and lead-out configurations from paths.
 * Consolidates duplicated lead configuration code across the application.
 */

import type { Path } from '../stores/paths';
import type { LeadInConfig, LeadOutConfig } from '../algorithms/lead-calculation';
import { LeadType } from '../types/direction';

/**
 * Create lead-in configuration from path
 */
export function createLeadInConfig(path: Path): LeadInConfig {
  return {
    type: path.leadInType || LeadType.NONE,
    length: path.leadInLength || 0,
    flipSide: path.leadInFlipSide || false,
    angle: path.leadInAngle,
    fit: path.leadInFit !== undefined ? path.leadInFit : true // Default to true for backwards compatibility
  };
}

/**
 * Create lead-out configuration from path
 */
export function createLeadOutConfig(path: Path): LeadOutConfig {
  return {
    type: path.leadOutType || LeadType.NONE,
    length: path.leadOutLength || 0,
    flipSide: path.leadOutFlipSide || false,
    angle: path.leadOutAngle,
    fit: path.leadOutFit !== undefined ? path.leadOutFit : true // Default to true for backwards compatibility
  };
}

/**
 * Create both lead configurations from path
 */
export function createLeadConfigs(path: Path): { leadIn: LeadInConfig; leadOut: LeadOutConfig } {
  return {
    leadIn: createLeadInConfig(path),
    leadOut: createLeadOutConfig(path)
  };
}