export interface Tool {
    id: string;
    toolNumber: number;
    toolName: string;
    feedRate: number; // units/min
    rapidRate: number; // units/min for rapid movements
    pierceHeight: number; // units
    cutHeight: number; // units
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

export interface ToolStore {
    subscribe: (run: (value: Tool[]) => void) => () => void;
    addTool: (tool: Omit<Tool, 'id'>) => void;
    updateTool: (id: string, updates: Partial<Tool>) => void;
    deleteTool: (id: string) => void;
    reorderTools: (newOrder: Tool[]) => void;
    reset: () => void;
}
