import os
import json
from typing import Any, Dict, Optional
from openai import OpenAI

class LLM:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY bulunamadı.")
        self.client = OpenAI(api_key=self.api_key)

    def generate_json(
        self,
        *,
        model: str,
        system: str,
        user: str,
        temperature: float = 0.0,
        max_output_tokens: int = 1200,
    ) -> Dict[str, Any]:
        resp = self.client.responses.create(
            model=model,
            input=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        )

        text = getattr(resp, "output_text", None)
        if not text:
            raise ValueError("Model boş cevap döndü")

        return json.loads(text)

llm = LLM()