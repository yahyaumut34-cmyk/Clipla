# agents/pipeline.py
from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional

from openai import OpenAI


def _safe_json_loads(text: str) -> Dict[str, Any]:
    """
    Attempts to parse JSON from a model output that might include extra text.
    """
    text = text.strip()
    # Quick path
    try:
        return json.loads(text)
    except Exception:
        pass

    # Try to extract the first JSON object
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        chunk = text[start : end + 1]
        return json.loads(chunk)

    raise ValueError("Model output did not contain valid JSON.")


def run_edit_pipeline(
    job_id: str,
    command: str,
    transcript: Optional[str] = None,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    MVP pipeline:
      - Takes user command (+ optional transcript)
      - Returns deterministic-ish JSON: algorithm_score, insights, edit_plan
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is missing. Put it into backend/.env and restart the server."
        )

    # Safer default model; you can override with CLIPLA_OPENAI_MODEL in .env
    model = model or os.getenv("CLIPLA_OPENAI_MODEL", "gpt-4o-mini")

    client = OpenAI(api_key=api_key)

    # Keep it simple + robust for MVP: force strict JSON instructions
    transcript_hint = (
        f"\n\nTRANSCRIPT:\n{transcript}\n" if transcript and transcript.strip() else ""
    )

    system = (
        "You are Clipla, an AI video editing planner. "
        "Return ONLY valid JSON. No markdown. No explanations. "
        "Your output must strictly match the required keys."
    )

    user = f"""
JOB_ID: {job_id}

USER_COMMAND:
{command}
{transcript_hint}

Return JSON with this exact structure:

{{
  "algorithm_score": <integer 0..100>,
  "insights": {{
    "summary": <string>,
    "key_points": [<string>, ...],
    "risks": [<string>, ...]
  }},
  "edit_plan": {{
    "version": "1.0",
    "target_platform": <"tiktok"|"instagram_reels"|"youtube_shorts"|"youtube_long">,
    "pace": <"slow"|"medium"|"fast">,
    "segments": [
      {{
        "name": <"hook"|"middle"|"closing">,
        "goal": <string>,
        "actions": [<string>, ...]
      }}
    ],
    "captions": {{
      "style": <string>,
      "keywords": [<string>, ...]
    }},
    "music": {{
      "mood": <string>,
      "notes": <string>
    }},
    "cuts": [
      {{
        "type": <"remove_silence"|"jump_cut"|"highlight"|"broll_suggestion">,
        "note": <string>
      }}
    ]
  }}
}}

Rules:
- algorithm_score should reflect how “shorts-friendly” this plan is.
- If platform not mentioned, default to "youtube_shorts".
- segments must include exactly 3 items: hook, middle, closing.
- Keep it realistic and actionable.
""".strip()

    resp = client.chat.completions.create(
        model=model,
        temperature=0.2,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )

    text = resp.choices[0].message.content or ""
    data = _safe_json_loads(text)

    # Minimal validation + defaults to prevent frontend crash
    if "algorithm_score" not in data:
        data["algorithm_score"] = 60
    if "insights" not in data:
        data["insights"] = {"summary": "", "key_points": [], "risks": []}
    if "edit_plan" not in data:
        data["edit_plan"] = {
            "version": "1.0",
            "target_platform": "youtube_shorts",
            "pace": "fast",
            "segments": [],
            "captions": {"style": "clean", "keywords": []},
            "music": {"mood": "energetic", "notes": ""},
            "cuts": [],
        }

    return data