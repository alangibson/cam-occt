import { parseString } from 'dxf';
import fs from 'fs';

const dxfContent = fs.readFileSync('tests/dxf/Polylinie.dxf', 'utf-8');
const parsed = parseString(dxfContent);

console.log('Polylinie.dxf entities:');
if (parsed.entities) {
  parsed.entities.forEach((entity, i) => {
    if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
      console.log(`Entity ${i}:`, {
        type: entity.type,
        vertices: entity.vertices?.map(v => ({ x: v.x, y: v.y, bulge: v.bulge })) || 'none',
        verticesCount: entity.vertices?.length || 0
      });
    }
  });
}
