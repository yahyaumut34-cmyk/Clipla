from openai import AsyncOpenAI
from config import config
from schemas import UserIntent
import json
import logging

logger = logging.getLogger(__name__)

class CommandAgent:
    """Parse user intent from natural language commands using OpenAI"""

    TEMPERATURE = 0.0
    MAX_TOKENS = 500

    def __init__(self):
        if not config.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not configured")

        self.client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)

    async def parse_intent(self, command_text: str, video_metadata: dict) -> UserIntent:
        if not command_text or len(command_text.strip()) < 5:
            raise ValueError("Command text too short")

        system_prompt = """Extract video editing intent from user commands.
Return ONLY valid JSON with these exact fields:
{
  "intent": "brief summary (10-200 chars)",
  "target_style": "fast-paced" | "balanced" | "cinematic" | "energetic",
  "cut_preference": "aggressive" | "moderate" | "conservative",
  "focus_areas": ["silence", "low-energy", "pauses"],
  "preserve_elements": ["intro", "key-points", "conclusion"],
  "pacing_adjustment": "speed-up" | "maintain" | "slow-down",
  "audio_normalization": true/false
}

Rules:
- focus_areas: min 1, max 10 items
- All strings non-empty
- No markdown, no explanations, only JSON
- If ambiguous, default to balanced/moderate
"""

        user_prompt = f"""Video: {video_metadata.get('filename', 'unknown')}
Duration: {video_metadata.get('duration', 0)}s
Command: {command_text}

Extract intent as JSON."""

        try:
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                temperature=self.TEMPERATURE,
                max_tokens=self.MAX_TOKENS,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
            )

            content = response.choices[0].message.content
            data = json.loads(content)

            intent = UserIntent(**data)
            return intent

        except Exception as e:
            logger.error(f"CommandAgent failed: {e}")
            return self._fallback_intent(command_text)

    def _fallback_intent(self, command_text: str) -> UserIntent:
        return UserIntent(
            intent=command_text[:100],
            target_style="balanced",
            cut_preference="moderate",
            focus_areas=["silence"],
            preserve_elements=["key-points"],
            pacing_adjustment="maintain",
            audio_normalization=True
        )

command_agent = CommandAgent()
