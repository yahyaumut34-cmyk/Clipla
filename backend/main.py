from datetime import datetime, timezone
from fastapi.responses import HTMLResponse
import os
import uuid
import subprocess
import re
import shutil
import json

from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

# ✅ Command router
from clipla_api.command import router as command_router

# ✅ Local Whisper
from faster_whisper import WhisperModel


# =========================================================
# App
# =========================================================
app = FastAPI(title="Clipla Backend")
app.include_router(command_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # prod'da domain'e indirgeriz
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================
# Paths
# =========================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

STATIC_DIR = os.path.join(BASE_DIR, "static")     # demo: static/index.html
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
TMP_DIR = os.path.join(OUTPUT_DIR, "tmp")

os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(TMP_DIR, exist_ok=True)
# =========================================================
# ✅ Demo Analytics (events) + Admin
# =========================================================
ANALYTICS_PATH = os.path.join(OUTPUT_DIR, "_analytics.jsonl")
ADMIN_PASSWORD = os.getenv("CLIPLA_ADMIN_PASSWORD", "")  # deploy'da env olarak set edeceğiz


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def log_event(request: Request, event: str, extra: Dict[str, Any] | None = None):
    """
    Events: page_view, upload, process, auto_edit_render
    JSONL format: her satır 1 event.
    """
    try:
        row = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "event": event,
            "ip": _client_ip(request),
            "ua": request.headers.get("user-agent", ""),
            "token": (request.query_params.get("token") or "")[:64],
        }
        if extra:
            row.update(extra)
        with open(ANALYTICS_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    except Exception:
        pass


def require_admin(request: Request):
    pw = (request.query_params.get("pw") or "").strip()
    if not ADMIN_PASSWORD or pw != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="Forbidden")
# static assets (demo vs)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# outputs download
app.mount("/outputs", StaticFiles(directory=OUTPUT_DIR), name="outputs")

# ✅ son yüklenen video job_id (RAM)
LAST_JOB_ID: Optional[str] = None


# =========================================================
# ✅ Demo Token Auth
# =========================================================
def _get_demo_tokens() -> set[str]:
    """
    CLIPLA_DEMO_TOKENS env:
    INV-OGUZHAN-2026,INV-MELEK-001,INV-TEST-ABC
    """
    raw = os.getenv("CLIPLA_DEMO_TOKENS", "")
    return {t.strip() for t in raw.split(",") if t.strip()}


def require_demo_token(request: Request) -> str:
    token = (request.query_params.get("token") or "").strip()
    if not token:
        raise HTTPException(status_code=403, detail="Demo erişimi için token gerekli.")
    if token not in _get_demo_tokens():
        raise HTTPException(status_code=403, detail="Geçersiz token.")
    return token


@app.get("/api/demo/verify", include_in_schema=False)
def demo_verify(request: Request):
    require_demo_token(request)
    return {"ok": True}


# =========================================================
# Demo Root "/"  (✅ artık tokenlı)
# =========================================================
@app.get("/", include_in_schema=False)
def serve_demo(request: Request):
    # Token kontrol
    require_demo_token(request)
    log_event(request, "page_view")
    index_path = os.path.join(STATIC_DIR, "index.html")
    if not os.path.exists(index_path):
        return JSONResponse(
            status_code=404,
            content={
                "error": "Demo index.html not found",
                "expected_path": index_path,
                "fix": r"Create: backend\static\index.html (real .html, not .txt)",
            },
        )
    return FileResponse(index_path)


# =========================================================
# Models
# =========================================================
class SpeedApplyItem(BaseModel):
    from_: float = Field(..., alias="from")
    to_: float = Field(..., alias="to")
    speed: float

    class Config:
        populate_by_name = True


class PunchApplyItem(BaseModel):
    from_: float = Field(..., alias="from")
    to_: float = Field(..., alias="to")
    zoom: float

    class Config:
        populate_by_name = True


class RenderV2Request(BaseModel):
    speed_apply: List[SpeedApplyItem] = []
    punch_apply: List[PunchApplyItem] = []


class AutoEditRequest(BaseModel):
    command_text: str = ""
    platform: Optional[str] = None
    target_duration_sec: Optional[int] = None


