import { writable } from 'svelte/store';
import type { Warning, WarningState, WarningStore } from './interfaces';

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
