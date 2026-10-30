import modelsConfig from "@/config/models.json";
import { quotaTracker } from "./quotaTracker";

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKeyEnv: string;
  accountIdEnv?: string;
  enabled: boolean;
  allowedForProduction: boolean;
  limits?: {
    rpm?: number;
    rpd?: number;
    tokensPerDay?: number;
    neuronsPerDay?: number;
  };
}

export interface RouteTarget {
  providerId: string;
  model: string;
  provider: ProviderConfig;
  apiKey: string;
  isMockFallback?: boolean;
}

export class ModelRouter {
  public static selectRouteForAgent(agentName: string): RouteTarget {
    const agents = modelsConfig.agents as Record<string, { primary: { provider: string; model: string }; fallbacks: Array<{ provider: string; model: string }> }>;
    const providers = modelsConfig.providers as Record<string, ProviderConfig>;

    const agentRouting = agents[agentName];
    if (!agentRouting) {
      throw new Error(`Routing configuration not found for agent: ${agentName}`);
    }

    const candidates = [agentRouting.primary, ...(agentRouting.fallbacks || [])];
    const isProd = process.env.NODE_ENV === "production";

    for (const candidate of candidates) {
      const provider = providers[candidate.provider];
      if (!provider || !provider.enabled) continue;

      // In production, block if not allowedForProduction (e.g. NVIDIA pending license confirmation)
      if (isProd && !provider.allowedForProduction) continue;

      const apiKey = process.env[provider.apiKeyEnv];
      if (!apiKey) continue;

      // Check quota tracker
      const quotaCheck = quotaTracker.isAvailable(candidate.provider, provider.limits);
      if (!quotaCheck.available) {
        console.warn(`[ModelRouter] Skipping ${candidate.provider} for ${agentName}: ${quotaCheck.reason}`);
        continue;
      }

      return {
        providerId: candidate.provider,
        model: candidate.model,
        provider,
        apiKey,
      };
    }

    // If no real API key is configured in dev environment, return fallback target
    const fallbackCandidate = candidates[0];
    const fallbackProvider = providers[fallbackCandidate.provider] || {
      name: "Fallback Mock Provider",
      baseUrl: "https://api.groq.com/openai/v1",
      apiKeyEnv: "MOCK_KEY",
      enabled: true,
      allowedForProduction: false,
    };

    return {
      providerId: fallbackCandidate.provider,
      model: fallbackCandidate.model,
      provider: fallbackProvider,
      apiKey: "mock-key",
      isMockFallback: true,
    };
  }
}
