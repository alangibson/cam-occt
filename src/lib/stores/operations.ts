import { writable } from 'svelte/store';
import { pathStore, type Path } from './paths';
import { partStore } from './parts';
import { workflowStore } from './workflow';
import { chainStore } from './chains';
import { toolStore } from './tools';
import { get } from 'svelte/store';
import { detectCutDirection } from '../algorithms/cut-direction';
import { leadWarningsStore } from './lead-warnings';
import { offsetWarningsStore } from './offset-warnings';
import { CutDirection, LeadType } from '../types/direction';
import { calculateAndStoreOperationLeads } from '../utils/lead-persistence-utils';
import type { DetectedPart, PartHole } from '$lib/algorithms/part-detection';
import type { Chain } from '$lib/algorithms/chain-detection/chain-detection';
import type { OffsetDirection } from '../algorithms/offset-calculation/offset/types';
import { KerfCompensation } from '../types/kerf-compensation';
import { offsetChain } from '../algorithms/offset-calculation/chain/offset';
import type { GapFillingResult } from '../algorithms/offset-calculation/chain/types';
import type { Shape } from '../types';

interface OffsetCalculation {
  offsetShapes: Shape[];
  originalShapes: Shape[];
  direction: OffsetDirection;
  kerfWidth: number;
  generatedAt: string;
  version: string;
  gapFills?: GapFillingResult[];
}

// Helper function to calculate offset for a chain
interface ChainOffsetResult {
  offsetShapes: Shape[];
  originalShapes: Shape[];
  kerfWidth: number;
  gapFills?: GapFillingResult[];
}

export interface Operation {
  id: string;
  name: string;
  toolId: string | null; // Reference to tool from tool store
  targetType: 'parts' | 'chains';
  targetIds: string[]; // IDs of parts or chains this operation applies to
  enabled: boolean;
  order: number; // Execution order
  cutDirection: CutDirection; // Preferred cut direction
  leadInType: LeadType; // Lead-in type
  leadInLength: number; // Lead-in length (units)
  leadInFlipSide: boolean; // Flip which side of the chain the lead-in is on
  leadInAngle: number; // Manual rotation angle for lead-in (degrees, 0-360)
  leadOutType: LeadType; // Lead-out type
  leadOutLength: number; // Lead-out length (units)
  leadOutFlipSide: boolean; // Flip which side of the chain the lead-out is on
  leadOutAngle: number; // Manual rotation angle for lead-out (degrees, 0-360)
  kerfCompensation?: KerfCompensation; // Kerf compensation type (none, inner, outer, part)
}

