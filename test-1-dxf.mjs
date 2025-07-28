import { parseString } from 'dxf';
import fs from 'fs';

const dxfContent = fs.readFileSync('tests/dxf/1.dxf', 'utf-8');
const parsed = parseString(dxfContent);

console.log('1.dxf entities:');
if (parsed.entities) {
  parsed.entities.forEach((entity, i) => {
    console.log(`Entity ${i}:`, {
      type: entity.type,
      vertices: entity.vertices?.map(v => ({ x: v.x, y: v.y, bulge: v.bulge })) || 'none'
    });
  });
}
