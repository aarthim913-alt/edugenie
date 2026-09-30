const form = document.querySelector("#study-form");
const promptField = document.querySelector("#study-prompt");
const levelField = document.querySelector("#study-level");
const submitButton = document.querySelector(".submit-button");
const submitLabel = document.querySelector(".submit-label");
const resultPanel = document.querySelector("#result-panel");
const resultContent = document.querySelector("#result-content");
const resultTitle = document.querySelector("#result-title");
const providerLabel = document.querySelector("#provider-label");
const modeTabs = [...document.querySelectorAll(".mode-tab")];
let activeMode = "ask";
let lastAnswer = "";

const modeDetails = {
  ask: { placeholder: "Ask a question, name a topic, or paste your notes…", button: "Ask away", title: "Here's what I found" },
  explain: { placeholder: "What would you like explained in plain language?", button: "Make it simple", title: "Let's break it down" },
  quiz: { placeholder: "Pick a topic for your quiz, like the Pythagorean theorem…", button: "Make a quiz", title: "Your quiz is ready" },
  path: { placeholder: "What do you want to learn? Try SQL, biology, or world history…", button: "Build my path", title: "A path to get you there" },
  summarize: { placeholder: "Paste a passage or your study notes here…", button: "Make a summary", title: "The big ideas" },
};

function updateRecommendations(mode, prompt, level) {
  const topic = prompt.replace(/\s+/g, " ").trim().replace(/[?.!]+$/, "");
  const subject = topic.length > 35 ? `${topic.slice(0, 32).trimEnd()}…` : topic;
  const detail = `${topic} for a ${level} learner`;
  const suggestions = {
    ask: [
      { category: "GO A LITTLE DEEPER", title: `Get a simpler explanation of ${subject}`, action: "Make it click", mode: "explain", prompt: `Explain ${detail} with a simple analogy and example.` },
      { category: "CHECK YOURSELF", title: `See what you remember about ${subject}`, action: "Try a quick quiz", mode: "quiz", prompt: `Make a quiz about ${detail}.` },
      { category: "MAKE A CONNECTION", title: `Connect ${subject} to everyday life`, action: "Find an example", mode: "ask", prompt: `Give me a real-world example of ${detail}.` },
    ],
    explain: [
      { category: "PUT IT INTO PRACTICE", title: `Try a quick check on ${subject}`, action: "Test your understanding", mode: "quiz", prompt: `Create a short quiz about ${detail}.` },
      { category: "EXPLORE FURTHER", title: `See where ${subject} shows up`, action: "Find an example", mode: "ask", prompt: `Give me a useful real-world example of ${detail}.` },
      { category: "KEEP GOING", title: `Build on your understanding of ${subject}`, action: "Map the next steps", mode: "path", prompt: `Create a learning path for ${detail}.` },
    ],
    quiz: [
      { category: "REVIEW", title: `Revisit the key ideas in ${subject}`, action: "Get a refresher", mode: "explain", prompt: `Explain the most important ideas in ${detail}.` },
      { category: "ANOTHER ROUND", title: `Practice ${subject} once more`, action: "Make another quiz", mode: "quiz", prompt: `Make a new quiz about ${detail} with different questions.` },
      { category: "GO DEEPER", title: `Explore the next level of ${subject}`, action: "Build a learning path", mode: "path", prompt: `Create a beginner-to-advanced path for ${detail}.` },
    ],
    path: [
      { category: "YOUR FIRST MILESTONE", title: `Get started with ${subject}`, action: "Explore the basics", mode: "explain", prompt: `Explain the essential foundations of ${detail}.` },
      { category: "CHECKPOINT", title: `See what you know so far`, action: "Test the basics", mode: "quiz", prompt: `Make a beginner quiz about ${detail}.` },
      { category: "MAKE IT PRACTICAL", title: `Try a small project with ${subject}`, action: "Get project ideas", mode: "ask", prompt: `Suggest a small hands-on project for learning ${detail}.` },
    ],
    summarize: [
      { category: "ACTIVE RECALL", title: "Turn these ideas into a quick quiz", action: "Check what stuck", mode: "quiz", prompt: `Create a quiz to help me remember these ideas: ${topic}` },
      { category: "CLEAR UP A DETAIL", title: `Unpack a concept from ${subject}`, action: "Explain it simply", mode: "explain", prompt: `Explain the key concepts in ${detail}.` },
      { category: "FOLLOW YOUR CURIOSITY", title: "Explore the next question", action: "Find a connection", mode: "ask", prompt: `What is one interesting follow-up question about ${detail}?` },
    ],
  }[mode];

  document.querySelectorAll(".idea-card").forEach((card, index) => {
    const suggestion = suggestions[index];
    card.dataset.mode = suggestion.mode;
    card.dataset.prompt = suggestion.prompt;
    card.querySelector(".idea-category").textContent = suggestion.category;
    card.querySelector("strong").textContent = suggestion.title;
    card.querySelector(".idea-action").childNodes[0].nodeValue = `${suggestion.action} `;
  });
}

