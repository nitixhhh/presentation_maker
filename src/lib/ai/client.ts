import crypto from "crypto";
import { ModelRouter, RouteTarget } from "./modelRouter";
import { quotaTracker } from "./quotaTracker";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelCallResult {
  text: string;
  provider: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
}

// In-memory simple LRU/TTL cache by prompt hash
const promptResponseCache = new Map<string, { result: ModelCallResult; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 4; // 4 hours

export class AIClient {
  private static computeHash(messages: ChatMessage[], model: string): string {
    const serialized = JSON.stringify({ messages, model });
    return crypto.createHash("sha256").update(serialized).digest("hex");
  }

  public static async complete(
    agentName: string,
    messages: ChatMessage[],
    options: { temperature?: number; maxTokens?: number; useCache?: boolean } = {}
  ): Promise<ModelCallResult> {
    const route = ModelRouter.selectRouteForAgent(agentName);
    const hash = this.computeHash(messages, route.model);

    // 1. Response cache check
    if (options.useCache !== false) {
      const cached = promptResponseCache.get(hash);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.result;
      }
    }

    // 2. Mock mode fallback if no valid API key is available
    if (route.isMockFallback) {
      return this.generateMockResponse(agentName, messages, route);
    }

    const startTime = Date.now();
    try {
      const endpoint = `${route.provider.baseUrl.replace(/\/$/, "")}/chat/completions`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${route.apiKey}`,
      };

      // Special handling for OpenRouter or Cloudflare
      if (route.providerId === "openrouter") {
        headers["HTTP-Referer"] = "https://deckcraft.app";
        headers["X-Title"] = "DeckCraft AI";
      }

      let currentModel = route.model;
      let includeJsonFormat = true;
      let res: Response | null = null;
      let lastErrorText = "";

      // Retry loop with resilience for 503 high-demand spikes and 400 json_validate_failed
      for (let attempt = 0; attempt < 3; attempt++) {
        const body: any = {
          model: currentModel,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 3000,
        };
        if (includeJsonFormat) {
          body.response_format = { type: "json_object" };
        }

        try {
          res = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          });
        } catch (fetchErr: any) {
          lastErrorText = fetchErr.message;
          await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
          continue;
        }

        if (res.ok) {
          break; // Success!
        }

        lastErrorText = await res.text();

        // 1. Handle Google 503 (High demand spike): Back off and retry, or failover to flash-lite
        if (res.status === 503) {
          console.warn(`[AIClient] ${route.providerId} (${currentModel}) returned 503 high demand. Backing off ${1500 * (attempt + 1)}ms...`);
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          if (attempt === 1 && currentModel === "gemini-2.5-flash") {
            currentModel = "gemini-2.5-flash-lite";
            console.log(`[AIClient] Failover to ${currentModel} to bypass high-demand spike.`);
          }
          continue;
        }

        // 2. Handle Groq 400 (json_validate_failed): Retry without strict response_format
        if (res.status === 400 && lastErrorText.includes("json_validate_failed") && includeJsonFormat) {
          console.warn(`[AIClient] ${route.providerId} JSON validation error. Retrying without strict response_format wrapper...`);
          includeJsonFormat = false;
          continue;
        }

        // 3. Handle 429 Rate Limit
        if (res.status === 429) {
          const retryAfter = res.headers.get("retry-after");
          const retrySec = retryAfter ? parseInt(retryAfter, 10) : 5;
          console.warn(`[AIClient] 429 Rate limited. Waiting ${retrySec}s...`);
          await new Promise((r) => setTimeout(r, Math.min(retrySec * 1000, 5000)));
          continue;
        }

        // Other non-retriable error
        break;
      }

      if (!res || !res.ok) {
        const status = res ? res.status : 500;
        if (status === 429) {
          quotaTracker.recordFailure(route.providerId, true);
        } else {
          quotaTracker.recordFailure(route.providerId, false);
        }

        console.error(`[AIClient Error] ${route.providerId} (${currentModel}) returned ${status}: ${lastErrorText}`);
        throw new Error(`AI Provider ${route.providerId} failed (${status}): ${lastErrorText}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "";
      const tokensUsed = data.usage?.total_tokens || 0;

      quotaTracker.recordSuccess(route.providerId, tokensUsed);

      const latencyMs = Date.now() - startTime;
      const result: ModelCallResult = {
        text: content,
        provider: route.providerId,
        model: currentModel,
        tokensUsed,
        latencyMs,
      };

      console.log(`[AIClient] Agent: ${agentName} | Provider: ${route.providerId} | Model: ${currentModel} | Latency: ${latencyMs}ms | Tokens: ${tokensUsed}`);

      promptResponseCache.set(hash, { result, timestamp: Date.now() });
      return result;
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      quotaTracker.recordFailure(route.providerId);
      console.warn(`[AIClient] Call failed on primary route (${route.providerId}). Details: ${err.message}`);

      // Graceful fallback to mock response in local test mode if enabled
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[AIClient] Falling back to structured mock data for local development.`);
        return this.generateMockResponse(agentName, messages, route);
      }

      throw err;
    }
  }

  /**
   * Generates deterministic, high-quality mock data conforming to agent schemas.
   * Enables complete local development and testing without burning provider quotas.
   */
  private static generateMockResponse(agentName: string, messages: ChatMessage[], route: RouteTarget): ModelCallResult {
    const userPrompt = messages.find((m) => m.role === "user")?.content || "";
    let mockContent = "{}";

    if (agentName === "Researcher") {
      mockContent = JSON.stringify({
        executiveSummary: "A comprehensive strategic blueprint addressing current market disruption and actionable scaling vectors.",
        narrativeArc: "Begins with the urgent market shift, reveals data-backed pain points, introduces the structural framework, and concludes with a definitive roadmap.",
        keyThemes: ["Technological Acceleration", "Operational Agility", "Sustainable Unit Economics"],
        slideOutline: [
          {
            slideIndex: 1,
            suggestedLayout: "hero-title",
            headline: "The Future of Scalable Automation",
            coreMessage: "How intelligent systems are revolutionizing modern execution workflows.",
            dataPoints: ["10x speed multiplier across core operations"],
            visualIdea: "Abstract glowing mesh network with high-contrast gradient accents",
          },
          {
            slideIndex: 2,
            suggestedLayout: "big-stat-callout",
            headline: "Critical Efficiency Bottlenecks",
            coreMessage: "Over 68% of knowledge work is lost to manual coordination and context switching.",
            dataPoints: ["68% overhead waste", "$4.2T global annual loss"],
            visualIdea: "Massive glowing metric badge with amber alert styling",
          },
          {
            slideIndex: 3,
            suggestedLayout: "three-card-grid",
            headline: "Architectural Pillars of Transformation",
            coreMessage: "Three foundational pillars required to achieve operational autonomy.",
            dataPoints: ["Modular Agent Workflows", "Deterministic Sandboxing", "Live Observability"],
            visualIdea: "3 elevated glassmorphic cards with glowing border accents",
          },
          {
            slideIndex: 4,
            suggestedLayout: "closing-cta",
            headline: "Deploying the New Paradigm",
            coreMessage: "Immediate next milestones for seamless pilot deployment.",
            dataPoints: ["Day 1-14: Audit", "Day 15-30: Pilot Rollout"],
            visualIdea: "Hero CTA container with gradient action badge",
          },
        ],
      });
    } else if (agentName === "ArtDirector") {
      mockContent = JSON.stringify({
        designThemeName: "Midnight Cyberpunk High-Contrast",
        rationale: "Selected dark obsidian background with electric indigo and cyan accents to evoke precision engineering and authority.",
        palette: {
          id: "midnight-cyber",
          name: "Midnight Cyber",
          background: "#090D16",
          surface: "#111827",
          primary: "#6366F1",
          secondary: "#06B6D4",
          accent: "#F43F5E",
          text: "#F8FAFC",
          mutedText: "#94A3B8",
          border: "#1E293B",
        },
        fontPair: {
          id: "outfit-inter",
          name: "Outfit & Inter",
          headingFont: "Outfit",
          bodyFont: "Inter",
          googleFontUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700;800;900&display=swap",
          supportsHindi: true,
        },
        visualStyle: "modern-dark",
        motif: "rounded-glass-mesh",
        layoutSequence: ["hero-title", "big-stat-callout", "three-card-grid", "closing-cta"],
        slideVisualDirectives: [
          { slideIndex: 1, layoutType: "hero-title", recommendedVisualType: "image", visualStyleNotes: "Dark futuristic abstract geometric illustration" },
          { slideIndex: 2, layoutType: "big-stat-callout", recommendedVisualType: "stat", visualStyleNotes: "Glowing accent stat with high visual prominence" },
          { slideIndex: 3, layoutType: "three-card-grid", recommendedVisualType: "cards", visualStyleNotes: "Trio of illuminated frosted glass containers" },
          { slideIndex: 4, layoutType: "closing-cta", recommendedVisualType: "image", visualStyleNotes: "Clean brand badge with high-contrast CTA pill" },
        ],
      });
    } else if (agentName === "SlideWriter") {
      mockContent = JSON.stringify({
        deckTitle: "The Future of Scalable Automation",
        slides: [
          {
            slideIndex: 1,
            layoutType: "hero-title",
            title: "The Future of Scalable Automation",
            subtitle: "Unlocking 10x Operational Velocity Through Intelligent Agent Architecture",
            bodyPoints: ["Next-generation autonomous pipelines designed for absolute reliability."],
            speakerNotes: "Welcome everyone. Today we examine the single biggest shift in knowledge work productivity.",
          },
          {
            slideIndex: 2,
            layoutType: "big-stat-callout",
            title: "The Hidden Cost of Friction",
            subtitle: "Manual coordination drains critical organizational velocity",
            bodyPoints: ["Traditional workflows lose up to 68% of productive output to fragmented handoffs."],
            visualElementInitial: {
              type: "stat",
              number: "68%",
              label: "Loss to Manual Handoffs",
              supportingText: "Identified across enterprise knowledge workflows globally",
            },
            speakerNotes: "Notice this figure. It represents the immense friction organizations face before pipeline automation.",
          },
          {
            slideIndex: 3,
            layoutType: "three-card-grid",
            title: "Pillars of Autonomous Execution",
            subtitle: "Engineered for deterministic precision and zero hallucinations",
            bodyPoints: [
              "Agent Orchestration: Task delegation across specialized domain sub-agents.",
              "Deterministic Gates: Code-based validation and Playwright visual verification.",
              "Fail-Safe Routing: Multi-provider fallbacks ensuring 99.9% pipeline uptime.",
            ],
            visualElementInitial: {
              type: "cards",
              items: [
                { title: "Agent Roles", description: "Granular separation of research, visual art direction, and copy.", icon: "bot" },
                { title: "Deterministic Gates", description: "Automated overflow, contrast, and layout repetition checks.", icon: "shield" },
                { title: "Smart Routing", description: "Automatic failover across free and production model pools.", icon: "zap" },
              ],
            },
            speakerNotes: "Let us break down each pillar: specialization, validation gates, and resilient infrastructure.",
          },
          {
            slideIndex: 4,
            layoutType: "closing-cta",
            title: "Begin Your Operational Transformation",
            subtitle: "Deploy targeted autonomous pipelines in your workspace today",
            bodyPoints: ["Zero subscription overhead • Instant export to PPTX, PDF, and HTML"],
            speakerNotes: "Thank you for your time. Let's move to questions and implementation strategy.",
          },
        ],
      });
    } else if (agentName === "ImagePromptWriter") {
      mockContent = JSON.stringify({
        slideIndex: 1,
        fluxPrompt: "Cinematic 3D render of an interconnected neon neural network, dark obsidian background, dramatic lighting, 8k resolution",
        stockKeywords: ["artificial intelligence network", "technology data", "futuristic digital systems"],
        aspectRatio: "16:9",
      });
    } else if (agentName === "DiagramCodeSpecialist") {
      mockContent = JSON.stringify({
        slideIndex: 2,
        visualElement: {
          type: "stat",
          number: "99.8%",
          label: "Pipeline Reliability",
          supportingText: "Zero single-point-of-failure multi-provider failover",
        },
      });
    } else {
      mockContent = JSON.stringify({ status: "success", agent: agentName });
    }

    return {
      text: mockContent,
      provider: "mock",
      model: "mock-runner",
      tokensUsed: 120,
      latencyMs: 15,
    };
  }
}
