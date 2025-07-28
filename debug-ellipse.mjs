import { parseDXF } from './src/lib/parsers/dxf-parser.js';

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

async function test() {
  console.log('Testing ellipse parsing...');
  try {
    const drawing = await parseDXF(dxfContent);
    console.log('Drawing:', drawing);
    console.log('Shapes count:', drawing.shapes.length);
    if (drawing.shapes.length > 0) {
      console.log('First shape:', JSON.stringify(drawing.shapes[0], null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