function createOperationsStore(): {
  subscribe: (run: (value: Operation[]) => void) => () => void;
  addOperation: (operation: Omit<Operation, 'id'>) => void;
  updateOperation: (id: string, updates: Partial<Operation>) => void;
  deleteOperation: (id: string) => void;
  reorderOperations: (newOrder: Operation[]) => void;
  duplicateOperation: (id: string) => void;
  applyOperation: (operationId: string) => void;
  applyAllOperations: () => void;
  reset: () => void;
  getAssignedTargets: (excludeOperationId?: string) => { chains: Set<string>, parts: Set<string> };
} {
  const { subscribe, set, update } = writable<Operation[]>([]);

  return {
    subscribe,
    
    addOperation: (operation: Omit<Operation, 'id'>) => {
      update(operations => {
        const newOperation: Operation = {
          ...operation,
          id: crypto.randomUUID()
        };
        
        // Generate paths for the new operation if it has targets and is enabled
        if (newOperation.enabled && newOperation.targetIds.length > 0) {
          setTimeout(() => generatePathsForOperation(newOperation), 0);
        }
        
        return [...operations, newOperation];
      });
    },
    
    updateOperation: (id: string, updates: Partial<Operation>) => {
      update(operations => {
        const newOperations: Operation[] = operations.map(op => 
          op.id === id ? { ...op, ...updates } : op
        );
        
        // Always regenerate paths when operation changes
        const operation: Operation | undefined = newOperations.find(op => op.id === id);
        if (operation) {
          // Clear existing warnings for this operation before regenerating
          leadWarningsStore.clearWarningsForOperation(id);
          offsetWarningsStore.clearWarningsForOperation(id);
          setTimeout(() => generatePathsForOperation(operation), 0);
        }
        
        return newOperations;
      });
    },
    
    deleteOperation: (id: string) => {
      // Remove all paths created by this operation
      pathStore.deletePathsByOperation(id);
      // Clear any warnings for this operation
      leadWarningsStore.clearWarningsForOperation(id);
      offsetWarningsStore.clearWarningsForOperation(id);
      update(operations => operations.filter(op => op.id !== id));
    },
    
    reorderOperations: (newOrder: Operation[]) => {
      set(newOrder);
    },
    
    duplicateOperation: (id: string) => {
      update(operations => {
        const operation: Operation | undefined = operations.find(op => op.id === id);
        if (!operation) return operations;
        
        const newOperation: Operation = {
          ...operation,
          id: crypto.randomUUID(),
          name: `${operation.name} (Copy)`,
          order: Math.max(...operations.map(op => op.order)) + 1
        };
        
        // Generate paths for the duplicated operation if it has targets and is enabled
        if (newOperation.enabled && newOperation.targetIds.length > 0) {
          setTimeout(() => generatePathsForOperation(newOperation), 0);
        }
        
        return [...operations, newOperation];
      });
    },
    
    applyOperation: (operationId: string) => {
      update(operations => {
        const operation: Operation | undefined = operations.find(op => op.id === operationId);
        if (operation && operation.enabled) {
          generatePathsForOperation(operation);
        }
        return operations;
      });
    },
    
    applyAllOperations: () => {
      update(operations => {
        // Clear existing paths first
        pathStore.reset();
        
        // Apply all enabled operations in order
        const enabledOperations: Operation[] = operations
          .filter(op => op.enabled)
          .sort((a, b) => a.order - b.order);
          
        enabledOperations.forEach(operation => {
          generatePathsForOperation(operation);
        });
        
        return operations;
      });
    },

    reset: () => set([]),
    
    // Get all target IDs that are already assigned to operations
    getAssignedTargets: (excludeOperationId?: string): { chains: Set<string>, parts: Set<string> } => {
      const assignedChains: Set<string> = new Set<string>();
      const assignedParts: Set<string> = new Set<string>();
      
      const unsubscribe: () => void = subscribe(operations => {
        operations.forEach(op => {
          // Skip the excluded operation (for when checking during edit)
          if (excludeOperationId && op.id === excludeOperationId) return;
          
          // Only count enabled operations
          if (op.enabled && op.targetIds.length > 0) {
            if (op.targetType === 'chains') {
              op.targetIds.forEach(id => assignedChains.add(id));
            } else if (op.targetType === 'parts') {
              op.targetIds.forEach(id => assignedParts.add(id));
            }
          }
        });
      });
      
      unsubscribe();
      return { chains: assignedChains, parts: assignedParts };
    }
  };
}

