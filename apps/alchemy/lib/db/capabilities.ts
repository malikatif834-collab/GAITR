/**
 * Closed vocabulary of AI-tool capability tags used across the catalog,
 * matcher, and seed data. Keep this list small and well-defined — every
 * synergy pattern matches against this exact set.
 */
export const CAPABILITIES = [
  "voice-cloning",
  "voice-synthesis",
  "video-synthesis",
  "face-swap",
  "image-generation",
  "image-editing",
  "text-generation",
  "code-generation",
  "autonomous-agent",
  "computer-use",
  "web-browsing",
  "music-generation",
  "translation",
  "transcription",
  "multimodal-understanding",
  "embedding",
  "package-management",
  "model-fine-tuning",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/**
 * SAIF control category codes per the GAITR spec, Appendix A.
 *   D  = Data & Model Governance
 *   I  = AI-specific Infrastructure
 *   M  = ML Development & Deployment
 *   A  = AI Application Security
 *   AS = Autonomy & Safety
 *   G  = Generative AI Trust
 */
export const SAIF_CONTROLS = ["D", "I", "M", "A", "AS", "G"] as const;
export type SaifControl = (typeof SAIF_CONTROLS)[number];
