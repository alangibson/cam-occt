import { createWarningStore, type Warning } from './warning-store-base';

export interface OffsetWarning extends Warning {
    type: 'offset' | 'trim' | 'gap' | 'intersection' | 'geometry';
}

function createOffsetWarningsStore() {
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
