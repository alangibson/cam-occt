import { writable } from 'svelte/store';

export interface Tool {
    id: string;
    toolNumber: number;
    toolName: string;
    feedRate: number; // units/min
    rapidRate: number; // units/min for rapid movements
    pierceHeight: number; // units
    pierceDelay: number; // seconds
    arcVoltage: number; // volts
    kerfWidth: number; // units
    thcEnable: boolean;
    gasPressure: number; // bar
    pauseAtEnd: number; // seconds
    puddleJumpHeight: number; // units
    puddleJumpDelay: number; // seconds
    plungeRate: number; // units/min
}

function createToolStore(): {
    subscribe: (run: (value: Tool[]) => void) => () => void;
    addTool: (tool: Omit<Tool, 'id'>) => void;
    updateTool: (id: string, updates: Partial<Tool>) => void;
    deleteTool: (id: string) => void;
    reorderTools: (newOrder: Tool[]) => void;
    reset: () => void;
} {
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

// Default tool values for new tools
export const DEFAULT_TOOL_VALUES: Omit<Tool, 'id' | 'toolNumber' | 'toolName'> =
    {
        feedRate: 100,
        rapidRate: 3000,
        pierceHeight: 3.8,
        pierceDelay: 0.5,
        arcVoltage: 120,
        kerfWidth: 1.5,
        thcEnable: true,
        gasPressure: 4.5,
        pauseAtEnd: 0,
        puddleJumpHeight: 50,
        puddleJumpDelay: 0,
        plungeRate: 500,
    };
