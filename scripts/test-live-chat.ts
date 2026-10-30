import fs from "fs";
import path from "path";

const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf-8");
const googleKey = env.match(/GOOGLE_AI_API_KEY=(.*)/)?.[1]?.trim();
const groqKey = env.match(/GROQ_API_KEY=(.*)/)?.[1]?.trim();

async function runTest() {
  console.log("Testing Google AI Studio (gemini-2.5-flash)...");
  const resGoogle = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${googleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      messages: [{ role: "user", content: 'Return JSON: {"status": "Google AI Live Active!"}' }],
      response_format: { type: "json_object" },
    }),
  });
  console.log("Google Status:", resGoogle.status);
  const dataGoogle = await resGoogle.json();
  console.log("Google Response:", dataGoogle.choices?.[0]?.message?.content);

  console.log("\nTesting GroqCloud (openai/gpt-oss-120b)...");
  const resGroq = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: 'Return JSON: {"status": "Groq Live Active!"}' }],
      response_format: { type: "json_object" },
    }),
  });
  console.log("Groq Status:", resGroq.status);
  const dataGroq = await resGroq.json();
  console.log("Groq Response:", dataGroq.choices?.[0]?.message?.content);
}

runTest();

