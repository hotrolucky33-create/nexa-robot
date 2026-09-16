# CAD engine

`AnalyticalCadProvider` creates the code-generated `TEST-PRESS-001` parametric model and validates positive dimensions, volumes, duplicate IDs, and axis-aligned interference. This is a deterministic geometry data provider, not a BREP kernel.

`FreeCADAdapter` is the production boundary. It returns `NOT_AVAILABLE` until a version-pinned headless FreeCAD executable is configured. No analytical result is presented as a FreeCAD result.
