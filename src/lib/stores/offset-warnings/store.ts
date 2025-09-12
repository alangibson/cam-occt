import { createWarningStore } from '../warnings/store';
import type { OffsetWarning, OffsetWarningsStore } from './interfaces';

function createOffsetWarningsStore(): OffsetWarningsStore {
    const baseStore: ReturnType<typeof createWarningStore<OffsetWarning>> =
        createWarningStore<OffsetWarning>();

    return {
        ...baseStore,

        addWarningsFromChainOffset: (
            operationId: string,
            chainId: string,
            warnings: string[]
        ) => {
            warnings.forEach((message) => {
                baseStore.addWarning({
                    operationId,
                    chainId,
                    message,
                    type: 'offset',
                });
            });
        },
    };
}

export const offsetWarningsStore: ReturnType<typeof createOffsetWarningsStore> =
    createOffsetWarningsStore();
