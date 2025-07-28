import { parseString } from 'dxf';

// This is the format from failing test (with leading whitespace)
const dxfContentWithWhitespace = `
        0
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
        EOF
      `;

// This is the working format (no leading whitespace)      
const dxfContentNoWhitespace = `0
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

console.log('=== With whitespace ===');
try {
  const parsed1 = parseString(dxfContentWithWhitespace);
  console.log('Entities:', parsed1.entities.length);
  if (parsed1.entities.length > 0) {
    console.log('Entity 0:', parsed1.entities[0]);
  }
} catch (e) {
  console.log('Error:', e.message);
}

console.log('\n=== No whitespace ===');
try {
  const parsed2 = parseString(dxfContentNoWhitespace);
  console.log('Entities:', parsed2.entities.length);
  if (parsed2.entities.length > 0) {
    console.log('Entity 0:', parsed2.entities[0]);
  }
} catch (e) {
  console.log('Error:', e.message);
}
