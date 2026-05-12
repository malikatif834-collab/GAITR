import { db } from "./client";
import { aiTools, capabilitySynergies } from "./schema";
import type { Capability, SaifControl } from "./capabilities";

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

async function main() {
  console.log("Seeding %d tools and %d synergies...", TOOLS.length, SYNERGIES.length);

  await db.delete(capabilitySynergies);
  await db.delete(aiTools);

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

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
