import { writable } from 'svelte/store';

export interface Operation {
  id: string;
  name: string;
  toolId: string | null; // Reference to tool from tool store
  targetType: 'parts' | 'paths';
  targetIds: string[]; // IDs of parts or paths this operation applies to
  enabled: boolean;
  order: number; // Execution order
}

function createOperationsStore() {
  const { subscribe, set, update } = writable<Operation[]>([]);

  return {
    subscribe,
    
    addOperation: (operation: Omit<Operation, 'id'>) => {
      update(operations => [
        ...operations,
        {
          ...operation,
          id: crypto.randomUUID()
        }
      ]);
    },
    
    updateOperation: (id: string, updates: Partial<Operation>) => {
      update(operations => 
        operations.map(op => 
          op.id === id ? { ...op, ...updates } : op
        )
      );
    },
    
    deleteOperation: (id: string) => {
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
        
        return [...operations, newOperation];
      });
    },
    
    reset: () => set([])
  };
}

export const operationsStore = createOperationsStore();