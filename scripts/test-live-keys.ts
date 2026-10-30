import fs from "fs";
import path from "path";

// Load .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        process.env[key] = val;
      }
    }
  });
}

async function testGroq() {
  const key = process.env.GROQ_API_KEY;
  if (!key) return "No key";
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "Reply with JSON: {\"status\":\"ok\"}" }],
        response_format: { type: "json_object" },
        max_tokens: 30,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      return `✓ LIVE SUCCESS (${d.choices[0]?.message?.content?.trim()})`;
    } else {
      return `✗ Error ${res.status}: ${await res.text()}`;
    }
  } catch (e: any) {
    return `✗ Exception: ${e.message}`;
  }
}

async function testGoogle() {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) return "No key";
  try {
    // Google AI Studio OpenAI-compatible endpoint
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash",
        messages: [{ role: "user", content: "Reply with JSON: {\"status\":\"ok\"}" }],
        response_format: { type: "json_object" },
        max_tokens: 30,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      return `✓ LIVE SUCCESS (${d.choices[0]?.message?.content?.trim()})`;
    } else {
      return `✗ Error ${res.status}: ${await res.text()}`;
    }
  } catch (e: any) {
    return `✗ Exception: ${e.message}`;
  }
}

async function testNvidia() {
  const key = process.env.NVIDIA_NIM_API_KEY;
  if (!key) return "No key";
  try {
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta/llama-3.1-70b-instruct",
        messages: [{ role: "user", content: "Reply with JSON: {\"status\":\"ok\"}" }],
        response_format: { type: "json_object" },
        max_tokens: 30,
      }),
    });
    if (res.ok) {
      const d = await res.json();
      return `✓ LIVE SUCCESS (${d.choices[0]?.message?.content?.trim()})`;
    } else {
      return `✗ Error ${res.status}: ${await res.text()}`;
    }
  } catch (e: any) {
    return `✗ Exception: ${e.message}`;
  }
}

async function run() {
  console.log("=========================================");
  console.log("       TESTING LIVE AI PROVIDER KEYS     ");
  console.log("=========================================\n");

  console.log("[1] Testing GroqCloud API...");
  console.log("  Result:", await testGroq());

  console.log("\n[2] Testing Google AI Studio API...");
  console.log("  Result:", await testGoogle());

  console.log("\n[3] Testing NVIDIA NIM API...");
  console.log("  Result:", await testNvidia());
}

run();