function setMode(mode) {
  if (!modeDetails[mode]) return;
  activeMode = mode;
  modeTabs.forEach((tab) => {
    const selected = tab.dataset.mode === mode;
    tab.classList.toggle("selected", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
  document.querySelectorAll(".nav-item[data-mode]").forEach((item) => {
    item.classList.toggle("active", item.dataset.mode === mode);
  });
  promptField.placeholder = modeDetails[mode].placeholder;
  submitLabel.textContent = modeDetails[mode].button;
}

document.querySelectorAll("[data-mode]").forEach((item) => {
  item.addEventListener("click", () => {
    setMode(item.dataset.mode);
    if (item.dataset.prompt) promptField.value = item.dataset.prompt;
    promptField.focus({ preventScroll: true });
    document.querySelector(".study-panel").scrollIntoView({ behavior: "smooth", block: "center" });
  });
});

document.querySelectorAll("[data-prompt]:not([data-mode])").forEach((item) => {
  item.addEventListener("click", () => {
    promptField.value = item.dataset.prompt;
    promptField.focus();
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const prompt = promptField.value.trim();
  if (!prompt) {
    promptField.focus();
    return;
  }

  submitButton.disabled = true;
  submitLabel.textContent = "Thinking…";
  submitButton.classList.add("visually-busy");
  resultPanel.hidden = false;
  resultTitle.textContent = "Putting the pieces together…";
  resultContent.textContent = "A little curiosity, coming right up.";
  resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });

  try {
    const response = await fetch("/api/study", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: activeMode, prompt, level: levelField.value }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Something went wrong. Please try again.");
    lastAnswer = data.answer;
    resultTitle.textContent = modeDetails[activeMode].title;
    resultContent.textContent = data.answer;
    providerLabel.textContent = data.provider === "cloud" ? "AI study mode" : "Local study mode";
    updateRecommendations(activeMode, prompt, levelField.value);
  } catch (error) {
    resultTitle.textContent = "Let's try that again";
    resultContent.textContent = error.message || "EduGenie couldn't reach the study service. Check that the server is running and try again.";
  } finally {
    submitButton.disabled = false;
    submitLabel.textContent = modeDetails[activeMode].button;
    submitButton.classList.remove("visually-busy");
  }
});

document.querySelector("#copy-button").addEventListener("click", async (event) => {
  if (!lastAnswer) return;
  const button = event.currentTarget;
  try {
    await navigator.clipboard.writeText(lastAnswer);
    button.title = "Copied";
    button.setAttribute("aria-label", "Answer copied");
    window.setTimeout(() => {
      button.title = "Copy answer";
      button.setAttribute("aria-label", "Copy answer");
    }, 1500);
  } catch {
    resultContent.focus?.();
  }
});

document.querySelector("#followup-button").addEventListener("click", () => {
  setMode("ask");
  promptField.value = "";
  promptField.focus();
  document.querySelector(".study-panel").scrollIntoView({ behavior: "smooth", block: "center" });
});

document.querySelector("[data-nav='home']").addEventListener("click", () => {
  setMode("ask");
  promptField.value = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
}).format(new Date());

fetch("/api/health")
  .then((response) => response.ok ? response.json() : null)
  .then((data) => {
    if (data?.provider === "cloud") providerLabel.textContent = "AI study mode";
  })
  .catch(() => {});