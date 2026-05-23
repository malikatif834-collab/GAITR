# GAITR agent specs

This folder is the durable home for every GAITR **agent capability spec** — one
file per agent, `docs/agents/<name>.md`. CLAUDE.md requires that every prompt
change to an agent bumps a `{agentName}@{semver}` version and lands here.

See `docs/decisions/0004-agent-design.md` for the agent taxonomy and the
reasoning behind why GAITR has exactly three agents.

## What an agent is

A component is an *agent* only if it plans a multi-step course of action and
chooses its own tool calls. Single schema-constrained LLM calls (`extract`,
`map`, `report`) and deterministic code (`ingest`, the Governance Gate) are
**not** agents and do not get a spec here — they are covered by ADR 0003.

## Index

| Agent | Spec | Status |
|---|---|---|
| Orchestrator | `orchestrator.md` | `orchestrator@1.0.0` (Phase 3, ADR 0005) — deterministic planner, no LLM in v1 |
| Synthesizer | `synthesizer.md` | Pending — back-fill from ADR 0002 (`lib/alchemy/`) |
| Discovery Scout | `discovery-scout.md` | Drafted (ADR 0004) |

## Spec template

Every agent spec has these ten sections (from ADR 0004, D3):

1. **Identity & role** — what it is, what it is responsible for.
2. **Tier & type** — placement in the 3-tier model.
3. **Capabilities (tools)** — exact tool set; tools it must *not* have, named.
4. **I/O contract** — typed input and output; tables and `status` values it
   may write.
5. **System prompt** — versioned prompt, or a pointer to its
   `lib/.../prompts/*.ts` module + current `{agentName}@{semver}`.
6. **Constraints & refusal rules** — negative prompts: must-not actions,
   injection resistance, output-channel restrictions, per-run caps.
7. **Few-shot examples** — canonical examples incl. ≥1 adversarial/refusal
   case; these seed the eval set.
8. **Eval set & acceptance threshold** — the labelled regression set and the
   bar a prompt-version bump must clear.
9. **Model assignment** — model via the provider abstraction; never hardcoded.
10. **Change log** — `{agentName}@{semver}` history with rationale per bump.

A spec is updated in the same commit as any change to the agent's prompt, tools,
or model.
