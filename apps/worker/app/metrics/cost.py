# Pricing table: model_name_prefix → (input_per_1m, output_per_1m) USD
PRICING: dict[str, tuple[float, float]] = {
    "gpt-4o": (5.0, 15.0),
    "gpt-4-turbo": (10.0, 30.0),
    "gpt-4": (30.0, 60.0),
    "gpt-3.5-turbo": (0.5, 1.5),
    "claude-3-5-sonnet": (3.0, 15.0),
    "claude-3-opus": (15.0, 75.0),
    "claude-3-haiku": (0.25, 1.25),
    "claude-3-sonnet": (3.0, 15.0),
    "gemini-1.5-pro": (3.5, 10.5),
    "gemini-1.5-flash": (0.35, 1.05),
}
DEFAULT_PRICING = (1.0, 3.0)


def cost_per_1m_tokens(model_name: str) -> tuple[float, float]:
    """Return (input, output) pricing per 1M tokens."""
    name_lower = model_name.lower()
    for prefix, pricing in PRICING.items():
        if name_lower.startswith(prefix):
            return pricing
    return DEFAULT_PRICING


def estimate_cost(model_name: str, input_tokens: int, output_tokens: int) -> float:
    """Return estimated cost in USD."""
    input_price, output_price = cost_per_1m_tokens(model_name)
    return (input_tokens * input_price + output_tokens * output_price) / 1_000_000
