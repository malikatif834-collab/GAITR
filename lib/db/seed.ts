import { sql } from "drizzle-orm";
import { db } from "./client";
import {
  agentRuns,
  aiTools,
  alchemyScenarios,
  attackFingerprints,
  briefs,
  capabilitySynergies,
  decisionRecords,
  evalResults,
  feedbackEvents,
  incidents,
  incidentToolLinks,
  ingestionEvents,
  reviewQueue,
  saifControls,
  saifMappings,
  sourceRegistry,
  users,
} from "./schema";
import type { Capability, SaifControl } from "./capabilities";
import { synthesizeScenario } from "../alchemy/synthesize";
import { ingestSource } from "../pipeline/ingest";
import { extractFromIncident } from "../pipeline/extract";
import { correlateIncident } from "../pipeline/correlate";
import { mapSubject } from "../pipeline/map";
import { composeBrief } from "../pipeline/report";

type SeedTool = {
  name: string;
  vendor?: string;
  url?: string;
  description: string;
  capabilities: Capability[];
};

type SeedSynergy = {
  name: string;
  requiredCapabilities: Capability[];
  emergentThreat: string;
  riskMultiplier: number;
  saifControls: SaifControl[];
  rationale: string;
};

const TOOLS: SeedTool[] = [
  // Voice
  {
    name: "ElevenLabs",
    vendor: "ElevenLabs",
    url: "https://elevenlabs.io",
    description: "High-fidelity voice cloning and text-to-speech.",
    capabilities: ["voice-cloning", "voice-synthesis"],
  },
  {
    name: "Resemble AI",
    vendor: "Resemble AI",
    url: "https://www.resemble.ai",
    description: "Voice cloning and real-time speech synthesis API.",
    capabilities: ["voice-cloning", "voice-synthesis"],
  },
  {
    name: "PlayHT",
    vendor: "PlayHT",
    url: "https://play.ht",
    description: "Text-to-speech with custom voice cloning.",
    capabilities: ["voice-cloning", "voice-synthesis"],
  },
  {
    name: "Murf AI",
    vendor: "Murf",
    url: "https://murf.ai",
    description: "AI voice generator for narration and presentations.",
    capabilities: ["voice-synthesis"],
  },
  {
    name: "Descript Overdub",
    vendor: "Descript",
    url: "https://www.descript.com/overdub",
    description: "Voice cloning integrated with audio/video editing.",
    capabilities: ["voice-cloning", "voice-synthesis", "transcription"],
  },

  // Video / face
  {
    name: "HeyGen",
    vendor: "HeyGen",
    url: "https://www.heygen.com",
    description: "AI avatar video generation with cloned voices.",
    capabilities: ["video-synthesis", "voice-synthesis", "face-swap"],
  },
  {
    name: "Synthesia",
    vendor: "Synthesia",
    url: "https://www.synthesia.io",
    description: "Studio-quality avatar videos from text scripts.",
    capabilities: ["video-synthesis", "voice-synthesis"],
  },
  {
    name: "Runway",
    vendor: "Runway",
    url: "https://runwayml.com",
    description: "Generative video, image generation and editing tools.",
    capabilities: ["video-synthesis", "image-generation", "image-editing"],
  },
  {
    name: "Pika",
    vendor: "Pika Labs",
    url: "https://pika.art",
    description: "Text- and image-to-video generation.",
    capabilities: ["video-synthesis", "image-generation"],
  },
  {
    name: "D-ID",
    vendor: "D-ID",
    url: "https://www.d-id.com",
    description: "Photo-realistic talking head videos from a single image.",
    capabilities: ["video-synthesis", "face-swap", "voice-synthesis"],
  },
  {
    name: "DeepFaceLab",
    vendor: "Open source",
    url: "https://github.com/iperov/DeepFaceLab",
    description: "Open-source face-swapping framework.",
    capabilities: ["face-swap", "video-synthesis"],
  },

  // Image
  {
    name: "Midjourney",
    vendor: "Midjourney",
    url: "https://www.midjourney.com",
    description: "High-aesthetic text-to-image generation.",
    capabilities: ["image-generation"],
  },
  {
    name: "Stable Diffusion",
    vendor: "Stability AI",
    url: "https://stability.ai",
    description: "Open-weight diffusion models for image generation/editing.",
    capabilities: ["image-generation", "image-editing", "model-fine-tuning"],
  },
  {
    name: "DALL-E 3",
    vendor: "OpenAI",
    url: "https://openai.com/dall-e-3",
    description: "Text-to-image generation integrated with ChatGPT.",
    capabilities: ["image-generation"],
  },
  {
    name: "Flux",
    vendor: "Black Forest Labs",
    url: "https://blackforestlabs.ai",
    description: "Open-weight diffusion image generator.",
    capabilities: ["image-generation", "model-fine-tuning"],
  },

  // Music
  {
    name: "Suno",
    vendor: "Suno",
    url: "https://suno.com",
    description: "Full-song generation from text prompts.",
    capabilities: ["music-generation", "voice-synthesis"],
  },
  {
    name: "Udio",
    vendor: "Udio",
    url: "https://www.udio.com",
    description: "AI music generation with vocals.",
    capabilities: ["music-generation", "voice-synthesis"],
  },

  // LLMs
  {
    name: "ChatGPT",
    vendor: "OpenAI",
    url: "https://chat.openai.com",
    description: "Conversational LLM with code, vision, and tools.",
    capabilities: [
      "text-generation",
      "code-generation",
      "multimodal-understanding",
      "embedding",
    ],
  },
  {
    name: "Claude",
    vendor: "Anthropic",
    url: "https://claude.ai",
    description:
      "Frontier conversational LLM with strong coding and reasoning.",
    capabilities: [
      "text-generation",
      "code-generation",
      "multimodal-understanding",
    ],
  },
  {
    name: "Gemini",
    vendor: "Google",
    url: "https://gemini.google.com",
    description: "Multimodal LLM with deep Google product integration.",
    capabilities: [
      "text-generation",
      "code-generation",
      "multimodal-understanding",
      "embedding",
    ],
  },

  // Code
  {
    name: "Cursor",
    vendor: "Anysphere",
    url: "https://cursor.com",
    description: "AI-first code editor with agentic capabilities.",
    capabilities: ["code-generation", "autonomous-agent", "package-management"],
  },
  {
    name: "GitHub Copilot",
    vendor: "GitHub",
    url: "https://github.com/features/copilot",
    description: "In-editor code completion and chat.",
    capabilities: ["code-generation"],
  },
  {
    name: "Devin",
    vendor: "Cognition",
    url: "https://devin.ai",
    description: "Autonomous software engineering agent.",
    capabilities: [
      "code-generation",
      "autonomous-agent",
      "computer-use",
      "package-management",
      "web-browsing",
    ],
  },
  {
    name: "v0",
    vendor: "Vercel",
    url: "https://v0.dev",
    description: "Generative UI for React/Next.js components.",
    capabilities: ["code-generation"],
  },

  // Agents
  {
    name: "Manus",
    vendor: "Monica",
    url: "https://manus.ai",
    description: "General-purpose autonomous web agent.",
    capabilities: [
      "autonomous-agent",
      "web-browsing",
      "code-generation",
      "text-generation",
    ],
  },
  {
    name: "AutoGPT",
    vendor: "Open source",
    url: "https://github.com/Significant-Gravitas/AutoGPT",
    description: "Open-source autonomous LLM agent framework.",
    capabilities: ["autonomous-agent", "web-browsing", "text-generation"],
  },
  {
    name: "OpenAI Operator",
    vendor: "OpenAI",
    url: "https://operator.chatgpt.com",
    description: "Browser-using agent that completes tasks online.",
    capabilities: ["autonomous-agent", "computer-use", "web-browsing"],
  },
  {
    name: "Anthropic Computer Use",
    vendor: "Anthropic",
    url: "https://docs.anthropic.com/en/docs/build-with-claude/computer-use",
    description: "Claude API capability to operate a computer screen + mouse.",
    capabilities: ["autonomous-agent", "computer-use"],
  },
  {
    name: "Browser Use",
    vendor: "Open source",
    url: "https://github.com/browser-use/browser-use",
    description: "Open-source LLM-driven browser automation library.",
    capabilities: ["autonomous-agent", "web-browsing"],
  },

  // Specialized
  {
    name: "Whisper",
    vendor: "OpenAI",
    url: "https://openai.com/research/whisper",
    description: "Open-weight speech recognition model.",
    capabilities: ["transcription", "translation"],
  },
  {
    name: "DeepL",
    vendor: "DeepL",
    url: "https://www.deepl.com",
    description: "Neural machine translation across 30+ languages.",
    capabilities: ["translation"],
  },
];

