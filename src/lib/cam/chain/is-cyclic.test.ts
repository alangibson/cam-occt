import { Chain } from '$lib/cam/chain/classes';
import { describe, it, expect } from 'vitest';
import type { ChainData } from './interfaces';
import { GeometryType } from '$lib/geometry/enums';
import type { Point2D } from '$lib/geometry/point/interfaces';

describe('Chain.isCyclic', () => {
    describe('Case 1: Single circle', () => {
        it('should return true for a single circle shape', () => {
            const chain: ChainData = {
                id: 'test-circle',
                name: 'test-circle', shapes: [
                    {
                        id: 'circle-1',
                        type: GeometryType.CIRCLE,
                        geometry: {
                            center: { x: 0, y: 0 },
                            radius: 10,
                        },
                    },
                ],
            };

            const chainObj = new Chain(chain);
            expect(chainObj.isCyclic()).toBe(true);
        });
    });

    describe('Case 2: Multiple arcs forming a circle', () => {
        it('should return true for two arcs forming a complete circle', () => {
            const center: Point2D = { x: 0, y: 0 };
            const radius = 10;

            const chain: ChainData = {
                id: 'test-arcs',
                name: 'test-arcs', shapes: [
                    {
                        id: 'arc-1',
                        type: GeometryType.ARC,
                        geometry: {
                            center,
                            radius,
                            startAngle: 0,
                            endAngle: Math.PI,
                            clockwise: false,
                        },
                    },
                    {
                        id: 'arc-2',
                        type: GeometryType.ARC,
                        geometry: {
                            center,
                            radius,
                            startAngle: Math.PI,
                            endAngle: 2 * Math.PI,
                            clockwise: false,
                        },
                    },
                ],
            };

            const chainObj = new Chain(chain);
            expect(chainObj.isCyclic()).toBe(true);
        });

        it('should return true for four arcs forming a complete circle', () => {
            const center: Point2D = { x: 5, y: 5 };
            const radius = 20;

            const chain: ChainData = {
                id: 'test-arcs-4',
                name: 'test-arcs-4', shapes: [
                    {
                        id: 'arc-1',
                        type: GeometryType.ARC,
                        geometry: {
                            center,
                            radius,
                            startAngle: 0,
                            endAngle: Math.PI / 2,
                            clockwise: false,
                        },
                    },
                    {
                        id: 'arc-2',
                        type: GeometryType.ARC,
                        geometry: {
                            center,
                            radius,
                            startAngle: Math.PI / 2,
                            endAngle: Math.PI,
                            clockwise: false,
                        },
                    },
                    {
                        id: 'arc-3',
                        type: GeometryType.ARC,
                        geometry: {
                            center,
                            radius,
                            startAngle: Math.PI,
                            endAngle: (3 * Math.PI) / 2,
                            clockwise: false,
                        },
                    },
                    {
                        id: 'arc-4',
                        type: GeometryType.ARC,
                        geometry: {
                            center,
                            radius,
                            startAngle: (3 * Math.PI) / 2,
                            endAngle: 2 * Math.PI,
                            clockwise: false,
                        },
                    },
                ],
            };

            const chainObj = new Chain(chain);
            expect(chainObj.isCyclic()).toBe(true);
        });

        it('should return false for arcs with different centers', () => {
            const chain: ChainData = {
                id: 'test-different-centers',
                name: 'test-different-centers', shapes: [
                    {
                        id: 'arc-1',
                        type: GeometryType.ARC,
                        geometry: {
                            center: { x: 0, y: 0 },
                            radius: 10,
                            startAngle: 0,
                            endAngle: Math.PI,
                            clockwise: false,
                        },
                    },
                    {
                        id: 'arc-2',
                        type: GeometryType.ARC,
                        geometry: {
                            center: { x: 1, y: 1 }, // Different center
                            radius: 10,
                            startAngle: Math.PI,
                            endAngle: 2 * Math.PI,
                            clockwise: false,
                        },
                    },
                ],
            };

            const chainObj = new Chain(chain);
            expect(chainObj.isCyclic()).toBe(false);
        });

        it('should return false for arcs with different radii', () => {
            const center: Point2D = { x: 0, y: 0 };

            const chain: ChainData = {
                id: 'test-different-radii',
                name: 'test-different-radii', shapes: [
                    {
                        id: 'arc-1',
                        type: GeometryType.ARC,
                        geometry: {
                            center,
                            radius: 10,
                            startAngle: 0,
                            endAngle: Math.PI,
                            clockwise: false,
                        },
                    },
                    {
                        id: 'arc-2',
                        type: GeometryType.ARC,
                        geometry: {
                            center,
                            radius: 15, // Different radius
                            startAngle: Math.PI,
                            endAngle: 2 * Math.PI,
                            clockwise: false,
                        },
                    },
                ],
            };

            const chainObj = new Chain(chain);
            expect(chainObj.isCyclic()).toBe(false);
        });
    });

    describe('Case 3: Cyclic polygon', () => {
        it('should return true for an equilateral triangle (cyclic polygon)', () => {
            // Equilateral triangle with vertices on a circle of radius 10
            const radius = 10;
            const center: Point2D = { x: 0, y: 0 };

            // Calculate vertices of equilateral triangle on circle
            const angle1 = 0;
            const angle2 = (2 * Math.PI) / 3;
            const angle3 = (4 * Math.PI) / 3;

            const p1: Point2D = {
                x: center.x + radius * Math.cos(angle1),
                y: center.y + radius * Math.sin(angle1),
            };
            const p2: Point2D = {
                x: center.x + radius * Math.cos(angle2),
                y: center.y + radius * Math.sin(angle2),
            };
            const p3: Point2D = {
                x: center.x + radius * Math.cos(angle3),
                y: center.y + radius * Math.sin(angle3),
            };

            const chain: ChainData = {
                id: 'test-triangle',
                name: 'test-triangle', shapes: [
                    {
                        id: 'line-1',
                        type: GeometryType.LINE,
                        geometry: { start: p1, end: p2 },
                    },
                    {
                        id: 'line-2',
                        type: GeometryType.LINE,
                        geometry: { start: p2, end: p3 },
                    },
                    {
                        id: 'line-3',
                        type: GeometryType.LINE,
                        geometry: { start: p3, end: p1 },
                    },
                ],
            };

            const chainObj = new Chain(chain);
            expect(chainObj.isCyclic()).toBe(true);
        });

        it('should return true for a square (cyclic polygon)', () => {
            // Square with vertices on a circle
            const radius = 10;
            const center: Point2D = { x: 0, y: 0 };

            // Calculate vertices of square on circle
            const angle1 = Math.PI / 4;
            const angle2 = (3 * Math.PI) / 4;
            const angle3 = (5 * Math.PI) / 4;
            const angle4 = (7 * Math.PI) / 4;

            const p1: Point2D = {
                x: center.x + radius * Math.cos(angle1),
                y: center.y + radius * Math.sin(angle1),
            };
            const p2: Point2D = {
                x: center.x + radius * Math.cos(angle2),
                y: center.y + radius * Math.sin(angle2),
            };
            const p3: Point2D = {
                x: center.x + radius * Math.cos(angle3),
                y: center.y + radius * Math.sin(angle3),
            };
            const p4: Point2D = {
                x: center.x + radius * Math.cos(angle4),
                y: center.y + radius * Math.sin(angle4),
            };

            const chain: ChainData = {
                id: 'test-square',
                name: 'test-square', shapes: [
                    {
                        id: 'line-1',
                        type: GeometryType.LINE,
                        geometry: { start: p1, end: p2 },
                    },
                    {
                        id: 'line-2',
                        type: GeometryType.LINE,
                        geometry: { start: p2, end: p3 },
                    },
                    {
                        id: 'line-3',
                        type: GeometryType.LINE,
                        geometry: { start: p3, end: p4 },
                    },
                    {
                        id: 'line-4',
                        type: GeometryType.LINE,
                        geometry: { start: p4, end: p1 },
                    },
                ],
            };

            const chainObj = new Chain(chain);
            expect(chainObj.isCyclic()).toBe(true);
        });

        it('should return true for a regular hexagon (cyclic polygon)', () => {
            // Regular hexagon with vertices on a circle
            const radius = 10;
            const center: Point2D = { x: 0, y: 0 };
            const vertices: Point2D[] = [];

            // Calculate 6 vertices evenly spaced on circle
            for (let i = 0; i < 6; i++) {
                const angle = (i * 2 * Math.PI) / 6;
                vertices.push({
                    x: center.x + radius * Math.cos(angle),
                    y: center.y + radius * Math.sin(angle),
                });
            }

            const chain: ChainData = {
                id: 'test-hexagon',
                name: 'test-hexagon', shapes: vertices.map((v, i) => ({
                    id: `line-${i}`,
                    type: GeometryType.LINE,
                    geometry: {
                        start: v,
                        end: vertices[(i + 1) % vertices.length],
                    },
                })),
            };

            const chainObj = new Chain(chain);
            expect(chainObj.isCyclic()).toBe(true);
        });

        it('should return true for a regular octagon (cyclic polygon)', () => {
            // Regular octagon with vertices on a circle
            const radius = 15;
            const center: Point2D = { x: 5, y: 5 };
            const vertices: Point2D[] = [];

            // Calculate 8 vertices evenly spaced on circle
            for (let i = 0; i < 8; i++) {
                const angle = (i * 2 * Math.PI) / 8;
                vertices.push({
                    x: center.x + radius * Math.cos(angle),
                    y: center.y + radius * Math.sin(angle),
                });
            }

            const chain: ChainData = {
                id: 'test-octagon',
                name: 'test-octagon', shapes: vertices.map((v, i) => ({
                    id: `line-${i}`,
                    type: GeometryType.LINE,
                    geometry: {
                        start: v,
                        end: vertices[(i + 1) % vertices.length],
                    },
                })),
            };

            const chainObj = new Chain(chain);
            expect(chainObj.isCyclic()).toBe(true);
        });

        it('should return false for a non-cyclic quadrilateral', () => {
            // A quadrilateral where not all vertices lie on a circle
            const chain: ChainData = {
                id: 'test-non-cyclic',
                name: 'test-non-cyclic', shapes: [
                    {
                        id: 'line-1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        },
                    },
                    {
                        id: 'line-2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 10, y: 0 },
                            end: { x: 10, y: 5 },
                        },
                    },
                    {
                        id: 'line-3',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 10, y: 5 },
                            end: { x: 0, y: 10 },
                        },
                    },
                    {
                        id: 'line-4',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 10 },
                            end: { x: 0, y: 0 },
                        },
                    },
                ],
            };

            const chainObj = new Chain(chain);
            expect(chainObj.isCyclic()).toBe(false);
        });
    });

    describe('Edge cases', () => {
        it('should return false for an empty chain', () => {
            const chain: ChainData = {
                id: 'test-empty',
                name: 'test-empty', shapes: [],
            };

            const chainObj = new Chain(chain);
            expect(chainObj.isCyclic()).toBe(false);
        });

        it('should return false for a chain with a single line', () => {
            const chain: ChainData = {
                id: 'test-single-line',
                name: 'test-single-line', shapes: [
                    {
                        id: 'line-1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        },
                    },
                ],
            };

            const chainObj = new Chain(chain);
            expect(chainObj.isCyclic()).toBe(false);
        });

        it('should return false for a chain with two lines (not enough points)', () => {
            const chain: ChainData = {
                id: 'test-two-lines',
                name: 'test-two-lines', shapes: [
                    {
                        id: 'line-1',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 0, y: 0 },
                            end: { x: 10, y: 0 },
                        },
                    },
                    {
                        id: 'line-2',
                        type: GeometryType.LINE,
                        geometry: {
                            start: { x: 10, y: 0 },
                            end: { x: 0, y: 0 },
                        },
                    },
                ],
            };

            const chainObj = new Chain(chain);
            expect(chainObj.isCyclic()).toBe(false);
        });
    });

    describe('Mixed shapes', () => {
        it('should return true for a chain with mixed arcs and lines forming a cyclic path', () => {
            // Create a path with 3 arc endpoints that lie on a circle
            const radius = 10;
            const center: Point2D = { x: 0, y: 0 };

            const p1: Point2D = {
                x: center.x + radius * Math.cos(0),
                y: center.y + radius * Math.sin(0),
            };
            const p2: Point2D = {
                x: center.x + radius * Math.cos((2 * Math.PI) / 3),
                y: center.y + radius * Math.sin((2 * Math.PI) / 3),
            };
            const p3: Point2D = {
                x: center.x + radius * Math.cos((4 * Math.PI) / 3),
                y: center.y + radius * Math.sin((4 * Math.PI) / 3),
            };

            const chain: ChainData = {
                id: 'test-mixed',
                name: 'test-mixed', shapes: [
                    {
                        id: 'line-1',
                        type: GeometryType.LINE,
                        geometry: { start: p1, end: p2 },
                    },
                    {
                        id: 'line-2',
                        type: GeometryType.LINE,
                        geometry: { start: p2, end: p3 },
                    },
                    {
                        id: 'line-3',
                        type: GeometryType.LINE,
                        geometry: { start: p3, end: p1 },
                    },
                ],
            };

            const chainObj = new Chain(chain);
            expect(chainObj.isCyclic()).toBe(true);
        });
    });
});
