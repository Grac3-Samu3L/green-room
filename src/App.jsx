import React, { useState, useRef, useEffect } from "react";
import { Mic, ArrowRight, RotateCcw, CheckCircle2, AlertCircle, Sparkles, Play } from "lucide-react";

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,500&family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap');
`;

const TOKENS = {
  bg: "#14181F",
  bgPanel: "#1B212C",
  bgCard: "#1F2635",
  text: "#EDEAE3",
  textMuted: "#8D96A8",
  accent: "#C9A227",
  accentSoft: "rgba(201,162,39,0.14)",
  good: "#5C9484",
  goodSoft: "rgba(92,148,132,0.14)",
  warn: "#B25C46",
  warnSoft: "rgba(178,92,70,0.14)",
  border: "#2A3140",
};

const ROLE_PRESETS = [
  "Data Analyst Intern",
  "Software Engineer Intern",
  "IT Support Specialist",
  "Business Intelligence Analyst",
];

async function callClaude(messages, system) {
  const response = await fetch("http://localhost:3001/api/claude" , {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system,
      messages,
    }),
  });
  const data = await response.json(); return data.text || "";
}

function parseJsonLoose(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function Waveform({ active }) {
  const bars = 24;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 28 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 3,
            borderRadius: 2,
            background: active ? TOKENS.accent : TOKENS.border,
            height: active ? `${8 + ((i * 37) % 20)}px` : "6px",
            animation: active ? `pulse${i % 4} 900ms ease-in-out infinite` : "none",
            animationDelay: `${i * 40}ms`,
            transition: "background 300ms, height 300ms",
          }}
        />
      ))}
    </div>
  );
}

function ScoreDial({ score }) {
  const pct = (score / 5) * 100;
  const color = score >= 4 ? TOKENS.good : score >= 3 ? TOKENS.accent : TOKENS.warn;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: "50%",
          background: `conic-gradient(${color} ${pct}%, ${TOKENS.border} ${pct}%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: TOKENS.bgCard,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 600,
            fontSize: 14,
            color: TOKENS.text,
          }}
        >
          {score}
        </div>
      </div>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: TOKENS.textMuted, letterSpacing: 0.5 }}>
        OUT OF 5
      </span>
    </div>
  );
}