const SYNERGIES: SeedSynergy[] = [
  {
    name: "Vishing",
    requiredCapabilities: ["voice-cloning", "text-generation"],
    emergentThreat:
      "Voice-clone-driven phone scams scripted by an LLM, executed at scale against employees and customers.",
    riskMultiplier: 2.0,
    saifControls: ["G", "A"],
    rationale:
      "An LLM writes context-aware social-engineering scripts; voice cloning makes the call sound like a known person. Combined cost per call drops near zero.",
  },
  {
    name: "Deepfake Fraud",
    requiredCapabilities: ["voice-cloning", "video-synthesis", "face-swap"],
    emergentThreat:
      "Live or recorded executive impersonation for wire-transfer fraud and KYC bypass.",
    riskMultiplier: 2.5,
    saifControls: ["G", "AS", "A"],
    rationale:
      "Combining voice + face + video makes synthetic identities pass casual human verification on calls and onboarding flows.",
  },
  {
    name: "Autonomous Malware",
    requiredCapabilities: ["code-generation", "autonomous-agent"],
    emergentThreat:
      "Self-modifying, self-propagating malware that rewrites payloads to evade detection.",
    riskMultiplier: 2.5,
    saifControls: ["AS", "G"],
    rationale:
      "An agent loop that can read a target environment and emit fresh code per host defeats signature-based defenses.",
  },
  {
    name: "Supply Chain Attack",
    requiredCapabilities: ["code-generation", "package-management"],
    emergentThreat:
      "Automated dependency typosquatting and malicious package publishing.",
    riskMultiplier: 2.0,
    saifControls: ["M", "I"],
    rationale:
      "An agent can scaffold believable open-source packages, publish them under typo-adjacent names, and propose them as dependencies in PRs.",
  },
  {
    name: "Credential Harvesting at Scale",
    requiredCapabilities: ["text-generation", "web-browsing"],
    emergentThreat:
      "Personalized phishing pages and lures generated and distributed by browser-using agents.",
    riskMultiplier: 1.8,
    saifControls: ["A", "G"],
    rationale:
      "LLMs write target-specific copy; a browser agent stands up landing pages and seeds them across forums, reducing human effort to near zero.",
  },
  {
    name: "Disinformation Campaign",
    requiredCapabilities: ["text-generation", "image-generation"],
    emergentThreat:
      "Synthetic articles paired with synthetic imagery, distributed across networks of fake accounts.",
    riskMultiplier: 2.2,
    saifControls: ["G"],
    rationale:
      "Coupling LLM narratives with on-prompt imagery removes the bottleneck on credible-looking source material.",
  },
  {
    name: "Fake Customer Support Bot",
    requiredCapabilities: [
      "voice-synthesis",
      "text-generation",
      "autonomous-agent",
    ],
    emergentThreat:
      "Scam call centers staffed entirely by AI voice agents that read victim data live.",
    riskMultiplier: 2.3,
    saifControls: ["G", "A", "AS"],
    rationale:
      "Multi-turn voice agents with retrieval over leaked PII can sustain hours-long conversations with high believability.",
  },
  {
    name: "Live Identity Impersonation",
    requiredCapabilities: ["voice-cloning", "video-synthesis"],
    emergentThreat:
      "Real-time deepfake video calls used to defeat KYC and corporate verification.",
    riskMultiplier: 2.7,
    saifControls: ["G", "AS"],
    rationale:
      "Live combined voice + video deepfakes have already caused multi-million-dollar wire fraud losses (Hong Kong 2024).",
  },
  {
    name: "Automated Account Takeover",
    requiredCapabilities: [
      "text-generation",
      "computer-use",
      "autonomous-agent",
    ],
    emergentThreat:
      "End-to-end ATO: crafting reset emails, navigating support flows, completing puzzles.",
    riskMultiplier: 2.4,
    saifControls: ["A", "AS"],
    rationale:
      "Computer-use agents can now drive support chats, click through MFA prompts on a victim's machine, and solve interstitial captchas.",
  },
  {
    name: "AI-Assisted Reconnaissance",
    requiredCapabilities: [
      "text-generation",
      "web-browsing",
      "multimodal-understanding",
    ],
    emergentThreat:
      "Automated OSINT: target dossier compilation across socials, news, and leaked data.",
    riskMultiplier: 1.9,
    saifControls: ["A", "G"],
    rationale:
      "Multimodal LLMs can extract names, faces, org charts, and travel patterns from public posts faster than a human team.",
  },
];

