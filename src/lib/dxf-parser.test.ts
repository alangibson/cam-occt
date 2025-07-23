import { describe, it, expect, vi, beforeAll } from 'vitest';
import { DxfToOpenCascadeConverter } from '../lib/dxf-to-opencascade.js';

// Mock OpenCascade service since we can't load WASM in tests
vi.mock('../lib/opencascade-service.js', () => {
	return {
		default: {
			getInstance: () => ({
				initialize: vi.fn().mockResolvedValue({
					gp_Pnt_3: vi.fn(),
					BRepBuilderAPI_MakeEdge_3: vi.fn().mockReturnValue({ Edge: vi.fn() }),
					BRepBuilderAPI_MakeWire_1: vi.fn(),
				}),
				isInitialized: () => true,
				getOC: () => ({
					gp_Pnt_3: vi.fn(),
					BRepBuilderAPI_MakeEdge_3: vi.fn().mockReturnValue({ Edge: vi.fn() }),
					BRepBuilderAPI_MakeWire_1: vi.fn(),
				})
			})
		}
	};
});

describe('DXF Parser', () => {
	let converter: DxfToOpenCascadeConverter;
	let consoleErrorSpy: any;
	let consoleWarnSpy: any;
	let consoleLogSpy: any;

	beforeAll(() => {
		converter = new DxfToOpenCascadeConverter();
		// Suppress console output in tests to prevent stderr noise
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterAll(() => {
		consoleErrorSpy.mockRestore();
		consoleWarnSpy.mockRestore();
		consoleLogSpy.mockRestore();
	});

	it('should parse DXF with line entity successfully', async () => {
		const simpleDxf = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1014
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
0
10
0.0
20
0.0
30
0.0
11
10.0
21
10.0
31
0.0
0
ENDSEC
0
EOF`;

		// This should now work correctly with parseString
		const result = await converter.parseDxfToOpenCascade(simpleDxf);
		expect(result).toBeDefined();
		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBeGreaterThan(0);
		expect(result[0].type).toBe('LINE');
	});

	it('should use parseString function correctly', async () => {
		// Test to ensure we can use the DXF parseString function
		const dxf = await import('dxf');
		
		expect(dxf.parseString).toBeDefined();
		expect(typeof dxf.parseString).toBe('function');
		
		// Test with minimal DXF content
		const simpleDxf = `0
SECTION
2
ENTITIES
0
ENDSEC
0
EOF`;
		
		const result = dxf.parseString(simpleDxf);
		expect(result).toBeDefined();
		expect(result.entities).toBeDefined();
	});

	it('should parse simple DXF line entity', async () => {
		const simpleDxf = `0
SECTION
2
ENTITIES
0
LINE
8
0
10
0.0
20
0.0
30
0.0
11
10.0
21
10.0
31
0.0
0
ENDSEC
0
EOF`;

		// Mock a successful OpenCascade initialization
		vi.spyOn(converter, 'initialize').mockResolvedValue();
		
		// This test will help us fix the constructor issue
		const result = await converter.parseDxfToOpenCascade(simpleDxf);
		expect(result).toBeDefined();
		expect(Array.isArray(result)).toBe(true);
	});
});