import json
import os
import re
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


ROOT = Path(__file__).parent
app = FastAPI(title="EduGenie", description="A thoughtful AI study companion")
app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")


class StudyRequest(BaseModel):
    mode: str = Field(pattern="^(ask|explain|quiz|path|summarize)$")
    prompt: str = Field(min_length=1, max_length=12000)
    level: str = Field(default="High school", max_length=40)


SYSTEM_PROMPTS = {
    "ask": "Answer the learner's question clearly and accurately. Start with a concise answer, then add a brief explanation and one useful detail. Be transparent about uncertainty.",
    "explain": "Explain the concept in plain language for the learner's level. Use a familiar analogy, then give a short concrete example. Avoid jargon unless you define it.",
    "quiz": "Create a five-question quiz about the requested topic for the learner's level. Use a mix of question types. Put the answer key after all questions, with one-line explanations.",
    "path": "Create a practical learning path for the requested subject from beginner to advanced. Include ordered topics, realistic time estimates, and a small practice suggestion for each stage.",
    "summarize": "Summarize the provided educational passage in concise bullet points. Preserve key ideas, definitions, and conclusions; do not add facts not present in the text.",
}


def _local_response(mode: str, prompt: str) -> str:
    normalized = prompt.lower()

    if mode == "ask" and any(word in normalized for word in ("largest ocean", "biggest ocean")):
        return "The Pacific Ocean is the largest ocean on Earth. It covers about 63 million square miles (165 million square kilometers), more area than all of Earth's land combined."

    if mode == "explain" and "pythag" in normalized:
        return (
            "The Pythagorean theorem is a shortcut for finding a side of a right-angled triangle. "
            "Imagine the two shorter sides are the legs of a ladder leaning against a wall: "
            "if the legs are a and b, the diagonal side c follows a² + b² = c².\n\n"
            "For example, with legs of 3 and 4, 3² + 4² = 9 + 16 = 25, so the diagonal is 5. "
            "It only applies to right-angled triangles."
        )

    if mode == "quiz" and "pythag" in normalized:
        return (
            "1. What kind of triangle does the theorem apply to?\n"
            "2. A right triangle has legs of 3 and 4. What is its hypotenuse?\n"
            "3. If a = 5 and b = 12, what is c?\n"
            "4. A right triangle has hypotenuse 13 and one leg 5. Find the other leg.\n"
            "5. True or false: the hypotenuse is opposite the right angle.\n\n"
            "Answer key\n"
            "1. A right-angled triangle.\n"
            "2. 5, since 3² + 4² = 25.\n"
            "3. 13, since 5² + 12² = 169.\n"
            "4. 12, since 13² − 5² = 144.\n"
            "5. True."
        )

    if mode == "path" and "sql" in normalized:
        return (
            "SQL learning path · about 6 weeks at 4 hours per week\n\n"
            "01 · Foundations · Week 1\n"
            "Tables, rows, columns, and relational databases. Practice reading a small dataset.\n\n"
            "02 · Querying · Week 2\n"
            "SELECT, WHERE, ORDER BY, and LIMIT. Write queries against a sample shop database.\n\n"
            "03 · Aggregation · Week 3\n"
            "COUNT, SUM, GROUP BY, and HAVING. Build a simple sales report.\n\n"
            "04 · Joining data · Weeks 4–5\n"
            "INNER and LEFT JOIN, keys, and NULL values. Combine customers and orders.\n\n"
            "05 · Advanced SQL · Week 6\n"
            "Subqueries, common table expressions, and window functions. Finish with a small analysis project.\n\n"
            "Practice tip: spend more time writing queries than reading about them."
        )

    if mode == "summarize":
        sentences = re.split(r"(?<=[.!?])\s+", prompt.strip())
        selected = [sentence.strip() for sentence in sentences if sentence.strip()]
        if len(selected) > 4:
            selected = selected[:2] + selected[-2:]
        if selected:
            return "Key points\n" + "\n".join(f"• {sentence}" for sentence in selected)

    if mode == "quiz":
        subject = prompt.strip().rstrip("?.!")
        return (
            f"Quick quiz · {subject}\n\n"
            f"1. What is one key idea or definition related to {subject}?\n"
            f"2. How would you explain {subject} in your own words?\n"
            f"3. What is a real-world example of {subject}?\n"
            f"4. What is a common misconception about {subject}?\n"
            f"5. What question would you ask to explore {subject} further?\n\n"
            "Answer key: Check your responses against your notes or course materials."
        )

    if mode == "path":
        return (
            f"A practical path for {prompt.strip()} starts with the core vocabulary and concepts, "
            "then moves to guided exercises, independent projects, and advanced applications. "
            "Allow about 1–2 weeks per stage, and finish each stage by explaining what you learned "
            "or building something small with it."
        )

    if mode == "explain":
        return (
            f"Start with the basic idea: {prompt.strip()} is a concept you can understand by "
            "breaking it into smaller parts and connecting each part to something familiar. "
            "Try describing it in one sentence, then find a simple example that shows how it works. "
            "For a more precise explanation, ask about a specific part of the topic."
        )

    return (
        f"A good starting point for {prompt.strip()} is to identify its central idea, then look at "
        "one concrete example. Ask a follow-up about any part that feels unclear, and I can unpack it."
    )


def _cloud_response(mode: str, prompt: str, level: str) -> str | None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    payload = {
        "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        "messages": [
            {"role": "system", "content": f"{SYSTEM_PROMPTS[mode]} The learner's level is {level}."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.5,
    }
    request = Request(
        f"{base_url}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=45) as response:
            result = json.loads(response.read())
        return result["choices"][0]["message"]["content"]
    except (HTTPError, URLError, TimeoutError, KeyError, IndexError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=502, detail="The configured AI provider could not complete this request.") from error


@app.get("/")
def home():
    return FileResponse(ROOT / "static" / "index.html")


@app.get("/api/health")
def health():
    return {"status": "ok", "provider": "cloud" if os.getenv("OPENAI_API_KEY") else "local"}


@app.post("/api/study")
def study(request: StudyRequest):
    result = _cloud_response(request.mode, request.prompt, request.level)
    return {"answer": result or _local_response(request.mode, request.prompt), "provider": "cloud" if result else "local"}