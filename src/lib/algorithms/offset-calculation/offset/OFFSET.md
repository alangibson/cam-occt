This list documents types returned by offset functions, as well as the method used to do the offset.

Offsets of shapes are assumed to be **constant distance** offsets.

### Line → Line
- Method: Perpendicular translation
- Steps: Calculate unit perpendicular vector (90° rotation), translate both endpoints by offset distance along perpendicular

###  Arc → Arc
- Method: Radius adjustment
- Steps: Keep center and angular span identical, adjust radius (outset = +distance, inset = -distance), validate positive radius

### Circle → Circle
- Method: Radius adjustment
- Steps: Keep center identical, adjust radius (outset = +distance, inset = -distance), validate positive radius

### Polyline → Polyline
- Method: Different approaches for open vs closed
- Open polylines: Manual parallel line calculation with edge intersections
- Closed polylines: Polygon offset with winding order detection, parallel edge creation, consecutive edge intersection finding

### Spline → Spline
- Method: Tessellation + NURBS curve fitting via verb-nurbs
- Steps: 1) Create verb-nurbs curve, 2) Calculate normal vectors at parameter points using derivatives, 3) Generate offset points using adaptive sampling, 4) Fit new NURBS curve to offset points, 5) Validate accuracy and refine if needed with increased sampling

### Ellipse/Ellipse Arc → Spline
- Method: True mathematical offset via unit normal vectors
- Steps: 1) Generate a series of parametric points on the original ellipse or arc, 2) For each point, calculate its unit normal vector, 3) Move each point along its normal by the desired offset distance, 4) Construct a new NURBS curve through these new points, as a true ellipse offset is not an ellipse.