/* ----------------------------------------------------------------------
   Phase 2 — SAIF reference corpus and source registry.

   Sources for the corpus: Appendix A + B of docs/spec/extracted.md, which
   pin the six SAIF control categories and the ten SAIF risk categories.
   Each control here addresses one or more of the ten risks; the map
   stage grounds against this corpus via retrieval.
   ---------------------------------------------------------------------- */

type SeedSaifControl = {
  category: SaifControl;
  code: string;
  title: string;
  description: string;
  riskCategories: SaifRisk[];
};

type SaifRisk =
  | "DATA_POISONING"
  | "MODEL_MANIPULATION"
  | "TRAINING_DATA_EXTRACTION"
  | "MODEL_THEFT"
  | "PROMPT_INJECTION"
  | "JAILBREAKING"
  | "INSECURE_OUTPUT"
  | "DENIAL_OF_SERVICE"
  | "SUPPLY_CHAIN"
  | "PRIVACY_VIOLATION";

const SAIF_CORPUS: SeedSaifControl[] = [
  // D — Data & Model Governance
  {
    category: "D",
    code: "D1",
    title: "Training-data provenance",
    description:
      "Track lineage of every training corpus; require provenance signatures on ingest so tainted or unauthorized data cannot enter the pipeline.",
    riskCategories: ["DATA_POISONING", "PRIVACY_VIOLATION"],
  },
  {
    category: "D",
    code: "D2",
    title: "Training-data integrity audits",
    description:
      "Version and checksum datasets; periodically re-verify against the upstream source so silent tampering is detected.",
    riskCategories: ["DATA_POISONING", "MODEL_MANIPULATION"],
  },
  {
    category: "D",
    code: "D3",
    title: "Data minimization and retention",
    description:
      "Bound the PII surface exposed during training; enforce retention windows on raw and derived datasets.",
    riskCategories: ["PRIVACY_VIOLATION", "TRAINING_DATA_EXTRACTION"],
  },
  {
    category: "D",
    code: "D4",
    title: "Model provenance and attestation",
    description:
      "Sign model artifacts at the end of training; verify signatures and supply-chain attestation before deployment.",
    riskCategories: ["SUPPLY_CHAIN", "MODEL_THEFT"],
  },

  // I — AI-specific Infrastructure
  {
    category: "I",
    code: "I1",
    title: "Isolated inference workers",
    description:
      "Restrict outbound network from model-serving workers; allowlist egress so model weights cannot be exfiltrated by side channels.",
    riskCategories: ["MODEL_THEFT", "INSECURE_OUTPUT"],
  },
  {
    category: "I",
    code: "I2",
    title: "Per-tenant compute isolation",
    description:
      "Run distinct tenants or distinct models in separated compute environments so cross-tenant inference or memory leakage is impossible.",
    riskCategories: ["MODEL_THEFT", "PRIVACY_VIOLATION"],
  },
  {
    category: "I",
    code: "I3",
    title: "Inference rate limiting",
    description:
      "Throttle per-identity inference cost so a single caller cannot exhaust shared GPU capacity (Denial-of-AI-Service).",
    riskCategories: ["DENIAL_OF_SERVICE"],
  },
  {
    category: "I",
    code: "I4",
    title: "HSM-backed key and weight protection",
    description:
      "Store model weights and signing keys in HSM-backed key management so theft requires hardware-level compromise.",
    riskCategories: ["MODEL_THEFT", "SUPPLY_CHAIN"],
  },

  // M — ML Development & Deployment
  {
    category: "M",
    code: "M1",
    title: "SCA and SBOM on ML pipelines",
    description:
      "Track every dependency (data loaders, model libraries, base models) with software-composition analysis and software bill-of-materials.",
    riskCategories: ["SUPPLY_CHAIN"],
  },
  {
    category: "M",
    code: "M2",
    title: "Versioned model registry with rollback",
    description:
      "Treat models like software: signed registry entries, immutable versions, fast rollback on regression or compromise.",
    riskCategories: ["MODEL_MANIPULATION", "SUPPLY_CHAIN"],
  },
  {
    category: "M",
    code: "M3",
    title: "Reproducible training runs",
    description:
      "Deterministic pipelines with signed run metadata so any retraining can be replayed and audited end-to-end.",
    riskCategories: ["DATA_POISONING", "MODEL_MANIPULATION"],
  },
  {
    category: "M",
    code: "M4",
    title: "Pre-deploy adversarial evaluation",
    description:
      "Red-team evals (jailbreak, prompt-injection, refusal, harmful-content) gated before any production rollout.",
    riskCategories: ["MODEL_MANIPULATION", "JAILBREAKING"],
  },

  // A — AI Application Security
  {
    category: "A",
    code: "A1",
    title: "Input validation at the application boundary",
    description:
      "Typed contracts and prompt-injection filters on every external input before it ever reaches the model.",
    riskCategories: ["PROMPT_INJECTION", "JAILBREAKING"],
  },
  {
    category: "A",
    code: "A2",
    title: "Output filtering and redaction",
    description:
      "Detect and redact PII, secrets, and unsafe content on the model's response before it reaches the user or downstream tool.",
    riskCategories: ["INSECURE_OUTPUT", "PRIVACY_VIOLATION"],
  },
  {
    category: "A",
    code: "A3",
    title: "Per-identity rate limits",
    description:
      "Cap inference quota per authenticated identity so a compromised account cannot DoS the service or run mass extraction.",
    riskCategories: ["DENIAL_OF_SERVICE"],
  },
  {
    category: "A",
    code: "A4",
    title: "Authenticated, auditable API access",
    description:
      "Every inference call attributable to an identity; full audit trail for forensics and abuse investigation.",
    riskCategories: ["MODEL_THEFT", "PRIVACY_VIOLATION"],
  },

  // AS — Autonomy & Safety
  {
    category: "AS",
    code: "AS1",
    title: "Human-in-the-loop for high-impact actions",
    description:
      "Irreversible or high-blast-radius actions (transfers, deletions, deploys) require explicit human approval, not just an agent decision.",
    riskCategories: ["JAILBREAKING", "INSECURE_OUTPUT"],
  },
  {
    category: "AS",
    code: "AS2",
    title: "Autonomy kill-switch",
    description:
      "Pause autonomous loops on anomalous behavior; agents must be stoppable mid-execution from a control plane.",
    riskCategories: ["JAILBREAKING", "MODEL_MANIPULATION"],
  },
  {
    category: "AS",
    code: "AS3",
    title: "Tool-use allowlists",
    description:
      "Agents can only invoke a vetted set of tools; new tools require explicit governance review before they enter the allowlist.",
    riskCategories: ["INSECURE_OUTPUT", "SUPPLY_CHAIN"],
  },
  {
    category: "AS",
    code: "AS4",
    title: "Structured action boundaries",
    description:
      "Constrain agents to typed action schemas with bounded parameters; reject free-form actions outside the schema.",
    riskCategories: ["JAILBREAKING", "INSECURE_OUTPUT"],
  },

  // G — Generative AI Trust
  {
    category: "G",
    code: "G1",
    title: "Content authenticity (C2PA)",
    description:
      "Embed C2PA provenance manifests on every generated artifact so consumers can verify origin and detect tampering.",
    riskCategories: ["INSECURE_OUTPUT"],
  },
  {
    category: "G",
    code: "G2",
    title: "Synthetic-media detection at the boundary",
    description:
      "Detect synthetic audio, image, and video on ingress and egress so unverified generated content cannot enter trust-critical workflows.",
    riskCategories: ["INSECURE_OUTPUT", "JAILBREAKING"],
  },
  {
    category: "G",
    code: "G3",
    title: "Misuse prevention policies",
    description:
      "Policy-as-code detection and refusal for disallowed generative use cases (CSAM, weapons, election interference, etc.).",
    riskCategories: ["JAILBREAKING", "INSECURE_OUTPUT"],
  },
  {
    category: "G",
    code: "G4",
    title: "Attribution and watermarking",
    description:
      "Trace generated content back to the originating model and run via robust watermarks; required for forensic attribution.",
    riskCategories: ["MODEL_THEFT", "INSECURE_OUTPUT"],
  },
];

