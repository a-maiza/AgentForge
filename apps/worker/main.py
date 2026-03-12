# Entry point — fully implemented in task 2.3
from fastapi import FastAPI

app = FastAPI(
    title="AgentForge Eval Worker",
    description="Async evaluation job processor",
    version="0.1.0",
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