# =========================================================
# Helpers (FFmpeg)
# =========================================================
def _run(cmd: List[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


def _clean_tmp():
    if os.path.exists(TMP_DIR):
        shutil.rmtree(TMP_DIR)
    os.makedirs(TMP_DIR, exist_ok=True)


def get_duration(video_path: str) -> float:
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path
    ]
    r = _run(cmd)
    try:
        return float((r.stdout or "").strip())
    except Exception:
        return 0.0


def detect_silence_segments(video_path: str):
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-i", video_path,
        "-af", "silencedetect=noise=-30dB:d=0.5",
        "-f", "null",
        "-"
    ]
    r = _run(cmd)
    log = r.stderr or ""

    starts = [float(x) for x in re.findall(r"silence_start: ([0-9\\.]+)", log)]
    ends = [float(x) for x in re.findall(r"silence_end: ([0-9\\.]+)", log)]

    segments = []
    total = 0.0
    for s, e in zip(starts, ends):
        dur = max(0.0, e - s)
        total += dur
        segments.append({"start": round(s, 2), "end": round(e, 2), "dur": round(dur, 2)})

    return segments, total


def build_cuts_from_silence(segments: List[Dict[str, float]]):
    cuts = []
    for seg in segments:
        if seg["dur"] >= 0.7:
            cuts.append({"from": seg["start"], "to": seg["end"], "reason": "silence"})
    return cuts[:300]


def build_keeps_from_cuts(cuts: List[Dict[str, Any]], duration: float):
    if duration <= 0:
        return []
    if not cuts:
        return [{"from": 0.0, "to": round(duration, 2)}]

    cuts_sorted = sorted(cuts, key=lambda x: float(x["from"]))
    keeps = []

    prev_end = 0.0
    for c in cuts_sorted:
        s = float(c["from"])
        e = float(c["to"])
        if s > prev_end:
            keeps.append({"from": round(prev_end, 2), "to": round(s, 2)})
        prev_end = max(prev_end, e)

    if duration > prev_end:
        keeps.append({"from": round(prev_end, 2), "to": round(duration, 2)})

    cleaned = []
    for k in keeps:
        if (k["to"] - k["from"]) >= 0.08:
            cleaned.append(k)
    return cleaned


def tempo_analysis_from_keeps(keeps: List[Dict[str, float]]):
    if not keeps:
        return {
            "tempo_level": "unknown",
            "average_keep_sec": None,
            "long_keeps_count": 0,
            "message": "Tempo analizi için yeterli segment yok.",
            "keep_segments_count": 0
        }

    lengths = [max(0.0, k["to"] - k["from"]) for k in keeps]
    avg_keep = sum(lengths) / max(1, len(lengths))
    long_keeps = [x for x in lengths if x >= 6.0]

    if avg_keep >= 6.0:
        level = "slow"
        msg = "Tempo yavaş olabilir: bazı bölümler uzun akıyor."
    elif avg_keep >= 3.0:
        level = "medium"
        msg = "Tempo orta: akış fena değil ama bazı yerler hızlandırılabilir."
    else:
        level = "fast"
        msg = "Tempo hızlı: dikkat canlı."

    return {
        "tempo_level": level,
        "average_keep_sec": round(avg_keep, 2),
        "long_keeps_count": len(long_keeps),
        "message": msg,
        "keep_segments_count": len(keeps)
    }


def render_keep_segments(video_path: str, output_path: str, keeps: List[Dict[str, float]]):
    _clean_tmp()

    part_files = []
    for i, seg in enumerate(keeps):
        start = float(seg["from"])
        end = float(seg["to"])
        dur = max(0.0, end - start)
        if dur <= 0.08:
            continue

        part_path = os.path.join(TMP_DIR, f"part_{i}.mp4")
        cmd = [
            "ffmpeg", "-hide_banner", "-y",
            "-ss", str(start),
            "-i", video_path,
            "-t", str(dur),
            "-c", "copy",
            part_path
        ]
        _run(cmd)

        if os.path.exists(part_path) and os.path.getsize(part_path) > 0:
            part_files.append(part_path)

    if not part_files:
        return False, "No segments to render"

    list_path = os.path.join(TMP_DIR, "concat_list.txt")
    with open(list_path, "w", encoding="utf-8") as f:
        for p in part_files:
            abs_p = os.path.abspath(p).replace("\\", "/")
            f.write("file '{}'\n".format(abs_p))

    cmd_concat = [
        "ffmpeg", "-hide_banner", "-y",
        "-f", "concat", "-safe", "0",
        "-i", list_path,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "160k",
        "-movflags", "+faststart",
        output_path
    ]
    _run(cmd_concat)

    ok = os.path.exists(output_path) and os.path.getsize(output_path) > 0
    return ok, None if ok else "Concat failed"


