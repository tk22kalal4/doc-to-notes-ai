import { Router } from "express";

const router = Router();

/**
 * GET /api/tts/token
 *
 * Returns the HuggingFace API token so the browser can call HF Inference
 * directly (the server can't resolve api-inference.huggingface.co but the
 * user's browser can — matching the existing Groq/Supabase client-side
 * key pattern already present in this app).
 *
 * Security note: this endpoint exposes the HF token to the browser. It is
 * mitigated by an Origin check so cross-site requests are rejected. The
 * HF free-tier token carries no billing risk; the threat model matches the
 * existing Groq key exposure in groqKeys.ts.
 */
router.get("/token", (req, res) => {
  // Best-effort origin restriction: reject cross-origin requests.
  // The Origin header is set by browsers for cross-origin fetches; its
  // absence (e.g. same-origin requests) is also allowed.
  const origin = (req.headers.origin as string | undefined) ?? "";
  if (origin) {
    const allowed =
      origin.includes("replit") ||
      origin.includes("localhost") ||
      origin.startsWith("http://127.");
    if (!allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  const hfToken = process.env.HUGGINGFACE_API_TOKEN;
  if (!hfToken) {
    res.status(503).json({ error: "HuggingFace API token not configured" });
    return;
  }
  res.json({ token: hfToken });
});

export default router;