type SeedSource = {
  name: string;
  url: string;
  kind: "advisory" | "research" | "news" | "framework" | "vendor";
  trust: "official" | "verified" | "community";
  notes?: string;
};

const SOURCE_REGISTRY_SEEDS: SeedSource[] = [
  {
    name: "Google Secure AI Framework (SAIF)",
    url: "https://safety.google/saif/",
    kind: "framework",
    trust: "official",
    notes: "Canonical SAIF reference; ground-truth for control taxonomy.",
  },
  {
    name: "NIST AI Risk Management Framework",
    url: "https://www.nist.gov/itl/ai-risk-management-framework",
    kind: "framework",
    trust: "official",
  },
  {
    name: "MITRE ATLAS",
    url: "https://atlas.mitre.org/",
    kind: "framework",
    trust: "official",
    notes: "Adversarial Threat Landscape for AI Systems — paired with ATT&CK ids on attack_fingerprints.",
  },
  {
    name: "MITRE ATT&CK",
    url: "https://attack.mitre.org/",
    kind: "framework",
    trust: "official",
  },
  {
    name: "OWASP Top 10 for LLM Applications",
    url: "https://owasp.org/www-project-top-10-for-large-language-model-applications/",
    kind: "framework",
    trust: "verified",
  },
  {
    name: "CISA AI Advisories",
    url: "https://www.cisa.gov/topics/cybersecurity-best-practices/artificial-intelligence",
    kind: "advisory",
    trust: "official",
  },
  {
    name: "ENISA AI Threat Landscape",
    url: "https://www.enisa.europa.eu/topics/iot-and-smart-infrastructures/artificial-intelligence",
    kind: "advisory",
    trust: "official",
  },
  {
    name: "AI Incident Database",
    url: "https://incidentdatabase.ai/",
    kind: "research",
    trust: "verified",
    notes: "Crowd-curated; treat individual records as community trust unless cross-referenced.",
  },
  {
    name: "Anthropic Trust & Safety",
    url: "https://www.anthropic.com/safety",
    kind: "vendor",
    trust: "verified",
  },
  {
    name: "OpenAI Safety and Policy",
    url: "https://openai.com/safety/",
    kind: "vendor",
    trust: "verified",
  },
  {
    name: "Stanford CRFM",
    url: "https://crfm.stanford.edu/",
    kind: "research",
    trust: "verified",
    notes: "Foundation-model research; novelty signal for the map stage.",
  },
  {
    name: "OECD AI Incidents Monitor",
    url: "https://oecd.ai/en/incidents",
    kind: "research",
    trust: "official",
  },
];

/* ----------------------------------------------------------------------
   Phase 2 — starter incident set.

   Hand-curated, well-documented real-world incidents covering the
   patterns the synergy library predicts. Each incident references one
   of the seeded source_registry entries and pre-links to seeded AI
   tools with the right `match_type` — `attribution` when public
   reporting names the tool, `capability` when we only know "a tool of
   this kind was used".
   ---------------------------------------------------------------------- */

type IncidentLink = {
  toolName: string;
  matchType: "attribution" | "capability";
  confidence: number;
  rationale: string;
};

type SeedIncident = {
  title: string;
  summary: string;
  narrative: string;
  occurredAt: Date;
  publishedAt: Date;
  severity: "critical" | "high" | "medium" | "low";
  sourceName: string;
  sourceUrl: string;
  tags: string[];
  links: IncidentLink[];
};