function calculateChainOffset(
  chain: Chain,
  kerfCompensation: OffsetDirection,
  toolId: string | null,
  operationId: string,
  chainId: string
): ChainOffsetResult | null {
  if (!kerfCompensation || kerfCompensation === 'none' || !toolId) {
    return null;
  }

  // Get tool to determine kerf width
  const tools = get(toolStore);
  const tool = tools.find(t => t.id === toolId);
  if (!tool) {
    console.warn('Tool not found for kerf compensation');
    return null;
  }
  if (!tool.kerfWidth || tool.kerfWidth <= 0) {
    console.warn(`Tool "${tool.toolName}" has no kerf width set`);
    return null;
  }

  // Calculate offset distance (kerf/2)
  const offsetDistance: number = tool.kerfWidth / 2;
  
  try {
    // Call offset calculation
    // For inset, use negative distance; for outset, use positive
    const direction: number = kerfCompensation === 'inset' ? -1 : 1;
    const offsetResult = offsetChain(chain, offsetDistance * direction, {
      tolerance: 0.1,
      maxExtension: 50,
      snapThreshold: 0.5
    });
    
    if (!offsetResult.success) {
      console.warn('Offset calculation failed', offsetResult.errors);
      return null;
    }

    // Clear any existing offset warnings for this operation/chain combination
    offsetWarningsStore.clearWarningsForChain(chainId);
    
    // Add any warnings from the offset calculation
    if (offsetResult.warnings && offsetResult.warnings.length > 0) {
      offsetWarningsStore.addWarningsFromChainOffset(operationId, chainId, offsetResult.warnings);
    }

    // Use the appropriate offset chain based on direction
    let selectedChain: Shape[];
    let selectedGapFills: GapFillingResult[] | undefined;
    
    if (kerfCompensation === 'inset') {
      selectedChain = offsetResult.innerChain?.shapes || [];
      selectedGapFills = offsetResult.innerChain?.gapFills;
    } else {
      selectedChain = offsetResult.outerChain?.shapes || [];
      selectedGapFills = offsetResult.outerChain?.gapFills;
    }
    
    if (!selectedChain || selectedChain.length === 0) {
      console.warn('No appropriate offset chain found for direction:', kerfCompensation);
      return null;
    }


    // offsetChain already returns polylines correctly for single polyline inputs
    // No additional wrapping needed
    const finalOffsetShapes: Shape[] = selectedChain;

    return {
      offsetShapes: finalOffsetShapes,
      originalShapes: chain.shapes,
      kerfWidth: tool.kerfWidth,
      gapFills: selectedGapFills
    };
  } catch (error) {
    console.error('Error calculating offset:', error);
    return null;
  }
}