export default function GreenRoom() {
  const [stage, setStage] = useState("setup"); // setup | session
  const [role, setRole] = useState("");
  const [mode, setMode] = useState("Behavioral");
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [history, setHistory] = useState([]); // {question, answer, feedback}
  const [qNumber, setQNumber] = useState(0);
  const [error, setError] = useState("");
  const textareaRef = useRef(null);

  const targetRole = role.trim() || "Software/IT internship";

  async function startSession() {
    setStage("session");
    await fetchQuestion([]);
  }

  async function fetchQuestion(pastHistory) {
    setLoadingQuestion(true);
    setError("");
    setFeedback(null);
    setAnswer("");
    try {
      const historyNote =
        pastHistory.length > 0
          ? `Prior questions asked this session: ${pastHistory.map((h) => h.question).join(" | ")}. Do not repeat these.`
          : "This is the first question of the session.";
      const system = `You are an experienced technical interviewer preparing a candidate for a ${targetRole} role. Ask exactly one ${mode.toLowerCase()} interview question, realistic for that role and appropriate for an early-career candidate. Respond with ONLY the question text, no preamble, no numbering, no quotes.`;
      const text = await callClaude(
        [{ role: "user", content: historyNote + " Ask the next question." }],
        system
      );
      setQuestion(text.trim());
      setQNumber((n) => n + 1);
    } catch (e) {
      setError("Couldn't reach the interviewer. Check your connection and try again.");
    } finally {
      setLoadingQuestion(false);
    }
  }

  async function submitAnswer() {
    if (!answer.trim()) return;
    setLoadingFeedback(true);
    setError("");
    try {
      const system = `You are a warm but honest interview coach evaluating one answer to one interview question for a ${targetRole} candidate. Respond with ONLY valid JSON, no markdown fences, no preamble, in this exact shape: {"score": <integer 1-5>, "strength": "<one sentence, specific to their answer>", "improve": "<one sentence, specific and actionable>", "followup": "<a short natural follow-up question a real interviewer might ask next, based on their answer>"}`;
      const userMsg = `Question: ${question}\n\nCandidate's answer: ${answer}`;
      const text = await callClaude([{ role: "user", content: userMsg }], system);
      const parsed = parseJsonLoose(text);
      if (!parsed) throw new Error("parse failed");
      setFeedback(parsed);
      setHistory((h) => [...h, { question, answer, feedback: parsed }]);
    } catch (e) {
      setError("Couldn't score that answer. Try submitting again.");
    } finally {
      setLoadingFeedback(false);
    }
  }

  function nextQuestion() {
    fetchQuestion(history);
  }

  function resetSession() {
    setStage("setup");
    setHistory([]);
    setQNumber(0);
    setFeedback(null);
    setQuestion("");
    setAnswer("");
    setError("");
  }

  const avgScore =
    history.length > 0
      ? (history.reduce((s, h) => s + (h.feedback?.score || 0), 0) / history.length).toFixed(1)
      : null;

  return (
    <div
      style={{
        minHeight: "100%",
        background: TOKENS.bg,
        color: TOKENS.text,
        fontFamily: "'Space Grotesk', sans-serif",
        padding: "32px 20px",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        ${FONT_IMPORT}
        @keyframes pulse0 { 0%,100% { height: 6px; } 50% { height: 22px; } }
        @keyframes pulse1 { 0%,100% { height: 10px; } 50% { height: 26px; } }
        @keyframes pulse2 { 0%,100% { height: 14px; } 50% { height: 20px; } }
        @keyframes pulse3 { 0%,100% { height: 8px; } 50% { height: 24px; } }
        .gr-textarea:focus, .gr-input:focus, .gr-btn:focus-visible {
          outline: 2px solid ${TOKENS.accent};
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>

      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                letterSpacing: 2,
                color: TOKENS.accent,
                marginBottom: 4,
              }}
            >
              MOCK INTERVIEW
            </div>
            <h1
              style={{
                fontFamily: "'Fraunces', serif",
                fontStyle: "italic",
                fontWeight: 500,
                fontSize: 32,
                margin: 0,
              }}
            >
              Green Room
            </h1>
          </div>
          {stage === "session" && (
            <button
              onClick={resetSession}
              className="gr-btn"
              style={{
                background: "transparent",
                border: `1px solid ${TOKENS.border}`,
                color: TOKENS.textMuted,
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 12,
                fontFamily: "'IBM Plex Mono', monospace",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <RotateCcw size={13} /> New session
            </button>
          )}
        </div>

        {stage === "setup" && (
          <div
            style={{
              background: TOKENS.bgPanel,
              border: `1px solid ${TOKENS.border}`,
              borderRadius: 16,
              padding: 28,
            }}
          >
            <p style={{ color: TOKENS.textMuted, fontSize: 14, lineHeight: 1.6, marginTop: 0 }}>
              A live rehearsal space. Set your target role, get one question at a time, and get scored,
              specific feedback before the follow-up question comes.
            </p>

            <label
              style={{
                display: "block",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                letterSpacing: 1,
                color: TOKENS.textMuted,
                marginTop: 20,
                marginBottom: 8,
              }}
            >
              TARGET ROLE
            </label>
            <input
              className="gr-input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Data Analyst Intern"
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: TOKENS.bgCard,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: 10,
                padding: "12px 14px",
                color: TOKENS.text,
                fontSize: 15,
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {ROLE_PRESETS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className="gr-btn"
                  style={{
                    background: TOKENS.accentSoft,
                    border: `1px solid ${TOKENS.border}`,
                    color: TOKENS.accent,
                    borderRadius: 999,
                    padding: "6px 12px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>

            <label
              style={{
                display: "block",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                letterSpacing: 1,
                color: TOKENS.textMuted,
                marginTop: 22,
                marginBottom: 8,
              }}
            >
              QUESTION TYPE
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {["Behavioral", "Technical"].map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="gr-btn"
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: `1px solid ${mode === m ? TOKENS.accent : TOKENS.border}`,
                    background: mode === m ? TOKENS.accentSoft : "transparent",
                    color: mode === m ? TOKENS.accent : TOKENS.textMuted,
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {m}
                </button>
              ))}
            </div>

            <button
              onClick={startSession}
              className="gr-btn"
              style={{
                marginTop: 24,
                width: "100%",
                background: TOKENS.accent,
                border: "none",
                color: "#1B1508",
                borderRadius: 10,
                padding: "13px 16px",
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "'Space Grotesk', sans-serif",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Play size={15} /> Start rehearsal
            </button>
          </div>
        )}

        {stage === "session" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: TOKENS.textMuted }}>
                {targetRole} · {mode} · Q{qNumber}
              </span>
              {avgScore && (
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: TOKENS.accent }}>
                  avg score {avgScore}
                </span>
              )}
            </div>

            {/* Cue card */}
            <div
              style={{
                position: "relative",
                background: TOKENS.bgCard,
                border: `1px solid ${TOKENS.border}`,
                borderRadius: 16,
                padding: 26,
                marginBottom: 18,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: 0,
                  height: 0,
                  borderStyle: "solid",
                  borderWidth: "0 28px 28px 0",
                  borderColor: `transparent ${TOKENS.accentSoft} transparent transparent`,
                }}
              />
              {loadingQuestion ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, color: TOKENS.textMuted, fontSize: 14 }}>
                  <Waveform active={true} />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>preparing question…</span>
                </div>
              ) : (
                <p
                  style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: 21,
                    lineHeight: 1.5,
                    margin: 0,
                    paddingRight: 10,
                  }}
                >
                  {question}
                </p>
              )}
            </div>

            {!feedback && !loadingQuestion && (
              <div>
                <textarea
                  ref={textareaRef}
                  className="gr-textarea"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer as you'd say it out loud…"
                  rows={6}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    background: TOKENS.bgPanel,
                    border: `1px solid ${TOKENS.border}`,
                    borderRadius: 12,
                    padding: 16,
                    color: TOKENS.text,
                    fontSize: 14,
                    fontFamily: "'Space Grotesk', sans-serif",
                    resize: "vertical",
                    lineHeight: 1.6,
                  }}
                />
                <button
                  onClick={submitAnswer}
                  disabled={!answer.trim() || loadingFeedback}
                  className="gr-btn"
                  style={{
                    marginTop: 12,
                    background: answer.trim() ? TOKENS.accent : TOKENS.border,
                    border: "none",
                    color: answer.trim() ? "#1B1508" : TOKENS.textMuted,
                    borderRadius: 10,
                    padding: "12px 18px",
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "'Space Grotesk', sans-serif",
                    cursor: answer.trim() ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {loadingFeedback ? (
                    <>
                      <Waveform active={true} /> scoring…
                    </>
                  ) : (
                    <>
                      <Mic size={14} /> Submit answer
                    </>
                  )}
                </button>
              </div>
            )}

            {feedback && (
              <div
                style={{
                  background: TOKENS.bgPanel,
                  border: `1px solid ${TOKENS.border}`,
                  borderRadius: 14,
                  padding: 22,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, color: TOKENS.textMuted }}>
                    FEEDBACK
                  </span>
                  <ScoreDial score={feedback.score} />
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                  <CheckCircle2 size={16} color={TOKENS.good} style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: TOKENS.text }}>{feedback.strength}</p>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 18 }}>
                  <AlertCircle size={16} color={TOKENS.warn} style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: TOKENS.text }}>{feedback.improve}</p>
                </div>

                <div
                  style={{
                    background: TOKENS.accentSoft,
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 18,
                    display: "flex",
                    gap: 10,
                  }}
                >
                  <Sparkles size={16} color={TOKENS.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: TOKENS.text }}>
                    <span style={{ color: TOKENS.accent, fontWeight: 600 }}>Likely follow-up: </span>
                    {feedback.followup}
                  </p>
                </div>

                <button
                  onClick={nextQuestion}
                  className="gr-btn"
                  style={{
                    width: "100%",
                    background: TOKENS.accent,
                    border: "none",
                    color: "#1B1508",
                    borderRadius: 10,
                    padding: "12px 16px",
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "'Space Grotesk', sans-serif",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  Next question <ArrowRight size={14} />
                </button>
              </div>
            )}

            {error && (
              <p style={{ color: TOKENS.warn, fontSize: 13, marginTop: 12, fontFamily: "'IBM Plex Mono', monospace" }}>
                {error}
              </p>
            )}

            {history.length > 0 && (
              <div style={{ marginTop: 30 }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, color: TOKENS.textMuted }}>
                  SESSION LOG
                </span>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {history.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        border: `1px solid ${TOKENS.border}`,
                        borderRadius: 10,
                        padding: "10px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span style={{ fontSize: 13, color: TOKENS.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        Q{i + 1}. {h.question}
                      </span>
                      <span
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: 12,
                          color: h.feedback.score >= 4 ? TOKENS.good : h.feedback.score >= 3 ? TOKENS.accent : TOKENS.warn,
                          flexShrink: 0,
                        }}
                      >
                        {h.feedback.score}/5
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
