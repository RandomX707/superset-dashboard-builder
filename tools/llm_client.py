from __future__ import annotations

import logging

from openai import OpenAI

from config import config

logger = logging.getLogger(__name__)


def get_client() -> OpenAI:
    """Return an OpenAI-compatible client pointed at LiteLLM."""
    if not config.LITELLM_API_KEY:
        raise RuntimeError(
            "LITELLM_API_KEY is not set. "
            "Add it to your .env file or pass it as LITELLM_API_KEY=... before the command."
        )
    if not config.LITELLM_BASE_URL:
        raise RuntimeError(
            "LITELLM_BASE_URL is not set. "
            "Set it to your LiteLLM proxy URL, e.g. https://litellm.yourcompany.com"
        )
    return OpenAI(
        api_key=config.LITELLM_API_KEY,
        base_url=config.LITELLM_BASE_URL,
    )


def chat(
    system: str,
    user: str,
    max_tokens: int | None = None,
    temperature: float | None = None,
    model: str | None = None,
) -> str:
    """Single LLM call. Returns the text content of the first choice.

    Pass temperature=0 for fully deterministic output (same input → same output).
    When temperature is None the API default is used (typically ~1.0).
    Pass model to override the default LLM_MODEL from config.
    """
    client = get_client()
    resolved_model = model or config.LLM_MODEL

    # o1/o3/gpt-5 reasoning models differ from classic chat models:
    #   1. max_completion_tokens instead of max_tokens
    #   2. temperature must be omitted (only default=1 is supported)
    #   3. "system" role support varies by proxy — fold it into the user message
    #      to avoid role-naming issues entirely (safest across all LiteLLM setups)
    _REASONING_PREFIXES = ("o1", "o3", "gpt-5")
    is_reasoning = any(resolved_model.startswith(p) for p in _REASONING_PREFIXES)
    token_param = "max_completion_tokens" if is_reasoning else "max_tokens"

    if is_reasoning:
        # Merge system prompt into user message — avoids developer/system role issues
        messages = [{"role": "user", "content": f"{system}\n\n{user}"}]
    else:
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]

    kwargs: dict = dict(model=resolved_model, messages=messages)
    kwargs[token_param] = max_tokens or config.LLM_MAX_TOKENS
    if temperature is not None and not is_reasoning:
        kwargs["temperature"] = temperature
    response = client.chat.completions.create(**kwargs)
    usage = response.usage
    logger.debug(
        "LLM usage model=%s prompt=%s completion=%s total=%s finish_reason=%s",
        resolved_model,
        getattr(usage, "prompt_tokens", "?"),
        getattr(usage, "completion_tokens", "?"),
        getattr(usage, "total_tokens", "?"),
        response.choices[0].finish_reason,
    )
    content = response.choices[0].message.content
    if not content:
        limit = kwargs.get(token_param, "?")
        raise RuntimeError(
            f"LLM returned empty content for model '{resolved_model}' "
            f"(finish_reason={response.choices[0].finish_reason}, "
            f"{token_param}={limit}). "
            f"Reasoning models burn tokens thinking before writing — "
            f"raise LLM_MAX_TOKENS in .env (current: {config.LLM_MAX_TOKENS}) "
            f"or switch to a non-reasoning model like gpt-4o-mini."
        )
    return content
