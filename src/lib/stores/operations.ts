import { writable } from 'svelte/store';
import { pathStore } from './paths';
import { partStore } from './parts';
import { workflowStore } from './workflow';
import { chainStore } from './chains';
import { get } from 'svelte/store';
import { detectCutDirection } from '../algorithms/cut-direction';
import { leadWarningsStore } from './lead-warnings';

export interface Operation {
  id: string;
  name: string;
  toolId: string | null; // Reference to tool from tool store
  targetType: 'parts' | 'chains';
  targetIds: string[]; // IDs of parts or chains this operation applies to
  enabled: boolean;
  order: number; // Execution order
  cutDirection: 'clockwise' | 'counterclockwise'; // Preferred cut direction
  leadInType: 'arc' | 'line' | 'none'; // Lead-in type
  leadInLength: number; // Lead-in length (units)
  leadInFlipSide: boolean; // Flip which side of the chain the lead-in is on
  leadInAngle: number; // Manual rotation angle for lead-in (degrees, 0-360)
  leadOutType: 'arc' | 'line' | 'none'; // Lead-out type
  leadOutLength: number; // Lead-out length (units)
  leadOutFlipSide: boolean; // Flip which side of the chain the lead-out is on
  leadOutAngle: number; // Manual rotation angle for lead-out (degrees, 0-360)
}

function createOperationsStore() {
  const { subscribe, set, update } = writable<Operation[]>([]);

  return {
    subscribe,
    
    addOperation: (operation: Omit<Operation, 'id'>) => {
      update(operations => {
        const newOperation = {
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
        const newOperations = operations.map(op => 
          op.id === id ? { ...op, ...updates } : op
        );
        
        // Always regenerate paths when operation changes
        const operation = newOperations.find(op => op.id === id);
        if (operation) {
          // Clear existing lead warnings for this operation before regenerating
          leadWarningsStore.clearWarningsForOperation(id);
          setTimeout(() => generatePathsForOperation(operation), 0);
        }
        
        return newOperations;
      });
    },
    
    deleteOperation: (id: string) => {
      // Remove all paths created by this operation
      pathStore.deletePathsByOperation(id);
      // Clear any lead warnings for this operation
      leadWarningsStore.clearWarningsForOperation(id);
      update(operations => operations.filter(op => op.id !== id));
    },
    
    reorderOperations: (newOrder: Operation[]) => {
      set(newOrder);
    },
    
    duplicateOperation: (id: string) => {
      update(operations => {
        const operation = operations.find(op => op.id === id);
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
        const operation = operations.find(op => op.id === operationId);
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
        const enabledOperations = operations
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
      let assignedChains = new Set<string>();
      let assignedParts = new Set<string>();
      
      const unsubscribe = subscribe(operations => {
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
      const chainsState = get(chainStore);
      const chain = chainsState.chains.find(c => c.id === targetId);
      const detectedDirection = chain ? detectCutDirection(chain, 0.1) : 'none';
      const cutDirection = detectedDirection === 'none' ? 'none' : operation.cutDirection;
      
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
        leadOutAngle: operation.leadOutAngle
      });
    } else if (operation.targetType === 'parts') {
      // For parts, create paths for all chains that make up the part
      const partsState = get(partStore);
      const part = partsState.parts.find(p => p.id === targetId);
      
      if (part) {
        // Get the chains state for cut direction detection
        const chainsState = get(chainStore);
        
        // Create a path for the shell chain using operation's preferred direction
        const shellChain = chainsState.chains.find(c => c.id === part.shell.chain.id);
        const shellDetectedDirection = shellChain ? detectCutDirection(shellChain, 0.1) : 'none';
        const shellCutDirection = shellDetectedDirection === 'none' ? 'none' : operation.cutDirection;
        
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
          leadOutAngle: operation.leadOutAngle
        });
        
        // Create paths for all hole chains (including nested holes)
        let pathOrder = index + 1;
        
        function processHoles(holes: any[], prefix: string = '') {
          holes.forEach((hole, holeIndex) => {
            // Use operation's preferred cut direction for the hole chain
            const holeChain = chainsState.chains.find(c => c.id === hole.chain.id);
            const holeDetectedDirection = holeChain ? detectCutDirection(holeChain, 0.1) : 'none';
            const holeCutDirection = holeDetectedDirection === 'none' ? 'none' : operation.cutDirection;
            
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
              leadOutAngle: operation.leadOutAngle
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
    const pathsState = get(pathStore);
    if (pathsState.paths.length > 0) {
      workflowStore.completeStage('program');
    }
  }, 100); // Small delay to ensure path store is updated
}

export const operationsStore = createOperationsStore();