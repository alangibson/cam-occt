import type { Warning, WarningStore } from './interfaces';

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
