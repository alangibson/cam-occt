import { parseString } from 'dxf';

const dxfContent = `0
SECTION
2
ENTITIES
0
ELLIPSE
10
50.0
20
75.0
30
0.0
11
25.0
21
0.0
31
0.0
40
0.6
41
0.0
42
1.570796327
0
ENDSEC
0
EOF`;

const parsed = parseString(dxfContent);
console.log('Parsed ellipse arc:');
if (parsed.entities && parsed.entities[0]) {
  console.log(JSON.stringify(parsed.entities[0], null, 2));
}
