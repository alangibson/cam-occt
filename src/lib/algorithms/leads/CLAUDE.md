# Lead Generation System - Feature Brief

## Overview

The lead generation system provides automatic lead-in/lead-out geometry for plasma cutting operations. Leads are essential for smooth torch entry/exit and help prevent material damage during piercing and cut termination.

## Core Concepts

### Lead Types

- **Arc Leads**: Curved tangent geometry for smooth cutting transitions
- **None**: No lead geometry (direct chain cutting)

### Lead Configuration

Each lead is configured with:

- `type`: LeadType (ARC, NONE)
- `length`: Physical length in drawing units
- `flipSide?`: Boolean to flip lead to opposite side of chain
- `angle?`: Manual rotation angle (0-359�) overriding automatic calculation
- `fit?`: Auto-adjust length to avoid solid material (default: true)

### Cut Direction Integration

- **Clockwise**: Leads curve right relative to cut direction
- **Counterclockwise**: Leads curve left relative to cut direction
- **None**: Default geometric placement without directional preference

## Architecture

### Core Components

#### 1. Configuration (`interfaces.ts`)

- `LeadConfig`: User-specified lead parameters
- `Lead`: Generated geometry (Arc or Line) with metadata
- `LeadResult`: Complete result with warnings and validation
- `LeadsConfig`: Combined lead-in/out config with cut direction

#### 2. Calculation Engine (`lead-calculation.ts`)

Main entry point: `calculateLeads(chain, leadInConfig, leadOutConfig, cutDirection, part?)`

**Algorithm Flow:**

1. **Validation Pipeline**: Comprehensive config/geometry validation
2. **Context Detection**: Identify if chain is hole/shell within part
3. **Lead Generation**: Create tangent geometry at chain start/end points
4. **Solid Area Avoidance**: Rotate/resize leads to avoid material intersections
5. **Boundary Enforcement**: Ensure hole leads stay within hole boundaries

#### 3. Validation System (`lead-validation.ts`)

Multi-stage validation pipeline:

- Basic configuration validation (lengths, angles, types)
- Chain geometry constraints (size relative to leads)
- Part context validation (hole vs shell placement)
- Cut direction compatibility checks

#### 4. Geometry Integration

- **Arc Leads**: Use `createTangentArc()` for smooth curved entries
- **Tangency**: All leads maintain tangency with chain at connection point

## Lead Placement Logic

### Automatic Direction Selection

The system automatically determines optimal lead placement:

1. **Geometric Analysis**: Test perpendicular directions to chain tangent
2. **Solid Area Detection**: Use `isPointInsidePart()` for material avoidance
3. **Cut Direction Preference**: Prioritize cut direction when specified
4. **Boundary Constraints**: Ensure hole leads remain within hole boundaries

### Smart Collision Avoidance

When leads intersect solid material:

1. **Rotation Strategy**: Try 5� increments up to 360� rotation
2. **Length Scaling**: Attempt 100%, 75%, 50%, 25% of original length (if `fit` enabled)
3. **Warning Generation**: Alert user when no clear path found
4. **Fallback**: Return best-effort geometry with warnings

### Context-Aware Placement

#### Shell Leads (External Cuts)

- Placed outside part boundaries
- Must avoid intersecting holes
- Default to material-side avoidance

#### Hole Leads (Internal Cuts)

- Placed inside hole boundaries
- Additional check prevents leads from exiting hole
- Boundary validation using exact point-in-chain testing

## Integration Points

### Path Generation

- Paths store `leadInConfig` and `leadOutConfig` for persistence
- Generated leads cached as `leadIn` and `leadOut` with timestamps
- Lead geometry included in G-code generation pipeline

### UI Configuration

- Lead parameters exposed in operations panel
- Real-time validation feedback with severity levels
- Visual preview of lead geometry on canvas

### G-code Export

- Lead geometry converted to G01/G02/G03 commands
- Proper torch on/off sequencing around leads
- Integration with pierce delay and cut parameters

## Validation Framework

### Severity Levels

- **Info**: Suggestions for optimization
- **Warning**: Potential issues that don't prevent execution
- **Error**: Configuration problems that prevent lead generation

### Validation Categories

