import { writable } from 'svelte/store';

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

export function createWarningStore<T extends Warning>(): WarningStore<T> {
    const initialState: WarningState<T> = {
        warnings: [],
    };

    const { subscribe, set, update } = writable<WarningState<T>>(initialState);

    return {
        subscribe,

        addWarning: (warning: Omit<T, 'id'>) => {
            update((state) => ({
                ...state,
                warnings: [
                    ...state.warnings,
                    {
                        ...warning,
                        id: crypto.randomUUID(),
                    } as T,
                ],
            }));
        },

        clearWarningsForOperation: (operationId: string) => {
            update((state) => ({
                ...state,
                warnings: state.warnings.filter(
                    (w) => w.operationId !== operationId
                ),
            }));
        },

        clearWarningsForChain: (chainId: string) => {
            update((state) => ({
                ...state,
                warnings: state.warnings.filter((w) => w.chainId !== chainId),
            }));
        },

        clearAllWarnings: () => {
            set(initialState);
        },

        getWarningsForOperation: (operationId: string): T[] => {
            let warnings: T[] = [];
            const unsubscribe = subscribe((state) => {
                warnings = state.warnings.filter(
                    (w) => w.operationId === operationId
                );
            });
            unsubscribe();
            return warnings;
        },
    };
}

export function clearWarnings<T extends Warning>(store: WarningStore<T>): void {
    store.clearAllWarnings();
}

export function getWarningsByOperationId<T extends Warning>(
    store: WarningStore<T>,
    operationId: string
): T[] {
    return store.getWarningsForOperation(operationId);
}

export function getWarningsByChainId<T extends Warning>(
    store: WarningStore<T>,
    chainId: string
): T[] {
    let warnings: T[] = [];
    const unsubscribe = store.subscribe((state) => {
        warnings = state.warnings.filter((w) => w.chainId === chainId);
    });
    unsubscribe();
    return warnings;
}