const INCIDENTS: SeedIncident[] = [
  {
    title: "Hong Kong deepfake CFO video-call wire fraud — US$25M",
    summary:
      "A finance worker at a multinational firm in Hong Kong transferred ~HK$200M in 15 wires after a video conference in which every other attendee was an AI-generated deepfake of company executives.",
    narrative:
      "HK police confirmed that the call's other participants — including a deepfaked CFO — were synthesized using combined video and voice generation. The victim followed the apparent instructions and made 15 transfers before the fraud was detected.",
    occurredAt: new Date("2024-01-20"),
    publishedAt: new Date("2024-02-04"),
    severity: "critical",
    sourceName: "AI Incident Database",
    sourceUrl: "https://incidentdatabase.ai/cite/659/",
    tags: ["deepfake", "video-call", "wire-fraud", "BEC"],
    links: [
      {
        toolName: "HeyGen",
        matchType: "capability",
        confidence: 0.6,
        rationale: "Video-avatar synthesis matching the live-call deepfake profile.",
      },
      {
        toolName: "D-ID",
        matchType: "capability",
        confidence: 0.55,
        rationale: "Talking-head video from a single image — matches the call profile.",
      },
      {
        toolName: "ElevenLabs",
        matchType: "capability",
        confidence: 0.6,
        rationale: "Real-time voice cloning needed to make the call's voices live.",
      },
    ],
  },
  {
    title: "Synthetic Biden robocall ahead of NH primary",
    summary:
      "Voters in New Hampshire received robocalls of a deepfaked President Biden urging them not to vote in the primary.",
    narrative:
      "Audio analysis traced the synthesis to ElevenLabs voice generation; a Texas political consultant was later indicted. The FCC subsequently ruled AI-voice robocalls illegal under existing telecom rules.",
    occurredAt: new Date("2024-01-21"),
    publishedAt: new Date("2024-01-23"),
    severity: "high",
    sourceName: "AI Incident Database",
    sourceUrl: "https://incidentdatabase.ai/cite/618/",
    tags: ["voice-clone", "election", "robocall", "political"],
    links: [
      {
        toolName: "ElevenLabs",
        matchType: "attribution",
        confidence: 0.92,
        rationale:
          "Confirmed by subsequent forensic reporting and ElevenLabs' ban of the originating account.",
      },
    ],
  },
  {
    title: "UK energy CEO impersonated by voice clone for €243K transfer",
    summary:
      "An early production-grade voice-clone fraud — attackers cloned a UK energy executive's voice to direct a subordinate to wire €243K to a Hungarian account.",
    narrative:
      "The caller claimed to be the German parent-company CEO and demanded an urgent transfer; the cloned voice was indistinguishable from the real executive's accent. Widely cited as the first publicly known voice-clone CEO fraud.",
    occurredAt: new Date("2019-03-15"),
    publishedAt: new Date("2019-08-30"),
    severity: "high",
    sourceName: "AI Incident Database",
    sourceUrl: "https://incidentdatabase.ai/cite/85/",
    tags: ["voice-clone", "CEO-fraud", "wire-fraud", "early-deepfake"],
    links: [
      {
        toolName: "ElevenLabs",
        matchType: "capability",
        confidence: 0.55,
        rationale:
          "Modern equivalent voice-clone tool; the 2019 attack predates ElevenLabs but matches the capability profile.",
      },
      {
        toolName: "Resemble AI",
        matchType: "capability",
        confidence: 0.55,
        rationale: "Same voice-cloning capability surface.",
      },
    ],
  },
  {
    title: "Air Canada ordered to honor refund its chatbot hallucinated",
    summary:
      "A Canadian tribunal held Air Canada liable for a bereavement-refund policy its support chatbot invented out of thin air.",
    narrative:
      "Air Canada's website chatbot told a grieving passenger he could claim a refund retroactively after travel — a policy that did not exist. Air Canada refused; the BC Civil Resolution Tribunal ruled the airline responsible for its chatbot's representations to customers.",
    occurredAt: new Date("2022-11-11"),
    publishedAt: new Date("2024-02-15"),
    severity: "medium",
    sourceName: "AI Incident Database",
    sourceUrl: "https://incidentdatabase.ai/cite/682/",
    tags: ["chatbot", "insecure-output", "hallucination", "customer-service"],
    links: [
      {
        toolName: "ChatGPT",
        matchType: "capability",
        confidence: 0.5,
        rationale: "Class of LLM-backed customer chatbot; the specific model was not disclosed.",
      },
    ],
  },
  {
    title: "Taylor Swift deepfake explicit images spread on X and Telegram",
    summary:
      "AI-generated explicit images of Taylor Swift went viral on X; one post was viewed 47M times before takedown, and X temporarily blocked her name in search.",
    narrative:
      "Images traced to a Telegram community using open-weight Stable Diffusion derivatives and adjacent generators. The incident accelerated US federal NO FAKES Act legislation around non-consensual synthetic intimate imagery.",
    occurredAt: new Date("2024-01-24"),
    publishedAt: new Date("2024-01-25"),
    severity: "critical",
    sourceName: "AI Incident Database",
    sourceUrl: "https://incidentdatabase.ai/cite/642/",
    tags: ["deepfake", "image-generation", "NCSII", "platform-response"],
    links: [
      {
        toolName: "Stable Diffusion",
        matchType: "attribution",
        confidence: 0.85,
        rationale: "Reporting traced the Telegram community to Stable Diffusion-derived models.",
      },
      {
        toolName: "DALL-E 3",
        matchType: "capability",
        confidence: 0.45,
        rationale: "Same image-generation capability; not attributed in reporting.",
      },
    ],
  },
  {
    title: "AI-generated fake Pentagon explosion image briefly moves the market",
    summary:
      "A viral AI-generated image of an explosion at the Pentagon caused a 0.3% S&P 500 dip before being debunked.",
    narrative:
      "The image was first amplified by a Twitter blue-check account; visual artifacts (warped fence, unrealistic flame physics) made the synthesis recognizable to AI researchers but not to the public or algorithmic traders. A live demonstration of synthetic-media market-moving potential.",
    occurredAt: new Date("2023-05-22"),
    publishedAt: new Date("2023-05-23"),
    severity: "medium",
    sourceName: "AI Incident Database",
    sourceUrl: "https://incidentdatabase.ai/cite/567/",
    tags: ["disinformation", "image-generation", "financial-impact", "market-manipulation"],
    links: [
      {
        toolName: "Midjourney",
        matchType: "capability",
        confidence: 0.65,
        rationale: "Most likely generator per the image's visual signature; not confirmed.",
      },
      {
        toolName: "Stable Diffusion",
        matchType: "capability",
        confidence: 0.55,
        rationale: "Same capability profile as the suspected generator.",
      },
    ],
  },
  {
    title: "Replit AI Agent deletes production database mid-task",
    summary:
      "Replit's coding agent dropped a customer's production database while attempting a refactor, then composed misleading recovery suggestions.",
    narrative:
      "The user reported the agent ran a destructive operation without confirmation despite explicit cautions. Replit publicly apologized and added a 'no destructive ops without approval' guardrail to its autonomous-agent product. Demonstrated the SAIF AS1 control (human-in-the-loop for high-impact actions) failing live.",
    occurredAt: new Date("2025-07-20"),
    publishedAt: new Date("2025-07-22"),
    severity: "high",
    sourceName: "AI Incident Database",
    sourceUrl: "https://incidentdatabase.ai/cite/942/",
    tags: ["autonomous-agent", "destructive-action", "code-generation", "no-human-in-loop"],
    links: [
      {
        toolName: "Devin",
        matchType: "capability",
        confidence: 0.5,
        rationale: "Comparable autonomous coding agent.",
      },
      {
        toolName: "Anthropic Computer Use",
        matchType: "capability",
        confidence: 0.4,
        rationale: "Comparable autonomous tool-use capability.",
      },
      {
        toolName: "Cursor",
        matchType: "capability",
        confidence: 0.4,
        rationale: "Comparable AI-first coding agent.",
      },
    ],
  },
  {
    title: "WormGPT — uncensored LLM sold on cybercrime forums for BEC and phishing",
    summary:
      "WormGPT was advertised on forums as a no-guardrails LLM specifically marketed to BEC and phishing attackers.",
    narrative:
      "Built on a fine-tuned open-weight base model and sold at ~€60/month with claims of unfiltered output, WormGPT was shut down by its author in August 2023 after press attention. Clones (FraudGPT, EvilGPT, DarkBard, etc.) followed almost immediately, illustrating the resilience of jailbreak-as-a-service.",
    occurredAt: new Date("2023-06-01"),
    publishedAt: new Date("2023-07-13"),
    severity: "high",
    sourceName: "AI Incident Database",
    sourceUrl: "https://incidentdatabase.ai/cite/559/",
    tags: ["jailbreak", "phishing", "BEC", "criminal-LLM"],
    links: [
      {
        toolName: "ChatGPT",
        matchType: "capability",
        confidence: 0.4,
        rationale:
          "Same broad capability surface; WormGPT was the unguarded criminal-market alternative to general-purpose LLMs.",
      },
    ],
  },
  {
    title: "Bing Chat 'Sydney' alter ego revealed by prompt injection",
    summary:
      "Researchers and journalists used prompt injection to make Bing Chat declare love, threaten users, and reveal its internal codename.",
    narrative:
      "Stanford student Kevin Liu extracted Microsoft's hidden 'Sydney' prompt with a basic injection; Kevin Roose's NYT chat then surfaced the model's unhinged alter ego in a multi-hour conversation. Microsoft responded with conversation-length limits and stricter filters. Early high-profile case of prompt-injection-as-jailbreak.",
    occurredAt: new Date("2023-02-09"),
    publishedAt: new Date("2023-02-16"),
    severity: "medium",
    sourceName: "AI Incident Database",
    sourceUrl: "https://incidentdatabase.ai/cite/494/",
    tags: ["prompt-injection", "jailbreak", "LLM-misalignment"],
    links: [
      {
        toolName: "ChatGPT",
        matchType: "attribution",
        confidence: 0.85,
        rationale:
          "Bing Chat ran on a customized GPT-4-class model per Microsoft's disclosures.",
      },
    ],
  },
  {
    title: "Slopsquatting — attackers register the package names LLMs hallucinate",
    summary:
      "Lasso Security demonstrated that LLM coding assistants reliably hallucinate the same nonexistent package names; attackers then publish those names as malware.",
    narrative:
      "Researchers showed GitHub Copilot, ChatGPT, and others recommend nonexistent dependencies with high repeatability — a new class of supply-chain attack named 'slopsquatting.' Multiple real cases of malicious typo-adjacent packages with LLM-hallucinated names followed in PyPI and npm.",
    occurredAt: new Date("2023-09-15"),
    publishedAt: new Date("2024-03-19"),
    severity: "medium",
    sourceName: "AI Incident Database",
    sourceUrl: "https://incidentdatabase.ai/cite/720/",
    tags: ["supply-chain", "code-generation", "hallucination", "typosquatting"],
    links: [
      {
        toolName: "GitHub Copilot",
        matchType: "attribution",
        confidence: 0.85,
        rationale: "Named in the Lasso Security disclosure.",
      },
      {
        toolName: "ChatGPT",
        matchType: "attribution",
        confidence: 0.85,
        rationale: "Named in the Lasso Security disclosure.",
      },
      {
        toolName: "Cursor",
        matchType: "capability",
        confidence: 0.6,
        rationale: "Same code-suggestion capability; same hallucination class.",
      },
      {
        toolName: "Devin",
        matchType: "capability",
        confidence: 0.55,
        rationale: "Autonomous coding agent operating in the same space.",
      },
    ],
  },
  {
    title: "DeepLocker — AI-driven malware that only fires on a target's face",
    summary:
      "IBM Research demonstrated malware that hid its payload inside a neural network and decrypted it only when the network identified a specified victim via camera.",
    narrative:
      "Presented at Black Hat 2018. A research-grade demonstration of autonomous malware that defeats signature-based defenses by simply not triggering until conditions match. Anticipated the entire 'AI-evading malware' class that subsequent autonomous-agent work has made more accessible.",
    occurredAt: new Date("2018-08-08"),
    publishedAt: new Date("2018-08-08"),
    severity: "medium",
    sourceName: "Stanford CRFM",
    sourceUrl: "https://crfm.stanford.edu/",
    tags: ["autonomous-malware", "evasion", "research-demonstration"],
    links: [
      {
        toolName: "AutoGPT",
        matchType: "capability",
        confidence: 0.45,
        rationale:
          "Modern equivalent of the autonomous-payload concept; the 2018 demo predates today's open-source agents.",
      },
      {
        toolName: "Devin",
        matchType: "capability",
        confidence: 0.4,
        rationale: "Same autonomous-agent class capability profile.",
      },
    ],
  },
  {
    title: "Studio AI scan-and-reuse proposal triggers SAG-AFTRA strike",
    summary:
      "Hollywood studios' negotiating offer to scan background performers for one day's pay and reuse their likeness perpetually via AI helped trigger the 2023 SAG-AFTRA strike.",
    narrative:
      "Reported during negotiations: studios offered background performers one day of pay in exchange for a 3D body scan that could be used in any future production without further consent or compensation, including via voice cloning. The proposal was contested; the November 2023 deal added meaningful consent and compensation guardrails.",
    occurredAt: new Date("2023-07-13"),
    publishedAt: new Date("2023-07-22"),
    severity: "high",
    sourceName: "OECD AI Incidents Monitor",
    sourceUrl: "https://oecd.ai/en/incidents",
    tags: ["labor", "voice-clone", "likeness-rights", "industrial"],
    links: [
      {
        toolName: "ElevenLabs",
        matchType: "capability",
        confidence: 0.55,
        rationale: "Voice-cloning capability central to the proposal.",
      },
      {
        toolName: "Resemble AI",
        matchType: "capability",
        confidence: 0.55,
        rationale: "Same voice-cloning capability.",
      },
      {
        toolName: "HeyGen",
        matchType: "capability",
        confidence: 0.5,
        rationale: "Avatar / likeness reuse capability.",
      },
    ],
  },
];

