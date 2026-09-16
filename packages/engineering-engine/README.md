# Engineering engine boundary

The deterministic calculation engine currently lives in `packages/verification`. This package boundary reserves the future unit-aware calculation library and solver adapters. It must use verified material data and never infer missing engineering properties.
