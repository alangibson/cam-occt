import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseDXF } from '../parsers/dxf-parser';
import { detectShapeChains } from './chain-detection';
import { normalizeChain } from './chain-normalization';

// We need to access the internal face creation function
const openCascadeModule = import('opencascade.js');

describe('Deep Diagnostic - Face Creation and Boolean Operations', () => {
  it('should diagnose exactly why identical chains give different boolean results', async () => {
    // Load the DXF file
    const dxfPath = path.resolve('tests/dxf/Tractor Seat Mount - Left.dxf');
    const dxfContent = readFileSync(dxfPath, 'utf-8');
    
    // Parse DXF
    const drawing = await parseDXF(dxfContent, {
      decomposePolylines: true,
      translateToPositiveQuadrant: true,
      squashLayers: true
    });

    // Detect chains
    const tolerance = 1.0;
    const chains = detectShapeChains(drawing.shapes, { tolerance });
    
    // Normalize chains
    const normalizedChains = chains.map(chain => normalizeChain(chain));
    
    // Find the specific chains
    const boundaryChain = normalizedChains.find(chain => chain.shapes.length === 42);
    const chain7 = normalizedChains.find(chain => chain.id === 'chain-7');
    const chain13 = normalizedChains.find(chain => chain.id === 'chain-13');
    
    expect(boundaryChain).toBeDefined();
    expect(chain7).toBeDefined();
    expect(chain13).toBeDefined();
    
    console.log(`\n=== DEEP DIAGNOSTIC ANALYSIS ===`);
    
    // Load OpenCascade.js
    const openCascade = await import('opencascade.js');
    const oc = await openCascade.default();
    
    // Helper function to create a face from a chain (simplified version of the actual function)
    const createSimpleFace = async (chain: any) => {
      try {
        // Create a very simple wire from just the first few points
        const wireBuilder = new oc.BRepBuilderAPI_MakeWire_1();
        
        let pointCount = 0;
        for (const shape of chain.shapes.slice(0, 4)) { // Only use first 4 shapes
          if (shape.type === 'line') {
            const p1 = new oc.gp_Pnt_3(shape.geometry.start.x, shape.geometry.start.y, 0);
            const p2 = new oc.gp_Pnt_3(shape.geometry.end.x, shape.geometry.end.y, 0);
            const edge = new oc.BRepBuilderAPI_MakeEdge_3(p1, p2);
            
            if (edge.IsDone()) {
              wireBuilder.Add_1(edge.Edge());
              pointCount++;
            }
            
            p1.delete();
            p2.delete();
            edge.delete();
          }
        }
        
        if (pointCount === 0 || !wireBuilder.IsDone()) {
          wireBuilder.delete();
          return null;
        }
        
        const wire = wireBuilder.Wire();
        
        const faceBuilder = new oc.BRepBuilderAPI_MakeFace_15(wire, true);
        if (!faceBuilder.IsDone()) {
          wire.delete();
          wireBuilder.delete();
          faceBuilder.delete();
          return null;
        }
        
        const face = faceBuilder.Face();
        wireBuilder.delete();
        faceBuilder.delete();
        
        return face;
      } catch (error) {
        console.error('Error creating simple face:', error);
        return null;
      }
    };
    
    // Create simple faces for both chains
    console.log(`\n--- CREATING SIMPLE FACES ---`);
    const face7 = await createSimpleFace(chain7!);
    const face13 = await createSimpleFace(chain13!);
    
    if (!face7 || !face13) {
      console.log(`Failed to create faces - face7: ${!!face7}, face13: ${!!face13}`);
      return;
    }
    
    console.log(`Successfully created both faces`);
    
    // Calculate areas
    const calculateArea = (face: any) => {
      const properties = new oc.GProp_GProps_1();
      oc.BRepGProp.SurfaceProperties_1(face, properties, 1e-7, true);
      const area = properties.Mass();
      properties.delete();
      return area;
    };
    
    const area7 = calculateArea(face7);
    const area13 = calculateArea(face13);
    
    console.log(`\n--- FACE AREAS ---`);
    console.log(`Chain-7 face area: ${area7.toFixed(10)}`);
    console.log(`Chain-13 face area: ${area13.toFixed(10)}`);
    console.log(`Areas match: ${Math.abs(area7 - area13) < 1e-6}`);
    
    // Test boolean operation consistency by running it multiple times
    console.log(`\n--- BOOLEAN OPERATION CONSISTENCY TEST ---`);
    
    const testBooleanConsistency = (face: any, chainName: string) => {
      const results: boolean[] = [];
      
      for (let i = 0; i < 5; i++) {
        try {
          // Create a simple rectangular outer face for testing
          const p1 = new oc.gp_Pnt_3(0, 0, 0);
          const p2 = new oc.gp_Pnt_3(300, 0, 0);
          const p3 = new oc.gp_Pnt_3(300, 300, 0);
          const p4 = new oc.gp_Pnt_3(0, 300, 0);
          
          const outerWire = new oc.BRepBuilderAPI_MakeWire_1();
          const edge1 = new oc.BRepBuilderAPI_MakeEdge_3(p1, p2);
          const edge2 = new oc.BRepBuilderAPI_MakeEdge_3(p2, p3);
          const edge3 = new oc.BRepBuilderAPI_MakeEdge_3(p3, p4);
          const edge4 = new oc.BRepBuilderAPI_MakeEdge_3(p4, p1);
          
          outerWire.Add_1(edge1.Edge());
          outerWire.Add_1(edge2.Edge());
          outerWire.Add_1(edge3.Edge());
          outerWire.Add_1(edge4.Edge());
          
          const outerFaceBuilder = new oc.BRepBuilderAPI_MakeFace_15(outerWire.Wire(), true);
          const outerFace = outerFaceBuilder.Face();
          
          // Perform boolean operation
          const intersection = new oc.BRepAlgoAPI_Common_3(face, outerFace, new oc.Message_ProgressRange_1());
          intersection.SetFuzzyValue(1e-7);
          
          const success = intersection.IsDone();
          results.push(success);
          
          // Clean up
          intersection.delete();
          p1.delete();
          p2.delete();
          p3.delete();
          p4.delete();
          edge1.delete();
          edge2.delete();
          edge3.delete();
          edge4.delete();
          outerWire.delete();
          outerFaceBuilder.delete();
          
        } catch (error) {
          results.push(false);
        }
      }
      
      return results;
    };
    
    const results7 = testBooleanConsistency(face7, 'chain-7');
    const results13 = testBooleanConsistency(face13, 'chain-13');
    
    console.log(`Chain-7 boolean operation success rates: [${results7.join(', ')}]`);
    console.log(`Chain-13 boolean operation success rates: [${results13.join(', ')}]`);
    
    const consistency7 = results7.every(r => r === results7[0]);
    const consistency13 = results13.every(r => r === results13[0]);
    
    console.log(`Chain-7 consistent results: ${consistency7}`);
    console.log(`Chain-13 consistent results: ${consistency13}`);
    
    console.log(`\n--- DIAGNOSIS SUMMARY ---`);
    if (!consistency7 || !consistency13) {
      console.log(`🚨 NON-DETERMINISTIC BEHAVIOR DETECTED!`);
      console.log(`Boolean operations are not consistent across multiple runs.`);
      console.log(`This indicates numerical instability in OpenCascade.js operations.`);
    } else if (results7[0] !== results13[0]) {
      console.log(`🚨 FACE CREATION DIFFERENCE DETECTED!`);
      console.log(`Identical shapes are creating faces that behave differently in boolean operations.`);
      console.log(`This suggests the face creation process itself has issues.`);
    } else {
      console.log(`✅ Boolean operations are consistent.`);
      console.log(`The issue may be in the more complex face creation from polylines.`);
    }
    
    // Clean up
    face7.delete();
    face13.delete();
    
  }, 20000);
});