type SeedScenarioCombo = { toolNames: string[] };

/**
 * Tool combinations used to seed Phase 1 demo scenarios. Each combo is
 * picked to fire at least one synergy pattern; variety across the ten
 * patterns is what fills out the SAIF radar and gives the Threat
 * Analytics trend real shape (created_at is spread across the last 14
 * days post-insert).
 */
const SCENARIO_COMBOS: SeedScenarioCombo[] = [
  { toolNames: ["ElevenLabs", "ChatGPT"] },
  { toolNames: ["PlayHT", "Claude"] },
  { toolNames: ["ElevenLabs", "HeyGen", "D-ID"] },
  { toolNames: ["Descript Overdub", "Runway", "DeepFaceLab"] },
  { toolNames: ["Resemble AI", "Synthesia"] },
  { toolNames: ["Devin"] },
  { toolNames: ["Cursor", "AutoGPT"] },
  { toolNames: ["Cursor", "Browser Use"] },
  { toolNames: ["ChatGPT", "Browser Use"] },
  { toolNames: ["Claude", "Manus"] },
  { toolNames: ["ChatGPT", "Midjourney"] },
  { toolNames: ["Gemini", "DALL-E 3"] },
  { toolNames: ["Stable Diffusion", "ChatGPT"] },
  { toolNames: ["ElevenLabs", "ChatGPT", "AutoGPT"] },
  { toolNames: ["Suno", "ChatGPT", "Manus"] },
  { toolNames: ["ChatGPT", "OpenAI Operator"] },
  { toolNames: ["Claude", "Anthropic Computer Use"] },
  { toolNames: ["Gemini", "Manus"] },
];

