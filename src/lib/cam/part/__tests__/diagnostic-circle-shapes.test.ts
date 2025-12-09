import { describe, it } from 'vitest';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Diagnostic - Circle Shape Analysis', () => {
    it('analyze circle shapes from DXF before chain detection', async () => {
        const filePath = join(
            process.cwd(),
            'tests/dxf/Tractor Light Mount - Left.dxf'
        );
        const dxfContent = readFileSync(filePath, 'utf-8');
        const drawing = await parseDXF(dxfContent);

        console.log(
            '\n========== DXF Circle Shapes Before Chain Detection =========='
        );
        console.log(`Total shapes: ${drawing.shapes.length}`);

        // Find all circle shapes
        const circles = drawing.shapes.filter((s) => s.type === 'circle');
        console.log(`\nCircle shapes: ${circles.length}`);

        // Group circles by center point
        const circlesByCenter = new Map<string, any[]>();
        circles.forEach((shape) => {
            const circle = shape.geometry as any;
            const key = `${circle.center.x.toFixed(2)},${circle.center.y.toFixed(2)},${circle.radius.toFixed(2)}`;
            if (!circlesByCenter.has(key)) {
                circlesByCenter.set(key, []);
            }
            circlesByCenter.get(key)!.push({
                id: shape.id,
                center: circle.center,
                radius: circle.radius,
                startAngle: circle.startAngle,
                endAngle: circle.endAngle,
                layer: shape.layer,
            });
        });

        console.log(`\nUnique circle locations: ${circlesByCenter.size}`);

        // Show duplicates
        for (const [key, shapes] of circlesByCenter.entries()) {
            if (shapes.length > 1) {
                console.log(`\nDuplicate circles at ${key}:`);
                shapes.forEach((s, idx) => {
                    console.log(
                        `  ${idx + 1}. id=${s.id}, layer=${s.layer}, start=${s.startAngle}, end=${s.endAngle}`
                    );
                });
            }
        }

        // Show first few unique circles
        let count = 0;
        console.log('\nFirst 5 unique circles:');
        for (const [key, shapes] of circlesByCenter.entries()) {
            if (count >= 5) break;
            const s = shapes[0];
            console.log(
                `  ${key}: id=${s.id}, layer=${s.layer}, start=${s.startAngle}, end=${s.endAngle}`
            );
            count++;
        }
    });
});
