import { NextRequest } from "next/server";
import { runAIPipeline } from "@/engine/pipeline";
import type { Shape } from "@/engine/sceneGraph";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { topic, audience, tone, slideCount, language, visualStyle } = json;

    if (!topic || typeof topic !== "string") {
      return new Response(JSON.stringify({ error: "Topic is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: any) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          send("progress", {
            step: "Initializing Engine v2 Autonomous Pipeline",
            percent: 5,
            details: `Target: "${topic}"`,
            log: {
              agent: "Owner",
              action: `Spawning Director & Specialist agents for "${topic}"`,
              timestamp: new Date().toLocaleTimeString(),
            },
          });

          // Run Engine v2 AI Pipeline
          const result = await runAIPipeline(
            {
              topic,
              audience: audience || "General Audience",
              tone: tone || "Professional & Engaging",
              slideCount: slideCount || 4,
              language: language || "English",
              visualStyle: visualStyle || "modern-dark",
            },
            {
              skipPdf: true, // Generate PDF on export demand
              onProgress: (p) => {
                send("progress", p);
              },
            }
          );

          const sg = result.sceneGraph;
          const ds = sg.designSystem;

          // Assemble frontend-compatible deck representation with rich layouts
          const slides = sg.slides.map((s, idx) => {
            let title = "";
            let subtitle = "";
            const bodyPoints: string[] = [];
            let visualElement: any = { type: "none" };

            for (const shape of s.shapes) {
              if (shape.type === "text") {
                const text = shape.runs.map((r) => r.text).join(" ");
                if (shape.id.includes("title")) {
                  if (!title) title = text;
                } else if (shape.id.includes("subtitle")) {
                  if (!subtitle) subtitle = text;
                } else if (shape.id.includes("kicker")) {
                  // kicker
                } else if (!title) {
                  title = text;
                }
              } else if (shape.type === "bulletList") {
                bodyPoints.push(...shape.items);
              } else if (shape.type === "bigNumber") {
                visualElement = {
                  type: "stat",
                  number: shape.number,
                  label: shape.label,
                  supportingText: shape.supporting,
                };
              } else if (shape.type === "image") {
                visualElement = {
                  type: "image",
                  url: shape.src,
                  alt: shape.alt,
                };
              }
            }

            // Check if slide contains cards
            const cardTitles = s.shapes.filter(
              (sh) => sh.type === "text" && sh.id.includes("card-title")
            );
            if (cardTitles.length > 0) {
              const cardItems = cardTitles.map((ct: any, cidx) => {
                const cb = s.shapes.find(
                  (sh) => sh.type === "text" && sh.id.includes(`card-body-${cidx}`)
                ) as any;
                return {
                  title: ct.runs?.[0]?.text || `Pillar ${cidx + 1}`,
                  description: cb?.runs?.[0]?.text || "",
                };
              });
              visualElement = { type: "cards", items: cardItems };
            }

            // Check if slide contains dynamic diagram shapes
            const diagTitles = s.shapes.filter(
              (sh) => sh.type === "text" && sh.id.includes("-diag-node-title-")
            );
            if (diagTitles.length > 0) {
              const nodes = diagTitles.map((dt: any, didx) => {
                const dd = s.shapes.find(
                  (sh) => sh.type === "text" && sh.id.includes(`-diag-node-desc-${didx}`)
                ) as any;
                const db = s.shapes.find(
                  (sh) => sh.type === "text" && sh.id.includes(`-diag-badge-txt-${didx}`)
                ) as any;
                return {
                  badge: db?.runs?.[0]?.text || `STEP 0${didx + 1}`,
                  title: dt.runs?.[0]?.text || `Stage ${didx + 1}`,
                  description: dd?.runs?.[0]?.text || "",
                };
              });
              visualElement = {
                type: "diagram",
                nodes,
              };
            }

            return {
              index: idx,
              title: title || `${topic} - Part ${idx + 1}`,
              subtitle: subtitle || "",
              bodyPoints: bodyPoints.length > 0 ? bodyPoints : [],
              layoutType: s.layoutId,
              visualElement,
              speakerNotes: s.speakerNotes || "",
            };
          });

          const deck = {
            topic: sg.topic,
            designDna: {
              palette: {
                name: ds.styleFamily,
                background: ds.palette.bg,
                text: ds.palette.text,
                primary: ds.palette.primary,
                secondary: ds.palette.secondary,
                accent: ds.palette.accent,
              },
              fontPair: {
                headingFont: ds.fonts.heading,
                bodyFont: ds.fonts.body,
              },
            },
            slides,
            sceneGraph: sg,
            htmlContent: result.htmlContent,
          };

          send("complete", { deck });
        } catch (err: any) {
          console.error("[EngineV2 Stream API Error]:", err);
          send("error", { message: err.message || "Failed to generate presentation" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
