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
  public static getCandidateRoutesForAgent(agentName: string): RouteTarget[] {
    const agents = modelsConfig.agents as Record<
      string,
      { primary: { provider: string; model: string }; fallbacks: Array<{ provider: string; model: string }> }
    >;
    const providers = modelsConfig.providers as Record<string, ProviderConfig>;

    const agentRouting = agents[agentName] || agents["SlideWriter"];
    const candidates = [agentRouting.primary, ...(agentRouting.fallbacks || [])];
    const isProd = process.env.NODE_ENV === "production";
    const targets: RouteTarget[] = [];

    for (const candidate of candidates) {
      const provider = providers[candidate.provider];
      if (!provider || !provider.enabled) continue;
      if (isProd && !provider.allowedForProduction) continue;

      const apiKey = process.env[provider.apiKeyEnv];
      if (!apiKey) continue;

      targets.push({
        providerId: candidate.provider,
        model: candidate.model,
        provider,
        apiKey,
      });
    }

    if (targets.length === 0) {
      targets.push({
        providerId: "mock",
        model: "mock-model",
        provider: {
          name: "Mock Provider",
          baseUrl: "https://api.groq.com/openai/v1",
          apiKeyEnv: "MOCK_KEY",
          enabled: true,
          allowedForProduction: false,
        },
        apiKey: "mock-key",
        isMockFallback: true,
      });
    }

    return targets;
  }

  public static selectRouteForAgent(agentName: string): RouteTarget {
    const routes = this.getCandidateRoutesForAgent(agentName);
    return routes[0];
  }
}
