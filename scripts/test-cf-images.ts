const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
console.log("Testing Cloudflare Workers AI Image Generation...");
console.log("Account ID:", accountId);
console.log("Token exists:", !!token);

async function testCF() {
  const models = [
    "@cf/black-forest-labs/flux-1-schnell",
    "@cf/bytedance/stable-diffusion-xl-lightning",
    "@cf/stabilityai/stable-diffusion-xl-base-1.0",
  ];
  for (const model of models) {
    try {
      console.log("\nTrying Cloudflare model:", model);
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt:
            "Editorial presentation graphic of UV-VIS spectrophotometer prism dispersing light spectrum, dark modern backdrop, 8k",
          num_steps: 4,
        }),
      });
      console.log("Status:", res.status, res.statusText);
      const text = await res.text();
      console.log("Response preview:", text.slice(0, 300));
      if (res.ok) {
        console.log("SUCCESS on model:", model);
        return;
      }
    } catch (e) {
      console.error("Error:", e);
    }
  }
}

testCF().catch(console.error);
