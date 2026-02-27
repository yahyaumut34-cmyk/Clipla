from openai import AsyncOpenAI
from config import config
from schemas import UserIntent, VideoAnalysis, EditPlan
import json
import logging

logger = logging.getLogger(__name__)

class StrategyAgent:
    """Create edit plan using OpenAI"""

    TEMPERATURE = 0.0
    MAX_TOKENS = 2000

    def __init__(self):
        if not config.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not configured")

        self.client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)

    async def create_edit_plan(self, intent: UserIntent, analysis: VideoAnalysis) -> EditPlan:

        system_prompt = """Create retention-optimized video edit plans.
Return ONLY valid JSON:
{
  "edits": [
    {
      "action": "cut" | "speed" | "audio",
      "start_time": 10.5,
      "end_time": 15.2,
      "parameters": {},
      "reason": "brief explanation"
    }
  ],
  "estimated_duration": 95.3,
  "optimization_summary": "brief summary",
  "quality_score": 85,
  "validation_notes": []
}

No markdown, only JSON.
"""

        user_prompt = f"""
Intent: {intent.model_dump_json()}
Duration: {analysis.duration}
Statistics: {json.dumps(analysis.statistics)}
Segments: {json.dumps(analysis.segments[:30])}

Create edit plan JSON.
"""

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

            return EditPlan(**data)

        except Exception as e:
            logger.error(f"StrategyAgent failed: {e}")
            raise

strategy_agent = StrategyAgent()