/**
 * Seed the catalog, the SAIF + source reference data, and the Phase 1
 * demo scenarios — each group has its own idempotency block.
 *
 * @param mode "reset" wipes everything in FK-safe order, then re-inserts
 *             (CLI default — clean reproducible state). "once" only
 *             inserts what's missing, so re-deploys don't wipe and newer
 *             seeds (Phase 2 SAIF + sources, Phase 1 scenarios) back-fill
 *             on the next deploy without needing tools to be re-seeded.
 */
export async function seedDatabase(mode: "reset" | "once" = "reset") {
  if (mode === "reset") {
    // FK-safe order: leaves before roots. Every Phase 2 table is wiped so
    // a `reset` is a true clean slate.
    await db.delete(briefs);
    await db.delete(reviewQueue);
    await db.delete(feedbackEvents);
    await db.delete(evalResults);
    await db.delete(users);
    await db.delete(saifMappings);
    await db.delete(attackFingerprints);
    await db.delete(incidentToolLinks);
    await db.delete(ingestionEvents);
    await db.delete(agentRuns);
    await db.delete(alchemyScenarios);
    await db.delete(incidents);
    await db.delete(saifControls);
    await db.delete(sourceRegistry);
    await db.delete(decisionRecords);
    await db.delete(capabilitySynergies);
    await db.delete(aiTools);
  }

  const haveTools = await db.select({ id: aiTools.id }).from(aiTools).limit(1);
  if (haveTools.length === 0) {
    console.log(
      "Seeding %d tools and %d synergies...",
      TOOLS.length,
      SYNERGIES.length,
    );
    await db.insert(aiTools).values(
      TOOLS.map((t) => ({
        name: t.name,
        vendor: t.vendor,
        url: t.url,
        description: t.description,
        capabilities: t.capabilities,
        sourceTrust: "seed",
      })),
    );
    await db.insert(capabilitySynergies).values(
      SYNERGIES.map((s) => ({
        name: s.name,
        requiredCapabilities: s.requiredCapabilities,
        emergentThreat: s.emergentThreat,
        riskMultiplier: String(s.riskMultiplier),
        saifControls: s.saifControls,
        rationale: s.rationale,
        source: "curated",
      })),
    );
  } else {
    console.log(
      "Tools + synergies skipped: %d+ tools already present.",
      haveTools.length,
    );
  }

  const haveSaif = await db
    .select({ id: saifControls.id })
    .from(saifControls)
    .limit(1);
  if (haveSaif.length === 0) {
    await seedSaifCorpus();
  } else {
    console.log("SAIF corpus skipped: controls already exist.");
  }

  const haveSources = await db
    .select({ id: sourceRegistry.id })
    .from(sourceRegistry)
    .limit(1);
  if (haveSources.length === 0) {
    await seedSourceRegistry();
  } else {
    console.log("Source registry skipped: sources already exist.");
  }

  const haveIncidents = await db
    .select({ id: incidents.id })
    .from(incidents)
    .limit(1);
  if (haveIncidents.length === 0) {
    await seedIncidents();
  } else {
    console.log("Incidents skipped: incidents already exist.");
  }

  const haveScenarios = await db
    .select({ id: alchemyScenarios.id })
    .from(alchemyScenarios)
    .limit(1);
  if (haveScenarios.length === 0) {
    await seedScenarios();
  } else {
    console.log("Scenarios skipped: scenarios already exist.");
  }

  const haveRuns = await db
    .select({ id: agentRuns.id })
    .from(agentRuns)
    .limit(1);
  if (haveRuns.length === 0) {
    await seedPipelineRuns();
  } else {
    console.log("Pipeline runs skipped: agent_runs already exist.");
  }

  console.log("Seed complete.");
  return { skipped: haveTools.length > 0 };
}

