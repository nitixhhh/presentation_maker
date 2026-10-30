import { Database } from "@/lib/db";
import { quotaTracker } from "@/lib/ai/quotaTracker";
import modelsConfig from "@/config/models.json";

export interface CapacityStatus {
  allowed: boolean;
  maxDailyOrders: number;
  ordersToday: number;
  slotsRemaining: number;
  message?: string;
  providerHealth: {
    allHealthy: boolean;
    providerStatuses: Record<string, { available: boolean; reason?: string }>;
  };
}

export class CapacityGate {
  public static getMaxDailyOrders(): number {
    const raw = process.env.MAX_DAILY_ORDERS;
    const parsed = raw ? parseInt(raw, 10) : 4;
    return isNaN(parsed) ? 4 : parsed;
  }

  public static async checkCapacity(): Promise<CapacityStatus> {
    const maxDailyOrders = this.getMaxDailyOrders();
    const ordersToday = await Database.countOrdersCreatedToday();
    const slotsRemaining = Math.max(0, maxDailyOrders - ordersToday);

    // Check health of primary providers
    const providers = modelsConfig.providers as Record<string, any>;
    const providerStatuses: Record<string, { available: boolean; reason?: string }> = {};
    let allHealthy = true;

    for (const [key, p] of Object.entries(providers)) {
      if (!p.enabled) continue;
      const check = quotaTracker.isAvailable(key, p.limits);
      providerStatuses[key] = check;
      if (!check.available && (key === "google" || key === "groq")) {
        allHealthy = false;
      }
    }

    if (slotsRemaining <= 0) {
      return {
        allowed: false,
        maxDailyOrders,
        ordersToday,
        slotsRemaining: 0,
        message: "Today's slots are full, come back tomorrow! (Aaj ke sare generation slots bhar chuke hain, kripya kal punah prayas karein)",
        providerHealth: { allHealthy, providerStatuses },
      };
    }

    return {
      allowed: true,
      maxDailyOrders,
      ordersToday,
      slotsRemaining,
      message: `${slotsRemaining} slots remaining today for high-speed generation.`,
      providerHealth: { allHealthy, providerStatuses },
    };
  }
}

