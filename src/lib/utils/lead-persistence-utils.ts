/**
 * Lead Persistence Utilities
 * 
 * Helper functions to calculate and store lead geometry in paths for persistence
 */

import type { Path } from '../stores/paths';
import type { Operation } from '../stores/operations';
import type { DetectedPart } from '../algorithms/part-detection';
import type { ShapeChain } from '../algorithms/chain-detection';
import { calculateLeads, type LeadInConfig, type LeadOutConfig } from '../algorithms/lead-calculation';
import { LeadType } from '../types/direction';
import { pathStore } from '../stores/paths';
import { get } from 'svelte/store';
import { chainStore } from '../stores/chains';
import { partStore } from '../stores/parts';

/**
 * Calculate and store lead geometry for a path
 */
export async function calculateAndStorePathLeads(
  path: Path,
  operation: Operation,
  chain: ShapeChain,
  parts: DetectedPart[]
): Promise<void> {
  try {
    // Skip if both leads are disabled
    if (path.leadInType === 'none' && path.leadOutType === 'none') {
      return;
    }

    // Get the part if the path is part of a part
    let part = null;
    if (operation.targetType === 'parts') {
      part = parts?.find(p => 
        p.shell.chain.id === path.chainId || 
        p.holes.some((h: any) => h.chain.id === path.chainId)
      );
    }

    // Get lead configurations with proper defaults
    const leadInConfig: LeadInConfig = {
      type: path.leadInType || LeadType.NONE,
      length: path.leadInLength || 0,
      flipSide: path.leadInFlipSide || false,
      angle: path.leadInAngle
    };

    const leadOutConfig: LeadOutConfig = {
      type: path.leadOutType || LeadType.NONE,
      length: path.leadOutLength || 0,
      flipSide: path.leadOutFlipSide || false,
      angle: path.leadOutAngle
    };

    // Calculate leads
    const leadResult = calculateLeads(
      chain,
      leadInConfig,
      leadOutConfig,
      path.cutDirection,
      part
    );

    // Store calculated geometry in the path
    const leadGeometry: Parameters<typeof pathStore.updatePathLeadGeometry>[1] = {};

    if (leadResult.leadIn) {
      leadGeometry.leadIn = {
        points: leadResult.leadIn.points,
        type: leadResult.leadIn.type
      };
    }

    if (leadResult.leadOut) {
      leadGeometry.leadOut = {
        points: leadResult.leadOut.points,
        type: leadResult.leadOut.type
      };
    }

    // Store validation results
    if (leadResult.warnings && leadResult.warnings.length > 0) {
      leadGeometry.validation = {
        isValid: true, // Has warnings but still valid
        warnings: leadResult.warnings,
        errors: [],
        severity: 'warning' as const
      };
    } else {
      leadGeometry.validation = {
        isValid: true,
        warnings: [],
        errors: [],
        severity: 'info' as const
      };
    }

    // Update the path with calculated lead geometry
    pathStore.updatePathLeadGeometry(path.id, leadGeometry);

    console.log(`Calculated and stored leads for path ${path.name}:`, {
      leadInPoints: leadResult.leadIn?.points?.length || 0,
      leadOutPoints: leadResult.leadOut?.points?.length || 0,
      warnings: leadResult.warnings?.length || 0
    });

  } catch (error) {
    console.error(`Failed to calculate leads for path ${path.name}:`, error);
    
    // Store error information
    pathStore.updatePathLeadGeometry(path.id, {
      validation: {
        isValid: false,
        warnings: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        severity: 'error'
      }
    });
  }
}

/**
 * Check if path has valid cached lead geometry
 */
export function hasValidCachedLeads(path: Path): boolean {
  const currentVersion = '1.0.0'; // Should match the version in paths.ts
  
  // Check if we have cached lead geometry
  const hasLeadIn = path.calculatedLeadIn && 
    path.calculatedLeadIn.version === currentVersion &&
    path.calculatedLeadIn.points.length > 0;
    
  const hasLeadOut = path.calculatedLeadOut && 
    path.calculatedLeadOut.version === currentVersion &&
    path.calculatedLeadOut.points.length > 0;

  // For lead-in: either no lead needed OR we have valid cached geometry that matches the type
  const leadInMatches = (path.leadInType === 'none' || path.leadInType === LeadType.NONE) ? true :
    (hasLeadIn && path.calculatedLeadIn?.type === path.leadInType);
    
  // For lead-out: either no lead needed OR we have valid cached geometry that matches the type  
  const leadOutMatches = (path.leadOutType === 'none' || path.leadOutType === LeadType.NONE) ? true :
    (hasLeadOut && path.calculatedLeadOut?.type === path.leadOutType);

  return Boolean(leadInMatches && leadOutMatches);
}

/**
 * Get cached lead geometry for display
 */
export function getCachedLeadGeometry(path: Path) {
  return {
    leadIn: path.calculatedLeadIn ? {
      points: path.calculatedLeadIn.points,
      type: path.calculatedLeadIn.type
    } : null,
    leadOut: path.calculatedLeadOut ? {
      points: path.calculatedLeadOut.points,
      type: path.calculatedLeadOut.type
    } : null,
    validation: path.leadValidation
  };
}

/**
 * Calculate and store leads for all paths of an operation
 */
export async function calculateAndStoreOperationLeads(operation: Operation): Promise<void> {
  try {
    // Get current state
    const pathsState = get(pathStore);
    const chainsState = get(chainStore);
    const partsState = get(partStore);
    
    // Find all paths for this operation
    const operationPaths = pathsState.paths.filter(p => p.operationId === operation.id);
    
    console.log(`Calculating leads for ${operationPaths.length} paths in operation ${operation.name}`);
    
    // Calculate leads for each path
    const calculations = operationPaths.map(async (path) => {
      const chain = chainsState.chains.find(c => c.id === path.chainId);
      if (chain) {
        await calculateAndStorePathLeads(path, operation, chain, partsState.parts);
      }
    });
    
    // Wait for all calculations to complete
    await Promise.all(calculations);
    
    console.log(`Completed lead calculations for operation ${operation.name}`);
  } catch (error) {
    console.error(`Failed to calculate leads for operation ${operation.name}:`, error);
  }
}