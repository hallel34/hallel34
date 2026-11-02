"""Optional paid helper (Anthropic API). Off unless ANTHROPIC_API_KEY is set AND you approve the printed cost."""
import json
import os
import re

import requests

from . import common as C


def available():
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def ask_json(prompt, adv, max_tokens=1200):
    """Return parsed JSON or None. Asks for permission first."""
    if not available():
        return None
    est = (len(prompt) / 3.0 * adv["LLM_PRICE_USD_PER_MTOK_IN"] + max_tokens * adv["LLM_PRICE_USD_PER_MTOK_OUT"]) / 1e6
    if not C.ask_paid(f"Anthropic API ({adv['LLM_MODEL']}) to tidy theme names (prices are editable estimates in config.json)", est):
        return None
    try:
        r = requests.post("https://api.anthropic.com/v1/messages", timeout=90, headers={
            "x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01",
            "content-type": "application/json"},
            json={"model": adv["LLM_MODEL"], "max_tokens": max_tokens,
                  "messages": [{"role": "user", "content": prompt}]})
        r.raise_for_status()
        text = r.json()["content"][0]["text"]
        return json.loads(re.search(r"[\[{].*[\]}]", text, re.S).group(0))
    except Exception as e:  # noqa: BLE001
        C.log(f"LLM call failed ({type(e).__name__}); continuing without it.", "WARN")
        return None
