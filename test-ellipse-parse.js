const dxf = require('dxf');

const dxfContent = `0
SECTION
2
ENTITIES
0
ELLIPSE
10
100.0
20
200.0
30
0.0
11
50.0
21
0.0
31
0.0
40
0.5
0
ENDSEC
0
EOF`;

const parsed = dxf.parseString(dxfContent);
console.log('Parsed DXF:', JSON.stringify(parsed, null, 2));
if (parsed.entities) {
  console.log('Entities:', parsed.entities);
  parsed.entities.forEach((entity, i) => {
    console.log(`Entity ${i}:`, entity);
  });
}
