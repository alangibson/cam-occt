import type { Warning, WarningStore } from '$lib/stores/warnings/interfaces';

export interface OffsetWarning extends Warning {
    type: 'offset' | 'trim' | 'gap' | 'intersection' | 'geometry';
}

export interface OffsetWarningsStore extends WarningStore<OffsetWarning> {
    addWarningsFromChainOffset: (
        operationId: string,
        chainId: string,
        warnings: string[]
    ) => void;
}
