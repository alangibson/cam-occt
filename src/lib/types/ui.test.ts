import { describe, it, expect } from 'vitest';
import {
    InteractionMode,
    MessageSeverity,
    isInteractionMode,
    isMessageSeverity,
    getInteractionModeLabel,
    getMessageSeverityClass,
} from './ui';

describe('UI Types', () => {
    describe('InteractionMode enum', () => {
        it('should have correct values', () => {
            expect(InteractionMode.SHAPES).toBe('shapes');
            expect(InteractionMode.CHAINS).toBe('chains');
            expect(InteractionMode.PATHS).toBe('paths');
        });
    });

    describe('MessageSeverity enum', () => {
        it('should have correct values', () => {
            expect(MessageSeverity.INFO).toBe('info');
            expect(MessageSeverity.WARNING).toBe('warning');
            expect(MessageSeverity.ERROR).toBe('error');
        });
    });

    describe('isInteractionMode', () => {
        it('should return true for valid InteractionMode values', () => {
            expect(isInteractionMode(InteractionMode.SHAPES)).toBe(true);
            expect(isInteractionMode(InteractionMode.CHAINS)).toBe(true);
            expect(isInteractionMode(InteractionMode.PATHS)).toBe(true);
            expect(isInteractionMode('shapes')).toBe(true);
            expect(isInteractionMode('chains')).toBe(true);
            expect(isInteractionMode('paths')).toBe(true);
        });

        it('should return false for invalid values', () => {
            expect(isInteractionMode('invalid')).toBe(false);
            expect(isInteractionMode(null)).toBe(false);
            expect(isInteractionMode(undefined)).toBe(false);
            expect(isInteractionMode(123)).toBe(false);
            expect(isInteractionMode({})).toBe(false);
            expect(isInteractionMode([])).toBe(false);
            expect(isInteractionMode('')).toBe(false);
        });
    });

    describe('isMessageSeverity', () => {
        it('should return true for valid MessageSeverity values', () => {
            expect(isMessageSeverity(MessageSeverity.INFO)).toBe(true);
            expect(isMessageSeverity(MessageSeverity.WARNING)).toBe(true);
            expect(isMessageSeverity(MessageSeverity.ERROR)).toBe(true);
            expect(isMessageSeverity('info')).toBe(true);
            expect(isMessageSeverity('warning')).toBe(true);
            expect(isMessageSeverity('error')).toBe(true);
        });

        it('should return false for invalid values', () => {
            expect(isMessageSeverity('invalid')).toBe(false);
            expect(isMessageSeverity(null)).toBe(false);
            expect(isMessageSeverity(undefined)).toBe(false);
            expect(isMessageSeverity(123)).toBe(false);
            expect(isMessageSeverity({})).toBe(false);
            expect(isMessageSeverity([])).toBe(false);
            expect(isMessageSeverity('')).toBe(false);
        });
    });

    describe('getInteractionModeLabel', () => {
        it('should return correct labels for all interaction modes', () => {
            expect(getInteractionModeLabel(InteractionMode.SHAPES)).toBe(
                'Shapes'
            );
            expect(getInteractionModeLabel(InteractionMode.CHAINS)).toBe(
                'Chains'
            );
            expect(getInteractionModeLabel(InteractionMode.PATHS)).toBe(
                'Paths'
            );
        });

        it('should return the input value for unknown modes (default case)', () => {
            const unknownMode = 'unknown-mode' as InteractionMode;
            expect(getInteractionModeLabel(unknownMode)).toBe('unknown-mode');
        });
    });

    describe('getMessageSeverityClass', () => {
        it('should return correct CSS classes for all severity levels', () => {
            expect(getMessageSeverityClass(MessageSeverity.INFO)).toBe(
                'text-blue-600'
            );
            expect(getMessageSeverityClass(MessageSeverity.WARNING)).toBe(
                'text-yellow-600'
            );
            expect(getMessageSeverityClass(MessageSeverity.ERROR)).toBe(
                'text-red-600'
            );
        });

        it('should return default class for unknown severity (default case)', () => {
            const unknownSeverity = 'unknown-severity' as MessageSeverity;
            expect(getMessageSeverityClass(unknownSeverity)).toBe(
                'text-gray-600'
            );
        });
    });
});
