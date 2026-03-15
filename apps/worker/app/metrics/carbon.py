# Published coefficients (approximate):
# ~0.5 gCO2eq per 1k tokens (cloud avg), power ~0.35 mWh per 1k tokens
CARBON_G_CO2_PER_1K_TOKENS = 0.5
POWER_MWH_PER_1K_TOKENS = 0.35


def estimate_carbon(total_tokens: int) -> float:
    """Return gCO2 for total_tokens."""
    return (total_tokens / 1000) * CARBON_G_CO2_PER_1K_TOKENS


def estimate_power(total_tokens: int) -> float:
    """Return mWh for total_tokens."""
    return (total_tokens / 1000) * POWER_MWH_PER_1K_TOKENS
