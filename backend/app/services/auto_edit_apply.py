# app/services/auto_edit_apply.py
import os
import subprocess
import uuid
from typing import List, Tuple

from app.core.edit_plan_schema import EditPlanV1


def apply_edit_plan_ffmpeg(
    plan: EditPlanV1,
    input_video_path: str,
    music_library_dir: str,
    output_dir: str,
) -> str:
    """
    v1: keep-first assembly + loudnorm + music mix.
    Returns output mp4 path.
    """
    os.makedirs(output_dir, exist_ok=True)

    # 1) Resolve music file from tag
    music_path = _pick_music_file(music_library_dir, plan.audio.music_tag)
    if not os.path.exists(music_path):
        raise FileNotFoundError(f"Music not found for tag={plan.audio.music_tag}: {music_path}")

    # 2) Build keep timeline (seconds)
    keep = [(s.start, s.end) for s in plan.keep_segments]
    if not keep:
        raise ValueError("EditPlan has no keep_segments. Theme preservation requires keep_segments.")

    # 3) Render "keeps" -> temp video
    temp_video = os.path.join(output_dir, f"tmp_keeps_{uuid.uuid4().hex}.mp4")
    _render_keeps_concat(input_video_path, keep, temp_video)

    # 4) Loudnorm + music ducking mix -> final
    out_path = os.path.join(output_dir, f"clipla_{uuid.uuid4().hex}.mp4")
    _mix_music_and_loudnorm(
        video_path=temp_video,
        music_path=music_path,
        out_path=out_path,
        duck_db=plan.audio.music_ducking_db,
    )

    # cleanup
    try:
        os.remove(temp_video)
    except Exception:
        pass

    return out_path


def _render_keeps_concat(input_video: str, keep: List[Tuple[float, float]], out_path: str) -> None:
    """
    Fast & reliable: trim each keep into a segment file, then concat demuxer.
    """
    workdir = os.path.dirname(out_path)
    seg_files: List[str] = []

    for idx, (start, end) in enumerate(keep):
        dur = max(0.05, end - start)
        seg_path = os.path.join(workdir, f"seg_{idx}_{uuid.uuid4().hex}.mp4")
        cmd = [
            "ffmpeg", "-hide_banner", "-y",
            "-ss", str(start),
            "-i", input_video,
            "-t", str(dur),
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "20",
            "-c:a", "aac",
            "-b:a", "160k",
            seg_path
        ]
        _run(cmd)
        seg_files.append(seg_path)

    # concat list file
    list_path = os.path.join(workdir, f"concat_{uuid.uuid4().hex}.txt")
    with open(list_path, "w", encoding="utf-8") as f:
        for p in seg_files:
            # concat demuxer requires:
            f.write(f"file '{p.replace(\"'\", \"\\\\'\")}'\n")

    cmd_concat = [
        "ffmpeg", "-hide_banner", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", list_path,
        "-c", "copy",
        out_path
    ]
    _run(cmd_concat)

    # cleanup
    for p in seg_files:
        try: os.remove(p)
        except Exception: pass
    try: os.remove(list_path)
    except Exception: pass


def _mix_music_and_loudnorm(video_path: str, music_path: str, out_path: str, duck_db: int = -10) -> None:
    """
    - loudnorm the voice
    - add background music looped
    - duck music under voice
    """
    # Voice normalize:
    # Music loop + duck:
    # sidechaincompress is a decent v1 ducking method.
    af = (
        "[0:a]loudnorm=I=-16:TP=-1.5:LRA=11[a0];"
        "[1:a]volume=0.35[a1];"
        "[a1][a0]sidechaincompress=threshold=0.05:ratio=8:attack=5:release=200[bg];"
        "[a0][bg]amix=inputs=2:duration=first:dropout_transition=2[mix]"
    )

    cmd = [
        "ffmpeg", "-hide_banner", "-y",
        "-i", video_path,
        "-stream_loop", "-1",
        "-i", music_path,
        "-filter_complex", af,
        "-map", "0:v:0",
        "-map", "[mix]",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "20",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        out_path
    ]
    _run(cmd)


def _pick_music_file(music_dir: str, tag: str) -> str:
    # v1: map tag -> filename convention
    # example: energetic_low.mp3 in music_dir
    # You can expand later to random pick among many files.
    return os.path.join(music_dir, f"{tag}.mp3")


def _run(cmd: List[str]) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg failed:\nCMD: {' '.join(cmd)}\nSTDERR:\n{proc.stderr}")