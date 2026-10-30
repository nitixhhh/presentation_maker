"use client";
import V3DeckViewer from "@/components/V3DeckViewer";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers,
  Terminal,
  Activity,
  CheckCircle2,
  Cpu,
  ArrowRight,
  RotateCcw,
} from "lucide-react";

interface AgentLog {
  agent: string;
  action: string;
  provider?: string;
  model?: string;
  timestamp: string;
}

const SURPRISE_TOPICS = [
  {
    topic: "Autonomous AI Agents in Enterprise: 2026 Production Blueprint",
    audience: "Tech Founders & Engineering Leaders",
    tone: "Visionary, Practical & Strategic",
    language: "English" as const,
    visualStyle: "modern-dark" as const,
  },
  {
    topic: "India's Tech Renaissance 2030: Startups, AI & Scalable Infrastructure",
    audience: "Founders, Investors & Policy Leaders",
    tone: "High-Energy, Data-Driven & Optimistic",
    language: "Hinglish" as const,
    visualStyle: "vibrant-gradient" as const,
  },
  {
    topic: "Zero-Knowledge Cryptography: Mathematical Privacy at Scale",
    audience: "Software Engineers & Security Architects",
    tone: "Deep Technical, Authoritative & Rigorous",
    language: "English" as const,
    visualStyle: "tech-cyber" as const,
  },
  {
    topic: "Design Systems that Scale: From Design Tokens to React Production",
    audience: "Product Designers & Frontend Leads",
    tone: "Aesthetic, Practical & Actionable",
    language: "English" as const,
    visualStyle: "editorial-clean" as const,
  },
];

