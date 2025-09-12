import { writable } from 'svelte/store';
import type { Tool, ToolStore } from './interfaces';

export type { Tool } from './interfaces';

function createToolStore(): ToolStore {
    const { subscribe, set, update } = writable<Tool[]>([]);

    return {
        subscribe,

        addTool: (tool: Omit<Tool, 'id'>) => {
            update((tools) => [
                ...tools,
                {
                    ...tool,
                    id: crypto.randomUUID(),
                },
            ]);
        },

        updateTool: (id: string, updates: Partial<Tool>) => {
            update((tools) =>
                tools.map((tool) =>
                    tool.id === id ? { ...tool, ...updates } : tool
                )
            );
        },

        deleteTool: (id: string) => {
            update((tools) => tools.filter((tool) => tool.id !== id));
        },

        reorderTools: (newOrder: Tool[]) => {
            set(newOrder);
        },

        reset: () => set([]),
    };
}

export const toolStore: ReturnType<typeof createToolStore> = createToolStore();
