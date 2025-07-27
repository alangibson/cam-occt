# CAM-OCCT

CAM-OCCT is a web-based Computer-Aided Manufacturing (CAM) application that converts SVG and DXF design files into optimized G-code for CNC plasma cutting operations. The application specifically targets LinuxCNC 2.9+ QtPlasmaC controllers.

## UI Layout Architecture

The application uses a workflow-based UI layout with three main rows: Header, Body, and Footer.

### Primary UI Hierarchy

```
window
├─ header
│  ├─ workflow stage breadcrumbs
├─ body
│  ├─ page for current workflow stage
├─ footer
│  ├─ drawing size
│  ├─ zoom factor
```

### Workflow Stage Pages

#### Import Stage
```
import
├─ Import button
├─ Drag and drop zone
├─ Decompose polylines checkbox
├─ Translate to positive quadrant checkbox
```

#### Edit Stage
```
edit
├─ left column
│  ├─ display units
│  ├─ layers
├─ center column
│  ├─ toolbar
│  ├─ drawing image
├─ right column
│  ├─ shape properties
```

#### Program Stage
```
program
├─ left column
│  ├─ chain detection controls (tolerance input, detect button)
│  ├─ chains list (with status: open/closed, shape count)
│  ├─ parts list (with hole count)
├─ center column
│  ├─ drawing canvas (chains displayed as paths, no dragging)
├─ right column
│  ├─ cutting parameters (feed rate, pierce settings, etc.)
│  ├─ path information (chain count, part count, cut paths)
```

#### Simulate Stage
```
simulate
├─ center column
│  ├─ 3D simulation viewport
├─ simulation controls
```

#### Export Stage
```
export
├─ generate gcode button
├─ generate gcode text area
├─ download button
```

## Key Technical Context

### Chain Closure Tolerance
**CRITICAL**: Use ONLY the user-set tolerance from the Program page for ALL chain closure detection. Do NOT implement "adaptive tolerance" or any other tolerance calculation based on chain size, complexity, or other factors. The user-set tolerance is the single source of truth for determining if chains are closed.

- Chain closure detection must use exactly the tolerance value set by the user
- Part detection must pass the user tolerance to all chain closure functions  
- UI chain status display must use the same user tolerance
- Any "adaptive" or "smart" tolerance calculations are explicitly forbidden

### User-Only Tolerance Setting
**CRITICAL**: ONLY the user sets tolerance values through the 'Tolerance (units)' property on the Program page. Developers must NEVER pick or suggest tolerance values in code or tests to make algorithms work. 

- **NEVER** choose tolerances like 20.0, 150.0, etc. in code to make tests pass
- **NEVER** implement tolerance recommendations or automatic adjustments
- **ALWAYS** use the user-provided tolerance from the UI
- If geometry doesn't work with user tolerance, that's the correct behavior - don't override it
- Tests should use realistic default tolerances (0.1) to show actual behavior

### Chain Detection and Processing Rules

**CRITICAL**: Follow these fundamental rules for all chain operations:

- **Always detect AND normalize chains** before doing further analysis on them
- **Make no assumptions** about the 'right' number of chains in a drawing - there could easily be thousands
- **Chains are chains** no matter if they are open or closed - both types are valid chains
- **Only closed chains can form the shell** of a part (outer boundary)
- **Only closed chains can have holes** (inner boundaries within shells)

### Chain Normalization and Closure
**IMPORTANT**: When analyzing chain traversal, coincident points between the first shape (shape 1) and the last shape (final shape) are EXPECTED and CORRECT for closed chains. This is what makes a chain closed - the end point of the last shape should coincide with the start point of the first shape.

- Do NOT report this as an error or warning - this is normal closed chain behavior
- Only report non-sequent shape coincident points as potential ordering issues when they occur between shapes that are not first/last
- Chain normalization should preserve this first/last coincidence for proper closure