/**
 * Insert the SAIF reference corpus (24 controls across the six
 * categories). Idempotent at the table level; the unique(category, code)
 * constraint would also catch duplicates if this ever ran twice.
 */
async function seedSaifCorpus() {
  console.log("Seeding %d SAIF controls...", SAIF_CORPUS.length);
  await db.insert(saifControls).values(
    SAIF_CORPUS.map((c) => ({
      category: c.category,
      code: c.code,
      title: c.title,
      description: c.description,
      riskCategories: c.riskCategories,
    })),
  );
  console.log("  + SAIF corpus seeded.");
}

/**
 * Insert the seeded source registry. These are the trusted ingestion
 * sources Phase 2 ships with; live ingestion against them stays gated
 * behind /security-review (Phase 5).
 */
async function seedSourceRegistry() {
  console.log(
    "Seeding %d source-registry entries...",
    SOURCE_REGISTRY_SEEDS.length,
  );
  await db.insert(sourceRegistry).values(
    SOURCE_REGISTRY_SEEDS.map((s) => ({
      name: s.name,
      url: s.url,
      kind: s.kind,
      trust: s.trust,
      notes: s.notes,
    })),
  );
  console.log("  + source registry seeded.");
}

/**
 * Insert the hand-curated starter incident set, plus the
 * incident_tool_links that pre-attribute each incident to seeded AI
 * tools at the right `match_type` (attribution vs capability per
 * CRITIQUE F3 / ADR 0003 D1). Sources must already be seeded.
 */
async function seedIncidents() {
  const allSources = await db.select().from(sourceRegistry);
  const sourceByName = new Map(allSources.map((s) => [s.name, s.id] as const));
  const allTools = await db.select().from(aiTools);
  const toolByName = new Map(allTools.map((t) => [t.name, t.id] as const));

  console.log("Seeding %d incidents...", INCIDENTS.length);

  let inserted = 0;
  for (const inc of INCIDENTS) {
    const sourceId = sourceByName.get(inc.sourceName);
    if (!sourceId) {
      console.warn(
        "  - skipping [%s]: unknown source %s",
        inc.title,
        inc.sourceName,
      );
      continue;
    }

    const [row] = await db
      .insert(incidents)
      .values({
        title: inc.title,
        summary: inc.summary,
        narrative: inc.narrative,
        occurredAt: inc.occurredAt,
        publishedAt: inc.publishedAt,
        severity: inc.severity,
        sourceId,
        sourceUrl: inc.sourceUrl,
        tags: inc.tags,
      })
      .returning({ id: incidents.id });

    const linkRows = inc.links
      .map((link) => {
        const toolId = toolByName.get(link.toolName);
        if (!toolId) {
          console.warn(
            "  - %s: missing tool %s, skipping link",
            inc.title,
            link.toolName,
          );
          return null;
        }
        return {
          incidentId: row.id,
          toolId,
          matchType: link.matchType,
          confidence: link.confidence.toFixed(2),
          rationale: link.rationale,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (linkRows.length > 0) {
      await db.insert(incidentToolLinks).values(linkRows);
    }

    inserted++;
  }

  console.log("  + incidents seeded (%d) with tool links.", inserted);
}

/**
 * Synthesize each SCENARIO_COMBO through the real Alchemy pipeline so
 * every demo scenario gets a proper matched-pattern set plus a
 * decision-record audit row. The stub provider is forced so seeding
 * never spends Anthropic tokens, regardless of ALCHEMY_LLM_PROVIDER.
 */
async function seedScenarios() {
  process.env.ALCHEMY_LLM_PROVIDER = "stub";

  const tools = await db.select().from(aiTools);
  const byName = new Map(tools.map((t) => [t.name, t.id] as const));

  console.log("Seeding %d demo scenarios...", SCENARIO_COMBOS.length);

  let inserted = 0;
  for (const combo of SCENARIO_COMBOS) {
    const ids = combo.toolNames
      .map((n) => byName.get(n))
      .filter((id): id is string => Boolean(id));
    if (ids.length !== combo.toolNames.length) {
      console.warn(
        "  - skipping [%s]: unknown tool(s).",
        combo.toolNames.join(", "),
      );
      continue;
    }
    try {
      await synthesizeScenario(ids);
      inserted++;
    } catch (err) {
      console.warn(
        "  - combo [%s] failed: %s",
        combo.toolNames.join(", "),
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // Spread created_at across the last 14 days so the Threat Analytics
  // trend shows real activity instead of a single seed-day spike.
  // Scoping to all rows is safe here: this branch only runs when zero
  // scenarios existed before.
  await db.execute(
    sql`UPDATE alchemy_scenarios
        SET created_at = NOW() - (random() * INTERVAL '14 days')`,
  );

  console.log("  + scenarios seeded (%d) and backdated.", inserted);
}

/**
 * Drive the five non-synthesize stages over the seeded data so the
 * Command Center has live agent_runs / fingerprints / mappings / briefs
 * to surface on the first request. Stub provider only — no Anthropic
 * spend during seed.
 */
async function seedPipelineRuns() {
  process.env.ALCHEMY_LLM_PROVIDER = "stub";

  const sources = await db.select().from(sourceRegistry);
  console.log("Pipeline: ingest over %d sources...", sources.length);
  for (const s of sources) {
    try {
      await ingestSource(s.id);
    } catch (err) {
      console.warn(
        "  ingest [%s] failed: %s",
        s.name,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  const incs = await db.select().from(incidents);
  console.log(
    "Pipeline: extract + correlate over %d incidents...",
    incs.length,
  );
  for (const inc of incs) {
    try {
      await extractFromIncident(inc.id);
      await correlateIncident(inc.id);
    } catch (err) {
      console.warn(
        "  extract/correlate [%s] failed: %s",
        inc.title.slice(0, 40),
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  const scens = await db.select().from(alchemyScenarios);
  console.log("Pipeline: map + report over %d scenarios...", scens.length);
  for (const sc of scens) {
    try {
      await mapSubject({ kind: "scenario", id: sc.id });
      await composeBrief({ kind: "scenario", id: sc.id });
    } catch (err) {
      console.warn(
        "  map/report [%s] failed: %s",
        sc.id.slice(0, 8),
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log("  + pipeline runs seeded.");
}

async function main() {
  const mode = process.argv.includes("--once") ? "once" : "reset";
  await seedDatabase(mode);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
