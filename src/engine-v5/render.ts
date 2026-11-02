/** Engine v5 — slot content → slide HTML through the template catalog (plus the engine's guard rails). */
import { TEMPLATES, templateById, type RenderCtx, type SlideContent } from "./templates";

export function renderSlide(c: SlideContent, ctx: RenderCtx): string {
  let t = templateById(c.template);
  // a photo template without its photo becomes the matching no-photo layout (never an empty frame)
  if (t && t.photo === "required" && !c.photo) t = templateById(NO_PHOTO[t.id] || "text-focus");
  if (!t) t = templateById("text-focus")!;
  return t.render({ ...c, template: t.id }, ctx);
}

export const NO_PHOTO: Record<string, string> = {
  "title-hero": "title-split",
  "icon-rows-photo": "cards-4",
  "photo-split": "text-focus",
  "photo-full": "text-focus",
};

export { TEMPLATES };
