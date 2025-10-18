import type { Tool } from '$lib/cam/tool/interfaces';

export interface ToolStore {
    subscribe: (run: (value: Tool[]) => void) => () => void;
    addTool: (tool: Omit<Tool, 'id'>) => void;
    updateTool: (id: string, updates: Partial<Tool>) => void;
    deleteTool: (id: string) => void;
    reorderTools: (newOrder: Tool[]) => void;
    reset: () => void;
}
