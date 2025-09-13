import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { offsetWarningsStore } from './store';
import type { OffsetWarning } from './interfaces';

describe('offsetWarningsStore', () => {
    beforeEach(() => {
        offsetWarningsStore.clearAllWarnings();
    });

    describe('addWarningsFromChainOffset', () => {
        it('should add multiple warnings from chain offset', () => {
            const operationId = 'operation-1';
            const chainId = 'chain-1';
            const warnings = ['Warning 1', 'Warning 2', 'Warning 3'];

            offsetWarningsStore.addWarningsFromChainOffset(
                operationId,
                chainId,
                warnings
            );

            const state = get(offsetWarningsStore);
            expect(state.warnings).toHaveLength(3);

            state.warnings.forEach((warning: OffsetWarning, index: number) => {
                expect(warning.operationId).toBe(operationId);
                expect(warning.chainId).toBe(chainId);
                expect(warning.message).toBe(warnings[index]);
                expect(warning.type).toBe('offset');
                expect(warning.id).toBeDefined();
                expect(typeof warning.id).toBe('string');
            });
        });

        it('should add no warnings when empty array is provided', () => {
            const operationId = 'operation-1';
            const chainId = 'chain-1';
            const warnings: string[] = [];

            offsetWarningsStore.addWarningsFromChainOffset(
                operationId,
                chainId,
                warnings
            );

            const state = get(offsetWarningsStore);
            expect(state.warnings).toHaveLength(0);
        });

        it('should add single warning when single warning is provided', () => {
            const operationId = 'operation-1';
            const chainId = 'chain-1';
            const warnings = ['Single warning'];

            offsetWarningsStore.addWarningsFromChainOffset(
                operationId,
                chainId,
                warnings
            );

            const state = get(offsetWarningsStore);
            expect(state.warnings).toHaveLength(1);
            expect(state.warnings[0].message).toBe('Single warning');
            expect(state.warnings[0].type).toBe('offset');
        });

        it('should append warnings to existing warnings', () => {
            const operationId1 = 'operation-1';
            const chainId1 = 'chain-1';
            const warnings1 = ['Warning 1'];

            const operationId2 = 'operation-2';
            const chainId2 = 'chain-2';
            const warnings2 = ['Warning 2', 'Warning 3'];

            offsetWarningsStore.addWarningsFromChainOffset(
                operationId1,
                chainId1,
                warnings1
            );
            offsetWarningsStore.addWarningsFromChainOffset(
                operationId2,
                chainId2,
                warnings2
            );

            const state = get(offsetWarningsStore);
            expect(state.warnings).toHaveLength(3);

            expect(state.warnings[0].operationId).toBe(operationId1);
            expect(state.warnings[0].chainId).toBe(chainId1);
            expect(state.warnings[0].message).toBe('Warning 1');

            expect(state.warnings[1].operationId).toBe(operationId2);
            expect(state.warnings[1].chainId).toBe(chainId2);
            expect(state.warnings[1].message).toBe('Warning 2');

            expect(state.warnings[2].operationId).toBe(operationId2);
            expect(state.warnings[2].chainId).toBe(chainId2);
            expect(state.warnings[2].message).toBe('Warning 3');
        });

        it('should handle multiple calls with same operation and chain IDs', () => {
            const operationId = 'operation-1';
            const chainId = 'chain-1';
            const warnings1 = ['Warning 1'];
            const warnings2 = ['Warning 2'];

            offsetWarningsStore.addWarningsFromChainOffset(
                operationId,
                chainId,
                warnings1
            );
            offsetWarningsStore.addWarningsFromChainOffset(
                operationId,
                chainId,
                warnings2
            );

            const state = get(offsetWarningsStore);
            expect(state.warnings).toHaveLength(2);
            expect(state.warnings[0].message).toBe('Warning 1');
            expect(state.warnings[1].message).toBe('Warning 2');
        });
    });

    describe('integration with base store functionality', () => {
        it('should work with clearWarningsForOperation', () => {
            const operationId1 = 'operation-1';
            const operationId2 = 'operation-2';
            const chainId = 'chain-1';

            offsetWarningsStore.addWarningsFromChainOffset(
                operationId1,
                chainId,
                ['Warning 1']
            );
            offsetWarningsStore.addWarningsFromChainOffset(
                operationId2,
                chainId,
                ['Warning 2']
            );

            expect(get(offsetWarningsStore).warnings).toHaveLength(2);

            offsetWarningsStore.clearWarningsForOperation(operationId1);

            const state = get(offsetWarningsStore);
            expect(state.warnings).toHaveLength(1);
            expect(state.warnings[0].operationId).toBe(operationId2);
        });

        it('should work with clearWarningsForChain', () => {
            const operationId = 'operation-1';
            const chainId1 = 'chain-1';
            const chainId2 = 'chain-2';

            offsetWarningsStore.addWarningsFromChainOffset(
                operationId,
                chainId1,
                ['Warning 1']
            );
            offsetWarningsStore.addWarningsFromChainOffset(
                operationId,
                chainId2,
                ['Warning 2']
            );

            expect(get(offsetWarningsStore).warnings).toHaveLength(2);

            offsetWarningsStore.clearWarningsForChain(chainId1);

            const state = get(offsetWarningsStore);
            expect(state.warnings).toHaveLength(1);
            expect(state.warnings[0].chainId).toBe(chainId2);
        });

        it('should work with getWarningsForOperation', () => {
            const operationId1 = 'operation-1';
            const operationId2 = 'operation-2';
            const chainId = 'chain-1';

            offsetWarningsStore.addWarningsFromChainOffset(
                operationId1,
                chainId,
                ['Warning 1', 'Warning 2']
            );
            offsetWarningsStore.addWarningsFromChainOffset(
                operationId2,
                chainId,
                ['Warning 3']
            );

            const operation1Warnings =
                offsetWarningsStore.getWarningsForOperation(operationId1);
            const operation2Warnings =
                offsetWarningsStore.getWarningsForOperation(operationId2);

            expect(operation1Warnings).toHaveLength(2);
            expect(operation2Warnings).toHaveLength(1);
            expect(operation1Warnings[0].message).toBe('Warning 1');
            expect(operation1Warnings[1].message).toBe('Warning 2');
            expect(operation2Warnings[0].message).toBe('Warning 3');
        });
    });
});
