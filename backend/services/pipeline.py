from typing import Dict, Any
from services.llm import llm

INTENT_SYSTEM = """Kullanıcının video edit komutundan niyet çıkar.
SADECE JSON dön.
"""

PLAN_SYSTEM = """Video edit planı üret.
SADECE JSON dön.
"""

def make_intent(command_text: str, video_meta: Dict[str, Any]) -> Dict[str, Any]:
    return llm.generate_json(
        model="gpt-5.2",
        system=INTENT_SYSTEM,
        user=command_text,
        temperature=0.0,
    )

def make_plan(intent: Dict[str, Any], video_meta: Dict[str, Any]) -> Dict[str, Any]:
    return llm.generate_json(
        model="gpt-5.2",
        system=PLAN_SYSTEM,
        user=str(intent),
        temperature=0.0,
    )