"""OpenAI helpers for the Streamlit injury forecaster (optional — requires API key)."""

from __future__ import annotations

import json
import os
import re
from typing import Any


def resolve_openai_key(st: Any) -> str:
    k = os.getenv("OPENAI_API_KEY", "").strip()
    if k:
        return k
    try:
        if hasattr(st, "secrets") and "OPENAI_API_KEY" in st.secrets:
            return str(st.secrets["OPENAI_API_KEY"]).strip()
    except (RuntimeError, FileNotFoundError, KeyError, TypeError):
        pass
    return ""


def openai_model() -> str:
    return os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"


def _parse_json_object(text: str) -> dict[str, Any] | None:
    text = text.strip()
    try:
        out = json.loads(text)
        return out if isinstance(out, dict) else None
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            try:
                out = json.loads(m.group(0))
                return out if isinstance(out, dict) else None
            except json.JSONDecodeError:
                return None
    return None


def fetch_forecast_ai_briefing(
    *,
    api_key: str,
    n_records: int,
    overall_dart: float,
    overall_trir: float,
    trade: str,
    fte: int,
    month: str,
    expected_cases: float,
    injury_mix: dict[str, int],
) -> tuple[dict[str, Any] | None, str | None]:
    """Returns (parsed_json, error_message)."""
    key = api_key.strip()
    if not key:
        return None, "Missing OPENAI_API_KEY"

    mix_lines = [f"- {name}: {pct}%" for name, pct in list(injury_mix.items())[:8]]
    user = f"""You are a construction safety advisor. The user has OSHA-style IPA summary statistics (not patient data).

Portfolio (construction NAICS subset in workbook):
- Row count: {n_records}
- DART rate (per 200k hours): {overall_dart}
- Total recordable rate (per 200k hours): {overall_trir}

Forecast scenario (rate × FTE × 2000 hr extrapolation):
- Trade / industry description: {trade}
- FTE: {fte}
- Time label: {month}
- Expected DART cases (deterministic from IPA rates): {expected_cases}
- Heuristic injury-type weights (%):
{chr(10).join(mix_lines)}

Respond with JSON only (no markdown) using this shape:
{{
  "headline": "one line",
  "executiveSummary": "2-4 sentences, plain language",
  "priorityActions": ["4-6 short imperative bullets for field supervision"],
  "trainingTopics": ["3-5 specific training themes"],
  "limitations": "one sentence: statistics only, not medical/legal prediction"
}}
Do not invent numeric rates beyond what was given. Tie actions to the injury mix and trade."""

    try:
        from openai import OpenAI

        client = OpenAI(api_key=key)
        resp = client.chat.completions.create(
            model=openai_model(),
            messages=[
                {
                    "role": "system",
                    "content": "You output only valid JSON objects. No markdown fences. Be concise and practical for construction safety programs.",
                },
                {"role": "user", "content": user},
            ],
            response_format={"type": "json_object"},
            temperature=0.35,
            max_tokens=1200,
        )
        raw = (resp.choices[0].message.content or "").strip()
        parsed = _parse_json_object(raw)
        if not parsed:
            return None, "Could not parse model response"
        return parsed, None
    except Exception as e:  # noqa: BLE001
        return None, str(e)[:500]


def fetch_rca_ai_suggestions(*, api_key: str, incident_label: str, why_chain: str) -> tuple[dict[str, Any] | None, str | None]:
    key = api_key.strip()
    if not key:
        return None, "Missing OPENAI_API_KEY"

    user = f"""Incident / type: {incident_label}
5-Why notes so far (may be incomplete):
{why_chain or "(empty)"}

Return JSON only:
{{
  "followUpQuestions": ["3-5 questions to deepen root-cause analysis"],
  "systemicThemes": ["2-4 themes e.g. training, planning, equipment, culture"],
  "nextVerificationSteps": ["2-4 concrete field verification steps"]
}}"""

    try:
        from openai import OpenAI

        client = OpenAI(api_key=key)
        resp = client.chat.completions.create(
            model=openai_model(),
            messages=[
                {
                    "role": "system",
                    "content": "You assist with workplace incident root-cause thinking. Output JSON only. Not legal or medical advice.",
                },
                {"role": "user", "content": user},
            ],
            response_format={"type": "json_object"},
            temperature=0.4,
            max_tokens=800,
        )
        raw = (resp.choices[0].message.content or "").strip()
        parsed = _parse_json_object(raw)
        if not parsed:
            return None, "Could not parse model response"
        return parsed, None
    except Exception as e:  # noqa: BLE001
        return None, str(e)[:500]
