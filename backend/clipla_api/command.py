from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Literal
import re
import hashlib

router = APIRouter(prefix="/api/command", tags=["command"])


# -------------------------
# Locked Schema (v1)
# -------------------------
Target = Literal["youtube", "shorts"]
Preset = Literal["vertical_short", "youtube_16_9"]


class CutItem(BaseModel):
    from_: float = Field(..., alias="from")
    to_: float = Field(..., alias="to")
    reason: str = "unknown"

    class Config:
        populate_by_name = True


class EditPlanV1(BaseModel):
    version: Literal["edit_plan_v1"] = "edit_plan_v1"
    plan_id: str
    target: Target
    preset: Preset
    target_duration_sec: int
    must_keep_theme: bool = True
    cuts: List[CutItem] = []
    notes: List[str] = []


class CommandBody(BaseModel):
    command_text: str
    target: Target = "youtube"
    preset: Preset = "vertical_short"
    target_duration_sec: int = 60


# -------------------------
# Helpers (deterministic)
# -------------------------
def _normalize_text(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _extract_duration_sec(text: str, fallback: int) -> int:
    t = _normalize_text(text)

    m = re.search(r"(\d+)\s*(sn|saniye|sec|seconds|s)\b", t)
    if m:
        return max(5, min(600, int(m.group(1))))

    m = re.search(r"(\d+)\s*(dk|dakika|min|minutes)\b", t)
    if m:
        return max(5, min(600, int(m.group(1)) * 60))

    return max(5, min(600, int(fallback or 60)))


def _infer_target(text: str, fallback: Target) -> Target:
    t = _normalize_text(text)
    if "short" in t or "shorts" in t:
        return "shorts"
    return fallback


def _infer_preset(target: Target) -> Preset:
    return "vertical_short" if target == "shorts" else "youtube_16_9"


def _deterministic_plan_id(command_text: str, target: str, preset: str, dur: int) -> str:
    seed = f"{_normalize_text(command_text)}|{target}|{preset}|{dur}"
    h = hashlib.sha1(seed.encode("utf-8")).hexdigest()[:12]
    return f"plan_{h}"


# -------------------------
# Endpoints
# -------------------------
@router.get("/health")
def command_health():
    return {"status": "ok", "service": "clipla-command"}


@router.post("", response_model=EditPlanV1)
def create_edit_plan(body: CommandBody):
    if not body.command_text or not body.command_text.strip():
        raise HTTPException(status_code=400, detail="command_text boş olamaz")

    cmd = body.command_text.strip()
    target = _infer_target(cmd, body.target)
    preset = body.preset if body.preset else _infer_preset(target)
    dur = _extract_duration_sec(cmd, body.target_duration_sec)

    plan_id = _deterministic_plan_id(cmd, target, preset, dur)

    # v1: command sadece şema + meta üretir (cuts burada boş kalır)
    plan = EditPlanV1(
        plan_id=plan_id,
        target=target,
        preset=preset,
        target_duration_sec=dur,
        must_keep_theme=True,
        cuts=[],
        notes=[
            "v1: Command sadece kilitli EditPlan üretir (cuts process ile gelir).",
            "Tema korunur: anlam bozulmayacak şekilde kısaltma hedeflenir."
        ],
    )
    return plan