def save_last_analysis(job_id: str, data: Dict[str, Any]):
    p = os.path.join(OUTPUT_DIR, f"{job_id}_analysis.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _normalize_text(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _extract_duration_sec(text: str, fallback: int = 60) -> int:
    t = _normalize_text(text)

    m = re.search(r"(\d+)\s*(sn|saniye|sec|seconds|s)\b", t)
    if m:
        return max(5, min(600, int(m.group(1))))

    m = re.search(r"(\d+)\s*(dk|dakika|min|minutes)\b", t)
    if m:
        return max(5, min(600, int(m.group(1)) * 60))

    return max(5, min(600, int(fallback or 60)))


def _pick_keeps_v15(
    keeps_list: List[Dict[str, float]],
    duration: float,
    target_seconds: float,
    intro_sec: float = 10.0,
    outro_sec: float = 15.0
):
    if not keeps_list or duration <= 0:
        return keeps_list

    if target_seconds <= (intro_sec + outro_sec):
        intro = {"from": 0.0, "to": round(min(intro_sec, duration), 2)}
        outro_start = max(0.0, duration - outro_sec)
        outro = {"from": round(outro_start, 2), "to": round(duration, 2)}
        return [intro, outro] if outro["from"] > intro["to"] else [intro]

    intro = {"from": 0.0, "to": round(min(intro_sec, duration), 2)}
    outro_start = max(0.0, duration - outro_sec)
    outro = {"from": round(outro_start, 2), "to": round(duration, 2)}

    middle_target = max(0.0, target_seconds - intro_sec - outro_sec)

    middle_keeps = []
    for k in keeps_list:
        s = float(k["from"])
        e = float(k["to"])
        dur = e - s
        if e <= intro["to"] or s >= outro["from"]:
            continue
        if dur >= 6.0:
            middle_keeps.append({"from": s, "to": e})

    middle_keeps = sorted(middle_keeps, key=lambda k: (k["to"] - k["from"]), reverse=True)

    picked_middle = []
    remaining = float(middle_target)

    for k in middle_keeps:
        s, e = k["from"], k["to"]
        dur = e - s
        if remaining <= 0:
            break

        if dur <= remaining:
            picked_middle.append({"from": round(s, 2), "to": round(e, 2)})
            remaining -= dur
        else:
            cut_to = s + remaining
            if (cut_to - s) >= 4.0:
                picked_middle.append({"from": round(s, 2), "to": round(cut_to, 2)})
            remaining = 0
            break

    picked_middle = sorted(picked_middle, key=lambda k: float(k["from"]))

    result = [intro] + picked_middle + [outro]

    cleaned = []
    last_to = -1.0
    for seg in result:
        s = float(seg["from"])
        e = float(seg["to"])
        if e <= s:
            continue
        if s < last_to:
            s = last_to
        if e - s >= 0.08:
            cleaned.append({"from": round(s, 2), "to": round(e, 2)})
            last_to = e

    return cleaned


# =========================================================
# Whisper (Local) + cache + AI segments
# =========================================================
WHISPER_MODEL_NAME = os.environ.get("WHISPER_MODEL", "small")
_whisper_model: Optional[WhisperModel] = None


def _get_whisper_model() -> WhisperModel:
    global _whisper_model
    if _whisper_model is None:
        _whisper_model = WhisperModel(WHISPER_MODEL_NAME, device="cpu", compute_type="int8")
    return _whisper_model


def _transcript_cache_path(job_id: str) -> str:
    return os.path.join(OUTPUT_DIR, f"{job_id}_transcript.json")


def transcribe_whisper_cached(job_id: str, video_path: str) -> Dict[str, Any]:
    cache_path = _transcript_cache_path(job_id)
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            return json.load(f)

    model = _get_whisper_model()
    segments, info = model.transcribe(video_path, vad_filter=True)

    items = []
    full_text_parts = []
    for s in segments:
        text = (s.text or "").strip()
        if text:
            items.append({
                "start": round(float(s.start), 2),
                "end": round(float(s.end), 2),
                "text": text
            })
            full_text_parts.append(text)

    data = {
        "model": WHISPER_MODEL_NAME,
        "language": getattr(info, "language", None),
        "duration": getattr(info, "duration", None),
        "text": " ".join(full_text_parts).strip(),
        "segments": items[:500]
    }

    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return data


def pick_hook_middle_closing(transcript_text: str) -> Dict[str, Any]:
    t = (transcript_text or "").strip()
    if not t:
        return {
            "hook": {"text": "", "reason": "no transcript"},
            "middle": [],
            "closing": {"text": "", "reason": "no transcript"},
        }

    # Basit cümle bölme (TR için yeterli)
    sents = [x.strip() for x in re.split(r"(?<=[\.\!\?])\s+", t) if x.strip()]
    if len(sents) == 1:
        return {
            "hook": {"text": sents[0], "reason": "single sentence"},
            "middle": [],
            "closing": {"text": sents[0], "reason": "single sentence"},
        }

    hook = " ".join(sents[:2]) if len(sents) >= 2 else sents[0]
    closing = sents[-1]

    middle_candidates = sents[2:-1] if len(sents) > 3 else sents[1:-1]
    scored = sorted(
        [(len(x), x) for x in middle_candidates],
        key=lambda z: z[0],
        reverse=True
    )
    picked = [x for _, x in scored[:4]]
    picked_set = set(picked)
    middle = [x for x in middle_candidates if x in picked_set]

    return {
        "hook": {"text": hook, "reason": "first strong sentences"},
        "middle": [{"text": m, "reason": "long/high-signal sentence"} for m in middle],
        "closing": {"text": closing, "reason": "last sentence closing"},
    }


def _preview(text: str, n: int = 320) -> str:
    s = (text or "").strip()
    if len(s) <= n:
        return s
    return s[:n] + "…"


# =========================================================
# Endpoints
# =========================================================
@app.get("/admin", include_in_schema=False)
def admin_dashboard(request: Request):
    require_admin(request)

    total = 0
    unique_ips = set()
    by_event: Dict[str, int] = {}

    if os.path.exists(ANALYTICS_PATH):
        with open(ANALYTICS_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                total += 1
                try:
                    row = json.loads(line)
                    unique_ips.add(row.get("ip", ""))
                    ev = row.get("event", "unknown")
                    by_event[ev] = by_event.get(ev, 0) + 1
                except Exception:
                    continue

    items = "".join(
        [f"<li><b>{k}</b>: {v}</li>" for k, v in sorted(by_event.items(), key=lambda x: -x[1])]
    )

    html = f"""
    <html><head><meta charset="utf-8"><title>Clipla Admin</title></head>
    <body style="font-family:system-ui; padding:20px;">
      <h2>Clipla Demo Analytics</h2>
      <p><b>Total events:</b> {total}</p>
      <p><b>Unique IPs (approx):</b> {len([x for x in unique_ips if x])}</p>
      <h3>Events</h3>
      <ul>{items}</ul>
      <p style="opacity:.7">Not: IP bazlı unique sayım NAT/VPN nedeniyle yaklaşık olabilir.</p>
    </body></html>
    """
    return HTMLResponse(html)
@app.get("/health", include_in_schema=False)
def health():
    return {"status": "ok"}


@app.get("/api/video/health")
def video_health_check():
    return {"status": "ok"}


@app.get("/api/video/last-job")
def last_job():
    if not LAST_JOB_ID:
        raise HTTPException(status_code=404, detail="henüz video yüklenmedi")
    return {"job_id": LAST_JOB_ID}


@app.post("/api/video/upload")
async def upload_video(request: Request, file: UploadFile = File(...)):
    global LAST_JOB_ID

    job_id = str(uuid.uuid4())
    log_event(request, "upload", {"job_id": job_id})
    file_path = os.path.join(UPLOAD_DIR, f"{job_id}.mp4")

    with open(file_path, "wb") as f:
        f.write(await file.read())

    LAST_JOB_ID = job_id
    return {"job_id": job_id}

@app.post("/api/video/process/{job_id}")
def process_video(request: Request, job_id: str, platform: Optional[str] = Query(default=None, description="youtube / youtube_shorts / reels")):
    log_event(request, "process", {"job_id": job_id})

    video_path = os.path.join(UPLOAD_DIR, f"{job_id}.mp4")
    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="video bulunamadı")

    duration = get_duration(video_path)
    segments, total_silence = detect_silence_segments(video_path)
    cuts = build_cuts_from_silence(segments)
    keeps = build_keeps_from_cuts(cuts, duration)

    # skor (şimdilik sessizlik bazlı)
    if total_silence < 2:
        score = 90
    elif total_silence < 8:
        score = 70
    else:
        score = 50

    tempo = tempo_analysis_from_keeps(keeps)

    # ✅ Whisper transcript + segments (AI hissi)
    tr = transcribe_whisper_cached(job_id, video_path)
    seg = pick_hook_middle_closing(tr.get("text", ""))

    payload = {
        "algorithm_score": score,
        "insights": {
            "message": "analiz üretildi",
            "silence_seconds": round(total_silence, 2),
            "silence_segments_preview": segments[:20],
            "silence_segments_count": len(segments),
            "tip": f"{len(cuts)} sessiz kesim önerisi var.",
            "job_id": job_id,
            "platform": platform
        },
        "edit_plan": {"version": "edit_plan_v1", "cuts": cuts},
        "tempo_analysis": tempo,

        # AI payload
        "whisper": {
            "model": tr.get("model"),
            "language": tr.get("language"),
        },
        "transcript_preview": _preview(tr.get("text", "")),
        "segments": seg,
    }

    save_last_analysis(job_id, payload)
    return payload


@app.post("/api/video/render/{job_id}")
def render_v1(job_id: str):
    """
    Render v1: sessiz kesimleri uygular
    """
    video_path = os.path.join(UPLOAD_DIR, f"{job_id}.mp4")
    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="video bulunamadı")

    duration = get_duration(video_path)
    if duration <= 0:
        raise HTTPException(status_code=400, detail="video süresi okunamadı")

    segments, _ = detect_silence_segments(video_path)
    cuts = build_cuts_from_silence(segments)
    keeps = build_keeps_from_cuts(cuts, duration)

    out_name = f"{job_id}_cut.mp4"
    output_path = os.path.join(OUTPUT_DIR, out_name)

    ok, err = render_keep_segments(video_path, output_path, keeps)
    if not ok:
        raise HTTPException(status_code=500, detail=f"render failed: {err}")

    return {
        "message": "render ok",
        "job_id": job_id,
        "output_file": out_name,
        "download_url": f"/outputs/{out_name}",
        "cuts_applied": len(cuts),
        "kept_segments": len(keeps)
    }

    log_event(request, "auto_edit_render", {"job_id": job_id})