// Function to generate paths from an operation
function generatePathsForOperation(operation: Operation) {
  // Remove existing paths for this operation
  pathStore.deletePathsByOperation(operation.id);
  
  // If operation is disabled or has no targets, don't generate paths
  if (!operation.enabled || operation.targetIds.length === 0) {
    return;
  }
  
  // Generate paths for each target
  operation.targetIds.forEach((targetId, index) => {
    if (operation.targetType === 'chains') {
      // Use the operation's preferred cut direction
      // For open paths, detect if they can support a direction, otherwise use 'none'
      const chainsState: { chains: Chain[] } = get(chainStore);
      const chain: Chain | undefined = chainsState.chains.find(c => c.id === targetId);
      const detectedDirection: CutDirection = chain ? detectCutDirection(chain, 0.1) : CutDirection.NONE;
      const cutDirection: CutDirection = detectedDirection === CutDirection.NONE ? CutDirection.NONE : operation.cutDirection;
      
      // Convert KerfCompensation to OffsetDirection for chains
      let kerfCompensation: OffsetDirection = 'none';
      if (operation.kerfCompensation) {
        switch (operation.kerfCompensation) {
          case KerfCompensation.INNER:
            kerfCompensation = 'inset';
            break;
          case KerfCompensation.OUTER:
            kerfCompensation = 'outset';
            break;
          case KerfCompensation.PART:
            // For standalone chains, part mode doesn't make sense, treat as none
            kerfCompensation = 'none';
            break;
          case KerfCompensation.NONE:
          default:
            kerfCompensation = 'none';
            break;
        }
      }
      
      // Calculate offset if kerf compensation is enabled
      let calculatedOffset: OffsetCalculation | undefined = undefined;
      if (kerfCompensation !== 'none' && chain && operation.toolId) {
        const offsetResult = calculateChainOffset(chain, kerfCompensation, operation.toolId, operation.id, targetId);
        if (offsetResult) {
          calculatedOffset = {
            offsetShapes: offsetResult.offsetShapes,
            originalShapes: offsetResult.originalShapes,
            direction: kerfCompensation,
            kerfWidth: offsetResult.kerfWidth,
            generatedAt: new Date().toISOString(),
            version: '1.0.0',
            gapFills: offsetResult.gapFills
          };
        }
      }
      
      // Create one path per chain
      pathStore.addPath({
        name: `${operation.name} - Chain ${targetId.split('-')[1]}`,
        operationId: operation.id,
        chainId: targetId,
        toolId: operation.toolId,
        enabled: true,
        order: index + 1,
        cutDirection: cutDirection,
        leadInType: operation.leadInType,
        leadInLength: operation.leadInLength,
        leadInFlipSide: operation.leadInFlipSide,
        leadInAngle: operation.leadInAngle,
        leadOutType: operation.leadOutType,
        leadOutLength: operation.leadOutLength,
        leadOutFlipSide: operation.leadOutFlipSide,
        leadOutAngle: operation.leadOutAngle,
        kerfCompensation: kerfCompensation,
        calculatedOffset: calculatedOffset
      });
    } else if (operation.targetType === 'parts') {
      // For parts, create paths for all chains that make up the part
      const partsState: { parts: DetectedPart[] } = get(partStore);
      const part: DetectedPart | undefined = partsState.parts.find(p => p.id === targetId);
      
      if (part) {
        // Get the chains state for cut direction detection
        const chainsState: { chains: Chain[] } = get(chainStore);
        
        // Create a path for the shell chain using operation's preferred direction
        const shellChain: Chain | undefined = chainsState.chains.find(c => c.id === part.shell.chain.id);
        const shellDetectedDirection: CutDirection = shellChain ? detectCutDirection(shellChain, 0.1) : CutDirection.NONE;
        const shellCutDirection: CutDirection = shellDetectedDirection === CutDirection.NONE ? CutDirection.NONE : operation.cutDirection;
        
        // Convert KerfCompensation to OffsetDirection for shell
        let shellKerfCompensation: OffsetDirection = 'none';
        if (operation.kerfCompensation) {
          switch (operation.kerfCompensation) {
            case KerfCompensation.INNER:
              shellKerfCompensation = 'inset';
              break;
            case KerfCompensation.OUTER:
              shellKerfCompensation = 'outset';
              break;
            case KerfCompensation.PART:
              // For shells (outer boundaries) in part mode, use outset
              shellKerfCompensation = 'outset';
              break;
            case KerfCompensation.NONE:
            default:
              shellKerfCompensation = 'none';
              break;
          }
        }
        
        // Calculate offset for shell if kerf compensation is enabled
        let shellCalculatedOffset: OffsetCalculation | undefined = undefined;
        if (shellKerfCompensation !== 'none' && shellChain && operation.toolId) {
          const offsetResult = calculateChainOffset(shellChain, shellKerfCompensation, operation.toolId, operation.id, part.shell.chain.id);
          if (offsetResult) {
            shellCalculatedOffset = {
              offsetShapes: offsetResult.offsetShapes,
              originalShapes: offsetResult.originalShapes,
              direction: shellKerfCompensation,
              kerfWidth: offsetResult.kerfWidth,
              generatedAt: new Date().toISOString(),
              version: '1.0.0',
              gapFills: offsetResult.gapFills
            };
          }
        }
        
        pathStore.addPath({
          name: `${operation.name} - Part ${targetId.split('-')[1]} (Shell)`,
          operationId: operation.id,
          chainId: part.shell.chain.id,
          toolId: operation.toolId,
          enabled: true,
          order: index + 1,
          cutDirection: shellCutDirection,
          leadInType: operation.leadInType,
          leadInLength: operation.leadInLength,
          leadInFlipSide: operation.leadInFlipSide,
          leadInAngle: operation.leadInAngle,
          leadOutType: operation.leadOutType,
          leadOutLength: operation.leadOutLength,
          leadOutFlipSide: operation.leadOutFlipSide,
          leadOutAngle: operation.leadOutAngle,
          kerfCompensation: shellKerfCompensation,
          calculatedOffset: shellCalculatedOffset
        });
        
        // Create paths for all hole chains (including nested holes)
        let pathOrder: number = index + 1;
        
        function processHoles(holes: PartHole[], prefix: string = '') {
          holes.forEach((hole, holeIndex) => {
            // Use operation's preferred cut direction for the hole chain
            const holeChain: Chain | undefined = chainsState.chains.find(c => c.id === hole.chain.id);
            const holeDetectedDirection: CutDirection = holeChain ? detectCutDirection(holeChain, 0.1) : CutDirection.NONE;
            const holeCutDirection: CutDirection = holeDetectedDirection === CutDirection.NONE ? CutDirection.NONE : operation.cutDirection;
            
            // Convert KerfCompensation to OffsetDirection for hole
            let holeKerfCompensation: OffsetDirection = 'none';
            if (operation.kerfCompensation) {
              switch (operation.kerfCompensation) {
                case KerfCompensation.INNER:
                  holeKerfCompensation = 'inset';
                  break;
                case KerfCompensation.OUTER:
                  holeKerfCompensation = 'outset';
                  break;
                case KerfCompensation.PART:
                  // For holes (inner boundaries) in part mode, use inset
                  holeKerfCompensation = 'inset';
                  break;
                case KerfCompensation.NONE:
                default:
                  holeKerfCompensation = 'none';
                  break;
              }
            }
            
            // Calculate offset for hole if kerf compensation is enabled
            let holeCalculatedOffset: OffsetCalculation | undefined = undefined;
            if (holeKerfCompensation !== 'none' && holeChain && operation.toolId) {
              const offsetResult = calculateChainOffset(holeChain, holeKerfCompensation, operation.toolId, operation.id, hole.chain.id);
              if (offsetResult) {
                holeCalculatedOffset = {
                  offsetShapes: offsetResult.offsetShapes,
                  originalShapes: offsetResult.originalShapes,
                  direction: holeKerfCompensation,
                  kerfWidth: offsetResult.kerfWidth,
                  generatedAt: new Date().toISOString(),
                  version: '1.0.0',
                  gapFills: offsetResult.gapFills
                };
              }
            }
            
            pathStore.addPath({
              name: `${operation.name} - Part ${targetId.split('-')[1]} ${prefix}(Hole ${holeIndex + 1})`,
              operationId: operation.id,
              chainId: hole.chain.id,
              toolId: operation.toolId,
              enabled: true,
              order: pathOrder++,
              cutDirection: holeCutDirection,
              leadInType: operation.leadInType,
              leadInLength: operation.leadInLength,
              leadInFlipSide: operation.leadInFlipSide,
              leadInAngle: operation.leadInAngle,
              leadOutType: operation.leadOutType,
              leadOutLength: operation.leadOutLength,
              leadOutFlipSide: operation.leadOutFlipSide,
              leadOutAngle: operation.leadOutAngle,
              kerfCompensation: holeKerfCompensation,
              calculatedOffset: holeCalculatedOffset
            });
            
            // Process nested holes if any
            if (hole.holes && hole.holes.length > 0) {
              processHoles(hole.holes, `${prefix}(Hole ${holeIndex + 1}) `);
            }
          });
        }
        
        processHoles(part.holes);
      }
    }
  });
  
  // Check if any paths exist and mark program stage as complete
  setTimeout(() => {
    const pathsState: { paths: Path[] } = get(pathStore);
    if (pathsState.paths.length > 0) {
      workflowStore.completeStage('program');
    }
  }, 100); // Small delay to ensure path store is updated
  
  // Calculate and store lead geometry for all paths in this operation
  // Run immediately to prevent visual jumping when offset geometry exists
  calculateAndStoreOperationLeads(operation);
}

export const operationsStore: ReturnType<typeof createOperationsStore> = createOperationsStore();