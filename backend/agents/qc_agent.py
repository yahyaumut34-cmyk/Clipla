from openai import AsyncOpenAI
from config import config
from schemas import EditPlan, UserIntent
import json
import logging

logger = logging.getLogger(__name__)

class QCAgent:
    """Quality control using OpenAI"""

    TEMPERATURE = 0.0
    MAX_TOKENS = 2000

    def __init__(self):
        if not config.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY not configured")

        self.client = AsyncOpenAI(api_key=config.OPENAI_API_KEY)

    async def validate_plan(self, plan: EditPlan, original_duration: float, intent: UserIntent) -> EditPlan:

        system_prompt = """Validate and fix video edit plans.
Return ONLY valid JSON:
{
  "edits": [...],
  "estimated_duration": 95.3,
  "optimization_summary": "summary",
  "quality_score": 85,
  "validation_notes": []
}

No markdown, only JSON.
"""

        user_prompt = f"""
Original Duration: {original_duration}
Intent: {intent.model_dump_json()}
Edit Plan:
{plan.model_dump_json()}

Validate and fix issues.
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
            logger.error(f"QCAgent failed: {e}")
            return plan

qc_agent = QCAgent()