@app.post("/api/auto-edit/{job_id}")
def auto_edit_v15(request: Request, job_id: str, body: AutoEditRequest):
    """
    Auto-Edit v1.5:
    - sessiz kesimleri uygular
    - intro min 10s + outro min 15s
    - body: çeşitli yerlerden seçer (min 6s)
    - mp4 export verir
    - Whisper segment JSON ekler (vaov)
    """
    video_path = os.path.join(UPLOAD_DIR, f"{job_id}.mp4")
    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="video bulunamadı")

    target_sec = body.target_duration_sec
    if target_sec is None:
        target_sec = _extract_duration_sec(body.command_text, 60)

    duration = get_duration(video_path)
    segments, total_silence = detect_silence_segments(video_path)
    cuts = build_cuts_from_silence(segments)
    keeps = build_keeps_from_cuts(cuts, duration)

    # ✅ v1.5 seçim: intro+outro+body
    if duration > 0 and target_sec and target_sec < duration:
        keeps = _pick_keeps_v15(
            keeps_list=keeps,
            duration=duration,
            target_seconds=float(target_sec),
            intro_sec=10.0,
            outro_sec=15.0
        )

    # skor (şimdilik sessizlik bazlı)
    if total_silence < 2:
        score = 90
    elif total_silence < 8:
        score = 70
    else:
        score = 50

    out_name = f"{job_id}_auto.mp4"
    output_path = os.path.join(OUTPUT_DIR, out_name)

    ok, err = render_keep_segments(video_path, output_path, keeps)
    if not ok:
        raise HTTPException(status_code=500, detail=f"auto-edit render failed: {err}")

    edit_plan = {
        "version": "edit_plan_v1_5",
        "job_id": job_id,
        "command_text": body.command_text,
        "platform": body.platform or "youtube",
        "target_duration_sec": int(target_sec),
        "rules": {
            "intro_min_sec": 10,
            "outro_min_sec": 15,
            "body_min_segment_sec": 6
        },
        "cuts": cuts,
        "keeps_used": keeps
    }

    # ✅ Whisper transcript + segments
    tr = transcribe_whisper_cached(job_id, video_path)
    seg = pick_hook_middle_closing(tr.get("text", ""))

    return {
        "message": "auto-edit v1.5 ok",
        "job_id": job_id,
        "algorithm_score": score,
        "download_url": f"/outputs/{out_name}",
        "output_file": out_name,
        "edit_plan": edit_plan,

        "whisper": {"model": tr.get("model"), "language": tr.get("language")},
        "transcript_preview": _preview(tr.get("text", "")),
        "segments": seg,
    }


@app.post("/api/auto-edit")
def auto_edit_last(request: Request, body: AutoEditRequest):
    """
    🍬 job_id yok: son yüklenen video ile auto-edit çalışır
    """
    if not LAST_JOB_ID:
        raise HTTPException(
            status_code=400,
            detail="Henüz video yüklenmedi. Önce /api/video/upload kullan."
        )
    return auto_edit_v15(request, LAST_JOB_ID, body)