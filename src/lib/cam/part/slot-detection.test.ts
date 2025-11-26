import { GeometryType } from '$lib/geometry/enums';
import { describe, expect, it } from 'vitest';
import { generateId } from '$lib/domain/id';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { detectParts } from '$lib/cam/part/part-detection';
import { Shape } from '$lib/cam/shape/classes';
import { Chain } from '$lib/cam/chain/classes';

describe('Slot Detection in Parts', () => {
    // Helper function to create test shapes
    function createLine(
        startX: number,
        startY: number,
        endX: number,
        endY: number
    ) {
        return new Shape({
            id: generateId(),
            type: GeometryType.LINE,
            geometry: {
                start: { x: startX, y: startY },
                end: { x: endX, y: endY },
            },
        });
    }

    // Helper function to create a rectangular chain (closed)
    function createRectangleChain(
        x: number,
        y: number,
        width: number,
        height: number
    ): ChainData {
        return {
            id: generateId(),
            shapes: [
                createLine(x, y, x + width, y), // Bottom edge
                createLine(x + width, y, x + width, y + height), // Right edge
                createLine(x + width, y + height, x, y + height), // Top edge
                createLine(x, y + height, x, y), // Left edge - closes the loop
            ],
        };
    }

    // Helper function to create an open chain (slot)
    function createOpenChain(
        startX: number,
        startY: number,
        endX: number,
        endY: number
    ): ChainData {
        return {
            id: generateId(),
            shapes: [createLine(startX, startY, endX, endY)],
        };
    }

    describe('Basic Slot Detection', () => {
        it('should detect a single slot in a part', async () => {
            const chains = [
                createRectangleChain(0, 0, 20, 20), // Part shell
                createOpenChain(5, 5, 15, 5), // Horizontal slot inside part
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(1);
            expect(result.parts[0].slots).toHaveLength(1);
            expect(result.parts[0].slots[0].chain.id).toBe(chains[1].id);
            expect(result.parts[0].voids).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
        });

        it('should detect multiple slots in a single part', async () => {
            const chains = [
                createRectangleChain(0, 0, 30, 30), // Part shell
                createOpenChain(5, 10, 25, 10), // Horizontal slot 1
                createOpenChain(10, 5, 10, 25), // Vertical slot 2
                createOpenChain(15, 15, 20, 20), // Diagonal slot 3
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(1);
            expect(result.parts[0].slots).toHaveLength(3);
            expect(result.parts[0].voids).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
        });

        it('should not treat open chains outside parts as slots', async () => {
            const chains = [
                createRectangleChain(0, 0, 20, 20), // Part shell
                createOpenChain(25, 5, 35, 5), // Open chain outside part
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(1);
            expect(result.parts[0].slots).toHaveLength(0);
            // Open chain completely outside doesn't cross boundary, so no warning
            expect(result.warnings).toHaveLength(0);
        });

        it('should not treat boundary-crossing chains as slots', async () => {
            const chains = [
                createRectangleChain(0, 0, 20, 20), // Part shell
                createOpenChain(5, 10, 25, 10), // Crosses boundary (starts inside, ends outside)
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(1);
            expect(result.parts[0].slots).toHaveLength(0);
            // Should have a warning for boundary crossing
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings[0].type).toBe('overlapping_boundary');
        });
    });

    describe('Slots Across Multiple Parts', () => {
        it('should correctly assign slots to their containing parts', async () => {
            const chains = [
                createRectangleChain(0, 0, 20, 20), // Part 1
                createRectangleChain(30, 0, 20, 20), // Part 2
                createOpenChain(5, 10, 15, 10), // Slot in part 1
                createOpenChain(35, 10, 45, 10), // Slot in part 2
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(2);

            // Each part should have exactly one slot
            expect(result.parts[0].slots).toHaveLength(1);
            expect(result.parts[1].slots).toHaveLength(1);

            // Verify slots are assigned correctly
            // Note: We can't guarantee which part is [0] vs [1] due to sorting,
            // so we check that each slot is in one of the parts
            const allSlotChainIds = [
                ...result.parts[0].slots.map((s) => s.chain.id),
                ...result.parts[1].slots.map((s) => s.chain.id),
            ];
            expect(allSlotChainIds).toContain(chains[2].id);
            expect(allSlotChainIds).toContain(chains[3].id);
            expect(result.warnings).toHaveLength(0);
        });
    });

    describe('Parts with Holes and Slots', () => {
        it('should detect both holes and slots in a part', async () => {
            const chains = [
                createRectangleChain(0, 0, 40, 40), // Part shell
                createRectangleChain(5, 5, 10, 10), // Hole 1
                createRectangleChain(25, 25, 10, 10), // Hole 2
                createOpenChain(20, 5, 20, 35), // Vertical slot
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(1);
            expect(result.parts[0].voids).toHaveLength(2);
            expect(result.parts[0].slots).toHaveLength(1);
            expect(result.parts[0].slots[0].chain.id).toBe(chains[3].id);
            expect(result.warnings).toHaveLength(0);
        });

        it('should handle complex geometry with multiple features', async () => {
            const chains = [
                createRectangleChain(0, 0, 50, 50), // Large part shell
                createRectangleChain(10, 10, 10, 10), // Hole
                createOpenChain(25, 5, 45, 5), // Horizontal slot near top
                createOpenChain(5, 25, 5, 45), // Vertical slot on left
                createOpenChain(30, 30, 40, 40), // Diagonal slot
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(1);
            expect(result.parts[0].voids).toHaveLength(1);
            expect(result.parts[0].slots).toHaveLength(3);
            expect(result.warnings).toHaveLength(0);
        });
    });

    describe('Edge Cases', () => {
        it('should handle part with no slots', async () => {
            const chains = [createRectangleChain(0, 0, 20, 20)];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(1);
            expect(result.parts[0].slots).toHaveLength(0);
            expect(result.parts[0].slots).toEqual([]);
            expect(result.warnings).toHaveLength(0);
        });

        it('should handle empty chains array', async () => {
            const result = await detectParts([]);
            expect(result.parts).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
        });

        it('should handle slots with endpoints very close to part boundary', async () => {
            const chains = [
                createRectangleChain(0, 0, 20, 20), // Part shell
                createOpenChain(1, 10, 19, 10), // Slot very close to edges
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(1);
            expect(result.parts[0].slots).toHaveLength(1);
            expect(result.warnings).toHaveLength(0);
        });

        it('should handle slot with same start and end Y coordinate (horizontal)', async () => {
            const chains = [
                createRectangleChain(0, 0, 30, 30),
                createOpenChain(5, 15, 25, 15), // Perfectly horizontal slot
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(1);
            expect(result.parts[0].slots).toHaveLength(1);
            expect(result.warnings).toHaveLength(0);
        });

        it('should handle slot with same start and end X coordinate (vertical)', async () => {
            const chains = [
                createRectangleChain(0, 0, 30, 30),
                createOpenChain(15, 5, 15, 25), // Perfectly vertical slot
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(1);
            expect(result.parts[0].slots).toHaveLength(1);
            expect(result.warnings).toHaveLength(0);
        });
    });

    describe('Slot Detection with Nested Parts', () => {
        it('should assign slots to the correct part in nested geometry', async () => {
            const chains = [
                createRectangleChain(0, 0, 50, 50), // Outer part
                createRectangleChain(10, 10, 30, 30), // Inner hole
                createRectangleChain(15, 15, 20, 20), // Nested part inside hole
                createOpenChain(20, 5, 30, 5), // Slot in outer part
                createOpenChain(20, 20, 30, 20), // Slot in nested part
            ];

            const result = await detectParts(chains.map((c) => new Chain(c)));
            expect(result.parts).toHaveLength(2);

            // Total slots across all parts should be 2
            const totalSlots =
                result.parts[0].slots.length + result.parts[1].slots.length;
            expect(totalSlots).toBe(2);
            expect(result.warnings).toHaveLength(0);
        });
    });
});
