"""Unit-aware calculation boundary.

The MVP keeps the release gate in JavaScript. This module is intentionally
small until a reviewed unit library and domain solver are selected.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class UnitValue:
    value: float
    unit: str

    def require(self, expected_unit: str) -> float:
        if self.unit != expected_unit:
            raise ValueError(f"unit mismatch: expected {expected_unit}, got {self.unit}")
        return self.value