1. **Configuration**: Invalid parameters, conflicting settings
2. **Geometry**: Chain size vs lead length compatibility
3. **Material**: Solid area intersections, boundary violations
4. **Machining**: Practical cutting considerations

## Testing Strategy

### Unit Tests

- Geometric calculations (tangency, arc/line generation)
- Solid area detection accuracy
- Boundary enforcement for holes
- Configuration validation completeness

### Visual Tests

- SVG output generation for manual verification
- Cut direction visualization
- Lead placement verification across various DXF files
- Complex part geometry handling

### Integration Tests

- End-to-end path generation with leads
- G-code output verification
- UI state synchronization

## Core Lead Calculation Algorithm

### Basic Algorithm Steps

1. **Find Connection Point**
   - Lead-in: Use chain start point (`getChainStartPoint(chain)`)
   - Lead-out: Use chain end point (`getChainEndPoint(chain)`)

2. **Calculate Tangent Vector**
   - Get tangent direction at connection point: `getChainTangent(chain, point, isLeadIn)`
   - For lead-in: Tangent points INTO the cut path
   - For lead-out: Tangent points ALONG the cut direction

3. **Calculate Normal Vectors**

   ```typescript
   // Calculate perpendicular directions to tangent
   const leftNormal = { x: -tangent.y, y: tangent.x }; // 90° CCW from tangent
   const rightNormal = { x: tangent.y, y: -tangent.x }; // 90° CW from tangent
   ```

4. **Determine Lead Direction**
   - Test both normal directions for solid material intersection
   - Consider cut direction preference (CW/CCW)
   - For shells: Choose normal pointing AWAY from part
   - For holes: Choose normal pointing INTO hole (away from hole boundary)

5. **Generate Lead Geometry**
   - **Arc Lead**: Create tangent arc using `createTangentArc(point, tangent, length, curveDirection, isLeadIn)`

6. **Validate & Adjust**
   - Check for solid material intersections
   - If collision detected: Rotate in 5° increments
   - If still colliding: Scale length (100%, 75%, 50%, 25%)
   - Ensure boundary constraints are satisfied

### Detailed Arc Lead Algorithm

```typescript
// Arc leads sweep from lead start to connection point (lead-in)
// or from connection point along cut path (lead-out)
function calculateArcLead(chain, point, arcLength, isLeadIn, ...) {
    // 1. Get tangent at connection point
    const tangent = getChainTangent(chain, point, isLeadIn);

    // 2. Determine curve direction (which way arc sweeps)
    const curveDirection = getLeadCurveDirection(tangent, isHole, isShell, cutDirection, ...);

    // 3. Create arc that maintains tangency
    // Arc ALWAYS sweeps toward the path for smooth transition
    const arc = createTangentArc(point, tangent, arcLength, curveDirection, isLeadIn);

    // For lead-in: Arc ends at connection point, tangent to path
    // For lead-out: Arc starts at connection point, tangent from path

    return arc;
}
```

### Cut Direction Synchronization

When cut direction changes, lead direction automatically flips:

```typescript
if (cutDirection === CutDirection.CLOCKWISE) {
  // Choose direction where (tangent × direction) < 0
  // This ensures arc sweeps in correct direction for CW cuts
  const cross = tangent.x * normal.y - tangent.y * normal.x;
  selectedDirection = cross < 0 ? normal : -normal;
} else if (cutDirection === CutDirection.COUNTERCLOCKWISE) {
  // Choose direction where (tangent × direction) > 0
  // This ensures arc sweeps in correct direction for CCW cuts
  const cross = tangent.x * normal.y - tangent.y * normal.x;
  selectedDirection = cross > 0 ? normal : -normal;
}
```

#### Lead Sweep Direction Rules

**For Shell Leads (Outside Part):**

- When cutDirection = CLOCKWISE: Leads should have CCW sweep
- When cutDirection = COUNTERCLOCKWISE: Leads should have CW sweep
- This is because on a CCW-ordered shell cut clockwise, leads must sweep opposite to cut direction

**For Hole Leads (Inside Part):**

- When the closed chain is a hole, leads are placed inside the closed chain
- Lead sweep direction matches the winding order of the chain/cut
- This maintains proper material avoidance while staying within hole boundaries

