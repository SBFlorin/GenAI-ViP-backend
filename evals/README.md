# Paviagen DeepEval suite

This directory contains the offline quality checks for saved Paviagen
conversations. It is deliberately separate from the Express and WebRTC request
paths, so running DeepEval cannot increase the patient's response time.

## What is measured

The default deterministic check is `Paviagen Persona Consistency`. It fails a
conversation when structured metadata or a patient reply contradicts a critical
persona fact, including:

- selected scenario versus the stored patient snapshot;
- numbered case versus its exact persona order;
- interested versus uninterested quitting motivation;
- never-smoker and former-smoker status.

`--with-llm` adds four DeepEval multi-turn metrics:

- `RoleAdherenceMetric` — the assistant remains the virtual patient;
- `TurnRelevancyMetric` — patient replies address the student's turn;
- `Paviagen Clinical Persona Fidelity` — Romanian naturalness and full profile fidelity;
- `Paviagen Student Minimal Advice` — whether the student's consultation covers the expected minimal smoking-cessation behavior.

The last metric is an automated research aid. It should be calibrated against
the platform's human evaluator scores before it is treated as an assessment of
student competence.

## Installation

DeepEval is Python-based and is pinned in `requirements.txt` so its API does not
change unexpectedly between runs.

```sh
cd paviagen-server
python3 -m venv .venv-deepeval
source .venv-deepeval/bin/activate
python3 -m pip install -r evals/requirements.txt
```

The deterministic checks use only the Python standard library. They work before
DeepEval is installed.

## Commands

Run local unit tests:

```sh
npm run eval:test
```

Evaluate the latest saved conversations without an LLM judge:

```sh
npm run eval:persona -- --limit 20
```

Run all DeepEval metrics:

```sh
npm run eval:deepeval -- --limit 20
```

Useful filters and outputs:

```sh
# One or more exact conversations
npm run eval:deepeval -- --conversation-id 43 --conversation-id 44

# One training cohort
npm run eval:deepeval -- --scenario "Fumător interesat" --limit 50

# Machine-readable report and CI failure on any failed threshold
npm run eval:deepeval -- \
  --limit 50 \
  --output evals/results/latest.json \
  --fail-on-violation
```

Set `PAVIAGEN_EVAL_MODEL` to choose the judge model. If it is empty, DeepEval
uses its configured default. An `OPENAI_API_KEY` or another DeepEval-supported
judge configuration is required for `--with-llm`; deterministic evaluation does
not require a provider key.

## Privacy

The loader never selects the Users table, email addresses, usernames, or account
profile data. Email addresses and Romanian-style phone numbers found inside
conversation text are redacted by default before a judge sees them. Do not use
`--allow-sensitive-text` on real study data without an explicit data-governance
decision.

This automatic redaction is intentionally conservative and is not a complete
de-identification system: names or unusual identifiers may remain in free text.
Use only approved, de-identified study data with an external judge provider.

DeepEval runs locally, but LLM-as-a-judge metrics send the redacted transcript to
the configured model provider. No Confident AI login or upload is required by
this implementation.

## Voice timing

For new Realtime sessions, the report derives the gap from the detected end of
student speech to the first patient audio that is actually audible in the
browser. It reports the median and p95 and checks the initial targets of 1,000 ms
median and 2,000 ms p95. Older sessions recorded before audible-audio
instrumentation may still contain transcript-derived timing. New reports also
identify whether the session used semantic VAD or the server-silence trial.

DeepEval's acoustic voice metrics require actual per-turn audio clips and
call-relative start times. Paviagen currently stores transcripts and timing, not
the audio clips, so acoustic metrics are intentionally not enabled. Adding them
later requires consent, retention, and access rules for recordings.

## Files

- `paviagen_eval/loader.py` — read-only SQLite adapter and redaction;
- `paviagen_eval/persona_consistency.py` — deterministic critical-fact checks;
- `paviagen_eval/deepeval_suite.py` — DeepEval test-case adapter and metrics;
- `paviagen_eval/cli.py` — report runner;
- `tests/` — local regression tests.
