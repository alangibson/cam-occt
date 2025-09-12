export interface Warning {
    id: string;
    operationId: string;
    chainId: string;
    message: string;
    type: string;
}

export interface WarningState<T extends Warning> {
    warnings: T[];
}

export interface WarningStore<T extends Warning> {
    subscribe: (run: (value: WarningState<T>) => void) => () => void;
    addWarning: (warning: Omit<T, 'id'>) => void;
    clearWarningsForOperation: (operationId: string) => void;
    clearWarningsForChain: (chainId: string) => void;
    clearAllWarnings: () => void;
    getWarningsForOperation: (operationId: string) => T[];
}