## Lead System Invariants

### Critical Invariants (Must Always Hold)

1. **Tangency Invariant**
   - Leads MUST be tangent to the cut path at the connection point
   - Tool motion must be continuous (C1) through the lead-path transition
   - No sharp corners or discontinuities at connection

2. **Material Placement Invariant**
   - Leads MUST NEVER be placed inside part solid material
   - Shell leads MUST remain outside the part boundary
   - Hole leads MUST remain inside the hole boundary

3. **Arc Sweep Direction Invariant**
   - Arc leads MUST ALWAYS sweep toward the cut path
   - Lead-in arcs: End at connection point, sweeping into the cut
   - Lead-out arcs: Start at connection point, sweeping away from cut
   - **Shell leads**: Sweep opposite to cut direction (CW cut → CCW sweep, CCW cut → CW sweep)
   - **Hole leads**: Sweep matches winding order (leads inside hole follow chain winding)

4. **Cut Direction Coherence Invariant**
   - When cut direction changes, lead placement MUST flip automatically
   - Tool head motion must remain smooth through direction changes
   - Lead geometry must respect the new cutting direction

5. **Rapid Connection Invariant**
   - Rapids MUST ALWAYS connect to the start of lead-in geometry
   - Never connect rapids directly to cut paths when leads exist
   - Rapid end point = Lead-in start point

### Placement Rules

1. **Shell Lead Rules**
   - Default: Place outside part boundary
   - Must avoid intersecting with holes
   - Pierce point outside material

2. **Hole Lead Rules**
   - Default: Place inside hole boundary
   - Must not exit hole perimeter
   - Pierce point inside hole void

3. **Path-Based Calculation Rule**
   - Leads calculated from actual cut path geometry
   - Not from original chain geometry
   - Accounts for kerf compensation and offsets

### Geometric Constraints

1. **Smooth Transition Constraint**
   - Lead end/start tangent = Path start/end tangent
   - No velocity discontinuities
   - Acceleration-limited transitions

2. **Boundary Enforcement**
   - Shell leads: `!isPointInsidePart(leadPoint, part)`
   - Hole leads: `isPointInsideChain(leadPoint, holeChain)`
   - Connection point exempt from tests (on boundary)

3. **Length Constraints**
   - Minimum: Sufficient for pierce completion
   - Maximum: Avoid unnecessary travel
   - Adaptive: Scale to avoid collisions

### System Integration Rules

1. **G-code Generation**
   - Lead geometry precedes M3 (torch on) for lead-in
   - Lead geometry follows cut path for lead-out
   - Pierce delay at lead-in start point

2. **Path Updates**
   - Any path change triggers lead recalculation
   - Cut direction change triggers lead flip
   - Operation changes propagate to leads

3. **Validation Requirements**
   - All invariants checked before G-code generation
   - Warnings for soft violations
   - Errors for hard violations (material intersection)

### Solid Area Testing

- Sample points along lead geometry at ~2mm intervals
- Use raytracing-based point-in-part detection
- Skip connection point in intersection tests (it's on the boundary)

## Performance Considerations

- **Caching**: Generated leads cached with versioning for invalidation
- **Lazy Evaluation**: Only generate leads when operation enabled
- **Efficient Sampling**: Adaptive tessellation based on geometry size
- **Early Termination**: Stop rotation search on first valid solution

## Error Handling

### Common Issues

- **Large leads on small geometry**: Automatic scaling with warnings
- **Solid area intersections**: Rotation-based avoidance with fallback
- **Invalid configurations**: Clear validation messages with suggestions
- **Boundary violations**: Geometric constraint enforcement

### Recovery Strategies

- Always provide fallback geometry rather than failing completely
- Comprehensive warning system for user awareness
- Graceful degradation with reduced functionality when needed

## Dependencies

### Core Geometry

- Arc/Line creation and manipulation functions
- Chain analysis and tangent calculation
- Bounding box and intersection detection

### Part Detection

- Part/hole/shell relationship analysis
- Point-in-polygon testing for solid area detection
- Boundary validation for constraint enforcement

### Validation Infrastructure

- Multi-stage validation pipeline
- Severity-based error reporting
- Suggestion generation for user guidance