export default function Home() {
  // Mode Selection: Admin Direct Mode (Default, Free & Instant)
  const [isAdminMode, setIsAdminMode] = useState(true);

  // Form State
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("General audience");
  const [tone, setTone] = useState("Professional & Engaging");
  const [slideCount, setSlideCount] = useState(4);
  const [language, setLanguage] = useState<"English" | "Hindi" | "Hinglish">("English");
  const [visualStyle, setVisualStyle] = useState("modern-dark");
  const [imageSource, setImageSource] = useState<"stock" | "ai" | "none">("stock");
  // Engine v3 (AI-designed slides) — default engine; v2 kept for comparison
  const [engine, setEngine] = useState<"v3" | "v2">("v3");
  const [presenter, setPresenter] = useState({ names: "", rollNo: "", department: "", institute: "", guide: "", course: "" });
  const [formatNotes, setFormatNotes] = useState("");
  const [toggles, setToggles] = useState({
    charts: true,
    diagrams: true,
    codeBlocks: false,
    icons: true,
    speakerNotes: true,
  });

  // UI Flow State
  const [currentStep, setCurrentStep] = useState<"options" | "generating" | "completed">("options");

  // Real-Time Agent Stream State
  const [generationPercent, setGenerationPercent] = useState(0);
  const [currentStage, setCurrentStage] = useState("Initializing...");
  const [currentDetails, setCurrentDetails] = useState("");
  const [activeAgent, setActiveAgent] = useState<string>("Owner");
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Deck Viewer State
  const [deck, setDeck] = useState<any>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [viewMode, setViewMode] = useState<"card" | "slideshow">("card");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sync iframe slide on navigation
  useEffect(() => {
    if (viewMode === "slideshow" && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "GOTO_SLIDE", index: activeSlideIndex },
        "*"
      );
    }
  }, [activeSlideIndex, viewMode]);

  // Auto-scroll terminal logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [agentLogs]);

  // Surprise Me Handler
  const handleSurpriseMe = () => {
    const randomPick = SURPRISE_TOPICS[Math.floor(Math.random() * SURPRISE_TOPICS.length)];
    setTopic(randomPick.topic);
    setAudience(randomPick.audience);
    setTone(randomPick.tone);
    setLanguage(randomPick.language);
    setVisualStyle(randomPick.visualStyle);
    setSlideCount(4);
  };

  // Start Generation via Streaming API (Real-Time Live LLM Logs)
  const startStreamGeneration = async () => {
    if (!topic.trim()) return;

    setCurrentStep("generating");
    setGenerationPercent(5);
    setCurrentStage("Starting Autonomous Agent Pipeline...");
    setCurrentDetails(`Topic: "${topic}"`);
    setActiveAgent("Owner");
    setAgentLogs([
      {
        agent: "Owner",
        action: `Pipeline started for "${topic}". Spawning specialized sub-agents...`,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
    setErrorMessage(null);

    try {
      const response = await fetch(engine === "v3" ? "/api/v3/generate" : "/api/pipeline/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presenter,
          formatNotes,
          topic,
          audience,
          tone,
          slideCount,
          language,
          visualStyle,
          imageSource,
          toggles,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Streaming failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("ReadableStream not supported");

      const decoder = new TextDecoder();
      let buffer = "";
      let gotComplete = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const eventStr of events) {
          const lines = eventStr.split("\n");
          let eventType = "message";
          let eventData = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.replace("event: ", "").trim();
            } else if (line.startsWith("data: ")) {
              eventData = line.replace("data: ", "").trim();
            }
          }

          if (!eventData) continue;

          let streamError: string | null = null;
          try {
            const parsed = JSON.parse(eventData);

            if (eventType === "progress") {
              if (parsed.percent) setGenerationPercent(parsed.percent);
              if (parsed.step) setCurrentStage(parsed.step);
              if (parsed.details) setCurrentDetails(parsed.details);
              if (parsed.log) {
                setActiveAgent(parsed.log.agent);
                setAgentLogs((prev) => [...prev, parsed.log]);
              }
            } else if (eventType === "complete") {
              setGenerationPercent(100);
              setCurrentStage("Presentation Generated Successfully!");
              setDeck(parsed.deck);
              setActiveSlideIndex(0);
              setTimeout(() => {
                setCurrentStep("completed");
              }, 1200);
            }
            if (eventType === "complete") gotComplete = true;
            if (eventType === "error") streamError = parsed.message || "Generation failed";
          } catch (e: any) {
            console.warn("Parse stream chunk error:", e);
          }
          // A server-side error must reach the user (it used to be swallowed by the parse catch above).
          if (streamError) throw new Error(streamError);
        }
      }
      if (!gotComplete) {
        throw new Error("Connection to the server was lost before the deck finished (on a phone, keep the screen on and this tab open while it generates). Please try again.");
      }
    } catch (err: any) {
      console.error("Stream generation error:", err);
      setErrorMessage(err.message || "Failed to generate presentation");
      setAgentLogs((prev) => [
        ...prev,
        {
          agent: "Error",
          action: `Generation failed: ${err.message}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    }
  };

  // Export File Download
  const handleExport = async (format: "pptx" | "html" | "pdf") => {
    if (!deck) return;
    try {
      const res = await fetch("/api/pipeline/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deck, format }),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${deck.topic.replace(/[^a-z0-9]/gi, "_")}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Export error: ${e.message}`);
    }
  };

  const agentSteps = [
    { name: "Researcher", label: "Research", icon: "🔍", model: "gemini-2.5-flash" },
    { name: "ArtDirector", label: "Design DNA", icon: "🎨", model: "gemini-2.5-flash" },
    { name: "SlideWriter", label: "Copywriting", icon: "✍️", model: "gemini-2.5-flash" },
    { name: "DiagramCodeSpecialist", label: "Visuals", icon: "📊", model: "openai/gpt-oss-120b" },
    { name: "PlaywrightQA", label: "QA Engine", icon: "🛡️", model: "Playwright Chromium" },
  ];

  return (
    <div className="min-h-screen bg-[#FBF8F3] text-[#1F1E1D] font-sans antialiased">
      {/* Top Header */}
      <header className="border-b border-[#E8E2D5] bg-[#FBF8F3]/90 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#C15B3E] text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-serif font-bold text-lg tracking-tight text-[#1F1E1D] whitespace-nowrap">
                DeckCraft{" "}
                <span className="hidden sm:inline font-sans font-normal text-xs text-[#A8A299] tracking-normal">
                  AI Studio
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-xs font-medium whitespace-nowrap">
            <div className="flex items-center gap-2 bg-[#F3EDE2] border border-[#E4DDD0] px-2.5 sm:px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#1B7A3E] animate-pulse" />
              <span className="text-[#3A3834] font-medium">
                {isAdminMode ? <>Admin<span className="hidden sm:inline"> Direct Mode</span></> : "User Mode (₹20)"}
              </span>
            </div>

            <button
              onClick={() => setIsAdminMode(!isAdminMode)}
              className="text-xs px-2.5 sm:px-3 py-1.5 rounded-xl bg-white border border-[#E0D8CB] hover:bg-[#F3EDE2] text-[#736F68] hover:text-[#1F1E1D]"
            >
              <span className="hidden sm:inline">Toggle </span>Mode
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-6 py-10 md:py-16">
        {/* STEP 1: OPTIONS FORM */}
        {currentStep === "options" && (
          <div className="space-y-10 animate-slideUp">
            {/* Hero Section */}
            <div className="text-center space-y-5">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F2ECE1] border border-[#E3DBD0] text-[#736F68] text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C15B3E]" />
                Multi-Agent AI Engine • Cinematic Layouts
              </div>
              <h1 className="font-serif text-4xl md:text-[3.5rem] text-[#1F1E1D] tracking-tight font-normal leading-[1.1]">
                Your ideas,{" "}
                <span className="italic text-[#C15B3E]">beautifully presented.</span>
              </h1>
              <p className="text-base text-[#736F68] max-w-lg mx-auto leading-relaxed">
                AI-powered presentation studio. Research, design, and storytelling — automated.
              </p>
            </div>

            {/* Customization Card */}
            <div className="bg-white border border-[#E8E2D5] rounded-3xl p-6 md:p-10 shadow-[0_2px_20px_rgba(0,0,0,0.04)] space-y-7">
              <div className="flex items-center justify-between border-b border-[#F0EBE0] pb-5">
                <h2 className="text-base font-semibold text-[#1F1E1D] flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-[#C15B3E]" /> Presentation Options
                </h2>
                <button
                  type="button"
                  onClick={handleSurpriseMe}
                  className="px-4 py-2 rounded-2xl bg-[#FBF8F3] hover:bg-[#F3ECE1] text-[#C15B3E] border border-[#E5DEC9] text-xs font-semibold flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Surprise Me!
                </button>
              </div>

              {/* Topic Input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#736F68] mb-2">
                  Presentation Topic / Brief *
                </label>
                <textarea
                  rows={3}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Next-Gen Autonomous AI Agents: Multi-Provider Routing & Industrial Impact..."
                  className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-2xl px-4 py-3.5 text-sm text-[#1F1E1D] placeholder:text-[#B8B2A6] focus:outline-none focus:border-[#C15B3E] focus:ring-1 focus:ring-[#C15B3E]/20 resize-none"
                />
              </div>

              {/* Audience & Tone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#736F68] mb-2">
                    Target Audience
                  </label>
                  <input
                    type="text"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="e.g. Founders, Executives, Engineers, Students"
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-2xl px-4 py-3 text-sm text-[#1F1E1D] focus:outline-none focus:border-[#C15B3E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#736F68] mb-2">
                    Tone & Voice
                  </label>
                  <input
                    type="text"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    placeholder="e.g. Visionary, Analytical, High-Energy"
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-2xl px-4 py-3 text-sm text-[#1F1E1D] focus:outline-none focus:border-[#C15B3E]"
                  />
                </div>
              </div>

              {/* Slide Count, Language, Visual Style */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#736F68] mb-2">
                    Slide Count ({slideCount})
                  </label>
                  <input
                    type="range"
                    min={3}
                    max={8}
                    value={slideCount}
                    onChange={(e) => setSlideCount(parseInt(e.target.value, 10))}
                    className="w-full mt-2"
                  />
                  <div className="flex justify-between text-[11px] text-[#A8A299] mt-1.5 font-mono">
                    <span>3 slides</span>
                    <span>8 slides</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#736F68] mb-2">
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as any)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-2xl px-3 py-3 text-sm text-[#1F1E1D] focus:outline-none focus:border-[#C15B3E] appearance-none cursor-pointer"
                  >
                    <option value="English">English</option>
                    <option value="Hindi">Hindi (हिन्दी)</option>
                    <option value="Hinglish">Hinglish (Hindi + English mix)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#736F68] mb-2">
                    Visual Style / Design DNA
                  </label>
                  <select
                    value={visualStyle}
                    onChange={(e) => setVisualStyle(e.target.value)}
                    className="w-full bg-[#FAF7F2] border border-[#E5DEC9] rounded-2xl px-3 py-3 text-sm text-[#1F1E1D] focus:outline-none focus:border-[#C15B3E] appearance-none cursor-pointer"
                  >
                    <option value="modern-dark">Modern Dark (Cyber Obsidian)</option>
                    <option value="editorial-clean">Editorial Clean (Cream & Sand)</option>
                    <option value="vibrant-gradient">Vibrant Gradient (High Contrast)</option>
                    <option value="corporate-sleek">Corporate Sleek (Executive Navy)</option>
                    <option value="minimal-zen">Minimal Zen (Monochrome)</option>
                    <option value="tech-cyber">Tech Cyber (Neon Indigo)</option>
                    <option value="warm-earthy">Warm Earthy (Terracotta)</option>
                  </select>
                </div>
              </div>

              {/* Rich Component Toggles */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#736F68] mb-3">
                  Visual Components
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { key: "charts", label: "ECharts Data Visuals" },
                    { key: "diagrams", label: "Mermaid Architecture" },
                    { key: "codeBlocks", label: "Syntax Code Block" },
                    { key: "icons", label: "Curated Icons" },
                    { key: "speakerNotes", label: "Presenter Notes" },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center gap-2.5 bg-[#FAF7F2] border border-[#EAE3D6] px-3.5 py-3 rounded-2xl cursor-pointer hover:border-[#D9CFBE]"
                    >
                      <input
                        type="checkbox"
                        checked={(toggles as any)[item.key]}
                        onChange={(e) =>
                          setToggles({ ...toggles, [item.key]: e.target.checked })
                        }
                        className="w-4 h-4 rounded accent-[#C15B3E]"
                      />
                      <span className="text-xs font-medium text-[#2E2C29]">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Engine v3: academic details + format */}
              <div className="space-y-4 border-t border-[#F0EBE0] pt-6">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#736F68]">Engine</label>
                  <div className="flex items-center bg-[#F2ECE1] p-1 rounded-2xl border border-[#E3DBD0]">
                    {(["v3", "v2"] as const).map((e) => (
                      <button key={e} type="button" onClick={() => setEngine(e)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${engine === e ? "bg-white text-[#1F1E1D] shadow-sm" : "text-[#736F68]"}`}>
                        {e === "v3" ? "v3 · AI designer" : "v2 · layouts"}
                      </button>
                    ))}
                  </div>
                </div>
                {engine === "v3" && (
                  <>
                    <p className="text-xs text-[#736F68]">Title-slide details (optional — printed exactly as typed, never invented)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {([
                        ["names", "Presented by (names)"],
                        ["rollNo", "Roll / Registration no."],
                        ["department", "Department"],
                        ["institute", "University / College"],
                        ["guide", "Guide (name, designation)"],
                        ["course", "Course & semester"],
                      ] as const).map(([k, label]) => (
                        <input key={k} value={(presenter as any)[k]} placeholder={label}
                          onChange={(e) => setPresenter({ ...presenter, [k]: e.target.value })}
                          className="w-full bg-[#FAF7F2] border border-[#EAE3D6] rounded-2xl px-4 py-3 text-sm text-[#1F1E1D] focus:outline-none focus:border-[#C15B3E]" />
                      ))}
                    </div>
                    <textarea rows={3} value={formatNotes} onChange={(e) => setFormatNotes(e.target.value)}
                      placeholder="University / teacher format (optional): e.g. 'Slides: Introduction, Objectives, Methodology, Results, Conclusion, References. IEEE references. Logo top-right.'"
                      className="w-full bg-[#FAF7F2] border border-[#EAE3D6] rounded-2xl px-4 py-3 text-sm text-[#1F1E1D] focus:outline-none focus:border-[#C15B3E]" />
                  </>
                )}
              </div>

              {errorMessage && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs">
                  {errorMessage}
                </div>
              )}

              {/* Primary Action Button */}
              <button
                type="button"
                onClick={startStreamGeneration}
                disabled={!topic.trim()}
                className="w-full bg-[#C15B3E] hover:bg-[#A84E34] disabled:opacity-40 text-white font-medium py-4 rounded-2xl shadow-[0_2px_12px_rgba(193,91,62,0.25)] hover:shadow-[0_4px_20px_rgba(193,91,62,0.35)] text-base flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <span>Generate Presentation</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: LIVE STREAM TERMINAL & PROGRESS */}
        {currentStep === "generating" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header Status Card */}
            <div className="bg-white border border-[#E8E2D5] rounded-3xl p-6 md:p-8 space-y-6 shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F0EBE0] pb-6">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#C15B3E] animate-ping" />
                    <h2 className="text-xl font-serif font-bold text-[#1F1E1D]">{currentStage}</h2>
                  </div>
                  <p className="text-xs text-[#736F68] mt-1 font-mono">{currentDetails}</p>
                </div>

                <div className="text-right flex items-center sm:flex-col gap-2 sm:gap-0 justify-between">
                  <span className="text-3xl font-black text-[#C15B3E] font-mono">
                    {generationPercent}%
                  </span>
                  <span className="text-[11px] text-[#A8A299] uppercase tracking-widest font-semibold">
                    Live Pipeline
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#F3EDE2] h-2.5 rounded-full overflow-hidden p-0.5">
                <div
                  className="bg-[#C15B3E] h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${generationPercent}%` }}
                />
              </div>

              {/* Active Sub-Agent Steps Indicator */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2">
                {agentSteps.map((s, idx) => {
                  const isActive = activeAgent.toLowerCase().includes(s.name.toLowerCase());
                  const isDone =
                    generationPercent >= (idx + 1) * 20 ||
                    (idx === 0 && generationPercent > 25) ||
                    (idx === 1 && generationPercent > 45) ||
                    (idx === 2 && generationPercent > 65) ||
                    (idx === 3 && generationPercent > 80) ||
                    (idx === 4 && generationPercent >= 95);

                  return (
                    <div
                      key={s.name}
                      className={`p-3 rounded-2xl border flex flex-col justify-between ${
                        isActive
                          ? "bg-[#FAF7F2] border-[#C15B3E] text-[#C15B3E] shadow-sm"
                          : isDone
                          ? "bg-[#F7FBF8] border-[#1B7A3E]/30 text-[#1B7A3E]"
                          : "bg-[#FAF8F5] border-[#E8E2D5] text-[#A8A299]"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span>{s.icon}</span>
                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#1B7A3E]" />
                        ) : isActive ? (
                          <Activity className="w-3.5 h-3.5 text-[#C15B3E] animate-pulse" />
                        ) : null}
                      </div>

                      <div className="mt-2">
                        <div className="text-xs font-bold leading-tight text-[#1F1E1D]">{s.label}</div>
                        <div className="text-[9px] text-[#736F68] truncate mt-0.5 font-mono">
                          {s.model.split("/").pop()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* LIVE LLM ACTIVITY CONSOLE (Dark Terminal) */}
            <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-3xl overflow-hidden shadow-xl">
              {/* Terminal Title Bar */}
              <div className="bg-[#2C2C2E] px-4 py-3 border-b border-[#3A3A3C] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#30D158]" />
                  <span className="text-xs font-mono font-bold text-[#E5E5EA]">
                    Live Multi-Agent Activity Stream
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF453A]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF9F0A]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#30D158]" />
                </div>
              </div>

              {/* Terminal Body */}
              <div className="p-4 md:p-6 font-mono text-xs text-[#E5E5EA] space-y-2.5 max-h-[380px] overflow-y-auto">
                {agentLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-3 leading-relaxed animate-slideIn">
                    <span className="text-[#8E8E93] select-none flex-shrink-0">
                      [{log.timestamp}]
                    </span>
                    <span
                      className={`font-bold flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] ${
                        log.agent === "Researcher"
                          ? "bg-[#0A84FF]/20 text-[#64D2FF] border border-[#0A84FF]/40"
                          : log.agent === "ArtDirector"
                          ? "bg-[#BF5AF2]/20 text-[#E0A7FF] border border-[#BF5AF2]/40"
                          : log.agent === "SlideWriter"
                          ? "bg-[#FF9F0A]/20 text-[#FFD60A] border border-[#FF9F0A]/40"
                          : log.agent === "DiagramCodeSpecialist"
                          ? "bg-[#64D2FF]/20 text-[#64D2FF] border border-[#64D2FF]/40"
                          : log.agent === "PlaywrightQA" || log.agent === "DeterministicQA"
                          ? "bg-[#30D158]/20 text-[#30D158] border border-[#30D158]/40"
                          : "bg-white/10 text-white"
                      }`}
                    >
                      {log.agent}
                    </span>
                    <span className="text-[#E5E5EA] flex-1">{log.action}</span>
                    {log.model && (
                      <span className="text-[10px] text-[#8E8E93] flex-shrink-0 hidden sm:inline">
                        ({log.model})
                      </span>
                    )}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>

            {errorMessage && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center justify-between">
                <span>{errorMessage}</span>
                <button
                  onClick={() => setCurrentStep("options")}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-medium"
                >
                  Back to Options
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: COMPLETED INTERACTIVE DECK VIEWER & EXPORT */}
        {currentStep === "completed" && deck && deck.engine === "v3" && (
          <V3DeckViewer deck={deck} onNew={() => setCurrentStep("options")} />
        )}
        {currentStep === "completed" && deck && deck.engine !== "v3" && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white border border-[#E8E2D5] p-5 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
              <div>
                <h2 className="font-serif font-bold text-[#1F1E1D] text-lg md:text-xl">{deck.topic}</h2>
                <p className="text-xs text-[#736F68] mt-0.5">
                  {deck.slides.length} Slides • Palette: {deck.designDna.palette.name} • Heading:{" "}
                  {deck.designDna.fontPair.headingFont}
                </p>
              </div>

              {/* Action & Download Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-[#F2ECE1] p-1 rounded-2xl border border-[#E3DBD0] mr-2">
                  <button
                    onClick={() => setViewMode("card")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      viewMode === "card"
                        ? "bg-white text-[#1F1E1D] shadow-sm"
                        : "text-[#736F68] hover:text-[#1F1E1D]"
                    }`}
                  >
                    Slide View
                  </button>
                  <button
                    onClick={() => setViewMode("slideshow")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      viewMode === "slideshow"
                        ? "bg-white text-[#1F1E1D] shadow-sm"
                        : "text-[#736F68] hover:text-[#1F1E1D]"
                    }`}
                  >
                    Interactive Deck
                  </button>
                </div>

                <button
                  onClick={() => handleExport("pptx")}
                  className="px-4 py-2.5 bg-[#C15B3E] hover:bg-[#A84E34] text-white text-xs font-semibold rounded-2xl shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> PPTX
                </button>
                <button
                  onClick={() => handleExport("pdf")}
                  className="px-4 py-2.5 bg-white hover:bg-[#FAF7F2] text-[#1F1E1D] text-xs font-semibold rounded-2xl flex items-center gap-1.5 border border-[#E5DEC9] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
                <button
                  onClick={() => handleExport("html")}
                  className="px-4 py-2.5 bg-white hover:bg-[#FAF7F2] text-[#1F1E1D] text-xs font-semibold rounded-2xl flex items-center gap-1.5 border border-[#E5DEC9] cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> HTML Deck
                </button>
                <button
                  onClick={() => setCurrentStep("options")}
                  className="px-4 py-2.5 text-[#736F68] hover:text-[#1F1E1D] text-xs font-medium rounded-2xl cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> New Deck
                </button>
              </div>
            </div>

            {/* Slide Preview 16:9 Screen */}
            {viewMode === "slideshow" && deck.htmlContent ? (
              <div className="w-full aspect-video rounded-3xl overflow-hidden shadow-xl border border-[#E5DEC9] bg-black">
                <iframe
                  ref={iframeRef}
                  srcDoc={deck.htmlContent}
                  className="w-full h-full border-0"
                  title="Interactive Deck Slideshow"
                />
              </div>
            ) : deck.slides[activeSlideIndex] && (
              <div
                className="w-full aspect-video rounded-3xl border border-[#E5DEC9] p-8 md:p-12 flex flex-col justify-between shadow-lg relative overflow-hidden"
                style={{
                  backgroundColor: deck.designDna.palette.background,
                  color: deck.designDna.palette.text,
                }}
              >
                {/* Header Tag */}
                <div className="flex justify-between items-center text-xs tracking-wider uppercase border-b border-black/10 pb-4 text-[#736F68]">
                  <span className="font-semibold text-[#C15B3E]">
                    Slide {activeSlideIndex + 1} of {deck.slides.length}
                  </span>
                  <span className="font-mono text-[10px]">{deck.slides[activeSlideIndex].layoutType}</span>
                </div>

                {/* DYNAMIC LAYOUT: 1. Three Cards & Grid Layout */}
                {(deck.slides[activeSlideIndex].layoutType === "three-cards" ||
                  deck.slides[activeSlideIndex].layoutType === "icon-grid-4") &&
                deck.slides[activeSlideIndex].visualElement.type === "cards" ? (
                  <div className="space-y-6 my-auto w-full">
                    <div className="space-y-1">
                      <h1
                        className="font-serif text-2xl md:text-3xl font-bold tracking-tight"
                        style={{ color: deck.designDna.palette.text }}
                      >
                        {deck.slides[activeSlideIndex].title}
                      </h1>
                      {deck.slides[activeSlideIndex].subtitle && (
                        <p className="text-xs md:text-sm text-[#736F68]">
                          {deck.slides[activeSlideIndex].subtitle}
                        </p>
                      )}
                    </div>
                    <div
                      className={`grid gap-4 pt-1 ${
                        deck.slides[activeSlideIndex].layoutType === "icon-grid-4"
                          ? "grid-cols-1 md:grid-cols-2"
                          : "grid-cols-1 md:grid-cols-3"
                      }`}
                    >
                      {deck.slides[activeSlideIndex].visualElement.items?.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-white/95 p-4 rounded-2xl border border-[#EAE3D6] shadow-sm flex items-start gap-3"
                        >
                          <div className="w-8 h-8 rounded-xl bg-[#C15B3E]/10 text-[#C15B3E] flex items-center justify-center font-bold text-xs font-mono flex-shrink-0">
                            0{idx + 1}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-[#1F1E1D] leading-snug">
                              {item.title}
                            </div>
                            <div className="text-xs text-[#736F68] leading-relaxed mt-1">
                              {item.description}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : deck.slides[activeSlideIndex].layoutType.includes("cover") ? (
                  /* DYNAMIC LAYOUT: 2. Cover / Hero Layout */
                  <div className="my-auto space-y-4 text-center max-w-2xl mx-auto w-full py-4">
                    <span className="inline-block px-3.5 py-1 rounded-full bg-[#C15B3E]/10 text-[#C15B3E] font-mono text-[11px] font-bold uppercase tracking-widest">
                      {deck.slides[activeSlideIndex].subtitle ? "KEYNOTE PRESENTATION" : "TITLE DECK"}
                    </span>
                    <h1
                      className="font-serif text-3xl md:text-5xl font-bold leading-tight"
                      style={{ color: deck.designDna.palette.text }}
                    >
                      {deck.slides[activeSlideIndex].title}
                    </h1>
                    {deck.slides[activeSlideIndex].subtitle && (
                      <p className="text-sm md:text-base text-[#736F68] leading-relaxed max-w-lg mx-auto">
                        {deck.slides[activeSlideIndex].subtitle}
                      </p>
                    )}
                    {deck.slides[activeSlideIndex].visualElement.type === "image" && (
                      <img
                        src={deck.slides[activeSlideIndex].visualElement.url}
                        alt="hero visual"
                        className="w-full max-h-48 object-cover rounded-2xl border border-[#E5DEC9] shadow-sm mx-auto mt-4"
                      />
                    )}
                  </div>
                ) : (
                  /* DYNAMIC LAYOUT: 3. Split Layout (Stats, Image, Diagram, Lists) */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-auto items-center w-full">
                    <div className="space-y-4">
                      <h1
                        className="font-serif text-2xl md:text-4xl font-normal leading-tight"
                        style={{ color: deck.designDna.palette.text }}
                      >
                        {deck.slides[activeSlideIndex].title}
                      </h1>

                      {deck.slides[activeSlideIndex].subtitle && (
                        <p className="text-sm md:text-base text-[#736F68] leading-relaxed">
                          {deck.slides[activeSlideIndex].subtitle}
                        </p>
                      )}

                      {deck.slides[activeSlideIndex].bodyPoints?.length > 0 && (
                        <ul className="space-y-2.5 pt-2">
                          {deck.slides[activeSlideIndex].bodyPoints.map((pt: string, i: number) => (
                            <li key={i} className="flex items-start gap-2.5 text-xs md:text-sm">
                              <span
                                className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                                style={{ backgroundColor: deck.designDna.palette.primary }}
                              />
                              <span>{pt}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Visual Preview */}
                    <div className="rounded-2xl bg-white border border-[#E5DEC9] p-6 flex flex-col items-center justify-center text-center min-h-[220px] shadow-sm">
                      {deck.slides[activeSlideIndex].visualElement.type === "stat" && (
                        <div className="space-y-2">
                          <div
                            className="font-serif text-5xl md:text-6xl font-bold"
                            style={{ color: deck.designDna.palette.primary }}
                          >
                            {deck.slides[activeSlideIndex].visualElement.number}
                          </div>
                          <div className="text-base font-semibold text-[#1F1E1D]">
                            {deck.slides[activeSlideIndex].visualElement.label}
                          </div>
                          {deck.slides[activeSlideIndex].visualElement.supportingText && (
                            <div className="text-xs text-[#736F68]">
                              {deck.slides[activeSlideIndex].visualElement.supportingText}
                            </div>
                          )}
                        </div>
                      )}

                      {deck.slides[activeSlideIndex].visualElement.type === "cards" && (
                        <div className="space-y-2 text-left w-full">
                          {deck.slides[activeSlideIndex].visualElement.items?.map((item: any, idx: number) => (
                            <div key={idx} className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#EAE3D6]">
                              <div className="text-xs font-bold text-[#C15B3E]">{item.title}</div>
                              <div className="text-[11px] text-[#736F68]">{item.description}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {deck.slides[activeSlideIndex].visualElement.type === "image" && (
                        <img
                          src={deck.slides[activeSlideIndex].visualElement.url}
                          alt="visual"
                          className="w-full h-44 object-cover rounded-2xl"
                        />
                      )}

                      {deck.slides[activeSlideIndex].visualElement.type === "quote" && (
                        <div className="space-y-2 italic">
                          <div className="font-serif text-base text-[#1F1E1D]">
                            &ldquo;{deck.slides[activeSlideIndex].visualElement.quote}&rdquo;
                          </div>
                          <div className="text-xs font-semibold text-[#C15B3E] not-italic">
                            — {deck.slides[activeSlideIndex].visualElement.author}
                          </div>
                        </div>
                      )}

                      {deck.slides[activeSlideIndex].visualElement.type === "diagram" && (
                        <div className="space-y-3 w-full text-left">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#C15B3E] uppercase tracking-wider mb-1">
                            <Sparkles className="w-3.5 h-3.5" /> AI Vector Process Architecture
                          </div>
                          <div className="space-y-2">
                            {deck.slides[activeSlideIndex].visualElement.nodes?.map((node: any, nidx: number) => (
                              <div
                                key={nidx}
                                className="bg-[#FAF7F2] p-3 rounded-2xl border border-[#EAE3D6] flex items-start gap-2.5 shadow-xs"
                              >
                                <span className="px-2 py-0.5 rounded-md bg-[#C15B3E] text-white font-mono text-[9px] font-bold mt-0.5 flex-shrink-0">
                                  {node.badge}
                                </span>
                                <div className="flex-1">
                                  <div className="text-xs font-bold text-[#1F1E1D]">{node.title}</div>
                                  {node.description && (
                                    <div className="text-[11px] text-[#736F68] mt-0.5 leading-snug">
                                      {node.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {deck.slides[activeSlideIndex].visualElement.type === "chart" && (
                        <div className="space-y-1 text-center">
                          <div className="text-xs font-bold text-[#C15B3E]">ECharts Interactive Visual</div>
                          <div className="text-[11px] text-[#736F68]">Chart rendered in HTML slideshow and PPTX export</div>
                        </div>
                      )}

                      {(!deck.slides[activeSlideIndex].visualElement.type ||
                        deck.slides[activeSlideIndex].visualElement.type === "none") && (
                        <div className="space-y-3 text-center max-w-xs my-auto py-4">
                          <div className="w-10 h-10 rounded-2xl bg-[#C15B3E]/10 text-[#C15B3E] flex items-center justify-center mx-auto">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div className="text-sm font-semibold text-[#1F1E1D]">Core Executive Insight</div>
                          <div className="text-xs text-[#736F68] leading-relaxed">
                            {deck.slides[activeSlideIndex].subtitle || "High-impact strategic principles & actionable takeaways."}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Speaker Notes Toggle */}
                {showNotes && deck.slides[activeSlideIndex].speakerNotes && (
                  <div className="bg-white/90 p-3.5 rounded-2xl border border-[#E0D8C8] text-xs text-[#2E2C29] mt-2">
                    <strong>Speaker Notes:</strong> {deck.slides[activeSlideIndex].speakerNotes}
                  </div>
                )}
              </div>
            )}

            {/* Slide Quick Navigation Pills */}
            <div className="flex items-center justify-center gap-2 overflow-x-auto py-1">
              {deck.slides.map((s: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setActiveSlideIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border flex items-center gap-1.5 cursor-pointer ${
                    activeSlideIndex === idx
                      ? "bg-[#C15B3E] text-white border-[#C15B3E] shadow-sm"
                      : "bg-white text-[#736F68] border-[#E5DEC9] hover:border-[#C15B3E]/50 hover:text-[#1F1E1D]"
                  }`}
                >
                  <span>Slide {idx + 1}</span>
                  <span className="opacity-75 text-[10px] uppercase font-mono font-normal">
                    {s.layoutType.replace("-", " ")}
                  </span>
                </button>
              ))}
            </div>

            {/* Carousel Controls */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveSlideIndex(Math.max(0, activeSlideIndex - 1))}
                disabled={activeSlideIndex === 0}
                className="px-4 py-2.5 bg-white border border-[#E5DEC9] hover:bg-[#FAF7F2] disabled:opacity-30 rounded-2xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer text-[#1F1E1D]"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              <button
                onClick={() => setShowNotes(!showNotes)}
                className="text-xs text-[#736F68] hover:text-[#1F1E1D] cursor-pointer"
              >
                {showNotes ? "Hide Notes" : "Show Speaker Notes"}
              </button>

              <button
                onClick={() =>
                  setActiveSlideIndex(Math.min(deck.slides.length - 1, activeSlideIndex + 1))
                }
                disabled={activeSlideIndex === deck.slides.length - 1}
                className="px-4 py-2.5 bg-white border border-[#E5DEC9] hover:bg-[#FAF7F2] disabled:opacity-30 rounded-2xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer text-[#1F1E1D]"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E8E2D5] mt-auto">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between text-xs text-[#A8A299]">
          <span>
            Built with{" "}
            <span className="font-semibold text-[#736F68]">DeckCraft Engine</span>
          </span>
          <span className="font-mono text-[10px] bg-[#F2ECE1] px-2 py-1 rounded-full text-[#736F68]">
            v3.0
          </span>
        </div>
      </footer>
    </div>
  );
}
