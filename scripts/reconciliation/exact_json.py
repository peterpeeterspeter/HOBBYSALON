"""Cycle-free exact JSON codec for detached native plans and SQL JSONB text binds.

Decimal remains a JSON number, never a float/string. Integer tokens stay integers;
fraction/exponent tokens decode to Decimal. Finite legacy Python floats can be
encoded as their existing JSON tokens, but no Decimal passes through that path.
This module has no acquisition, evidence, provider or database dependencies.
"""
from decimal import Decimal
import json
from typing import Any


class ExactJSONBlocked(ValueError):
    pass


def encode_json(value: Any) -> str:
    def encode(item):
        if isinstance(item, Decimal):
            if not item.is_finite():
                raise ExactJSONBlocked("nonfinite_numeric")
            return str(item)
        if item is None or type(item) in (str, int, bool, float):
            return json.dumps(item, ensure_ascii=False, allow_nan=False)
        if isinstance(item, (list, tuple)):
            return "[" + ",".join(encode(v) for v in item) + "]"
        if isinstance(item, dict) and all(isinstance(k, str) for k in item):
            return "{" + ",".join(encode(k) + ":" + encode(item[k]) for k in sorted(item)) + "}"
        raise ExactJSONBlocked("lossless_json_type_required")
    try:
        return encode(value)
    except ExactJSONBlocked:
        raise
    except (ValueError, TypeError, RecursionError, ArithmeticError):
        raise ExactJSONBlocked("malformed_exact_json") from None


def decode_json(text: str) -> Any:
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ExactJSONBlocked("duplicate_json_key")
            result[key] = value
        return result
    def invalid(_):
        raise ExactJSONBlocked("nonfinite_numeric")
    try:
        return json.loads(text, parse_float=Decimal, parse_constant=invalid, object_pairs_hook=pairs)
    except ExactJSONBlocked:
        raise
    except (ValueError, TypeError, RecursionError, ArithmeticError):
        raise ExactJSONBlocked("malformed_exact_json") from None
