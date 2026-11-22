from __future__ import annotations

import argparse
import json
import math
import os
import statistics
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .loader import load_conversations
from .models import ConversationRecord
from .persona_consistency import evaluate_persona_consistency


DEFAULT_DATABASE = Path(__file__).resolve().parents[2] / "storage" / "database.sqlite"
VOICE_MEDIAN_TARGET_MS = 1000
VOICE_P95_TARGET_MS = 2000


def _percentile(values: list[float], percentile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, math.ceil(percentile * len(ordered)) - 1)
    return ordered[index]


def _metric_name(metric: Any) -> str:
    name = getattr(metric, "__name__", metric.__class__.__name__)
    return name if isinstance(name, str) else metric.__class__.__name__


def _voice_config(record: ConversationRecord) -> dict[str, Any] | None:
    value = record.metadata.get("lastVoiceConfig")
    return value if isinstance(value, dict) else None


def _voice_config_label(config: dict[str, Any]) -> str:
    turn_detection = config.get("turnDetection")
    if not isinstance(turn_detection, dict):
        return str(config.get("model") or "unknown")
    vad_type = str(turn_detection.get("type") or "unknown")
    detail = turn_detection.get("eagerness") or turn_detection.get("silenceDurationMs")
    suffix = f", {detail}{' ms' if isinstance(detail, (int, float)) else ''}" if detail else ""
    return f"{vad_type}{suffix}"


def _run_llm_metrics(record: ConversationRecord, model: str | None) -> list[dict[str, Any]]:
    try:
        from .deepeval_suite import build_metrics, build_test_case
    except ImportError as error:
        raise RuntimeError(
            "DeepEval is not installed. Run: python3 -m pip install -r evals/requirements.txt"
        ) from error

    model = model or os.getenv("PAVIAGEN_EVAL_MODEL") or None
    test_case = build_test_case(record)
    results: list[dict[str, Any]] = []
    for metric in build_metrics(record, model=model):
        metric.measure(test_case)
        results.append(
            {
                "name": _metric_name(metric),
                "score": metric.score,
                "passed": metric.is_successful(),
                "threshold": metric.threshold,
                "reason": getattr(metric, "reason", None),
            }
        )
    return results


def _evaluate_record(
    record: ConversationRecord, *, with_llm: bool, model: str | None
) -> dict[str, Any]:
    persona_result = evaluate_persona_consistency(record)
    gaps = record.voice_response_gaps_ms()
    metrics: list[dict[str, Any]] = [
        {
            "name": "Paviagen Persona Consistency",
            "score": persona_result.score,
            "passed": persona_result.passed,
            "threshold": 1.0,
            "reason": persona_result.reason,
        }
    ]
    if with_llm:
        metrics = _run_llm_metrics(record, model)

    return {
        "conversationId": record.conversation_id,
        "title": record.title,
        "scenario": record.scenario_title,
        "model": record.model,
        "turnCount": len(record.turns),
        "assistantTurnCount": len(record.assistant_turns),
        "voiceConfig": _voice_config(record),
        "voiceTiming": {
            "sampleCount": len(gaps),
            "medianGapMs": statistics.median(gaps) if gaps else None,
            "p95GapMs": _percentile(gaps, 0.95),
            "minGapMs": min(gaps) if gaps else None,
            "maxGapMs": max(gaps) if gaps else None,
            "medianTargetMs": VOICE_MEDIAN_TARGET_MS,
            "p95TargetMs": VOICE_P95_TARGET_MS,
            "medianTargetMet": (
                statistics.median(gaps) <= VOICE_MEDIAN_TARGET_MS if gaps else None
            ),
            "p95TargetMet": (
                _percentile(gaps, 0.95) <= VOICE_P95_TARGET_MS if gaps else None
            ),
        },
        "metrics": metrics,
        "passed": all(metric["passed"] for metric in metrics),
    }


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Evaluate saved Paviagen conversations without affecting the live chat path."
    )
    parser.add_argument("--database", default=str(DEFAULT_DATABASE))
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--conversation-id", type=int, action="append", dest="conversation_ids")
    parser.add_argument("--scenario")
    parser.add_argument(
        "--with-llm",
        action="store_true",
        help="Run DeepEval LLM-as-a-judge metrics in addition to deterministic checks.",
    )
    parser.add_argument(
        "--model",
        default=os.getenv("PAVIAGEN_EVAL_MODEL"),
        help="Optional DeepEval judge model. Defaults to DeepEval's configured model.",
    )
    parser.add_argument("--output", help="Optional path for a JSON report.")
    parser.add_argument(
        "--allow-sensitive-text",
        action="store_true",
        help="Disable default email and phone-number redaction before LLM evaluation.",
    )
    parser.add_argument(
        "--fail-on-violation",
        action="store_true",
        help="Exit non-zero when any evaluated conversation fails a metric.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    records = load_conversations(
        args.database,
        limit=args.limit,
        conversation_ids=args.conversation_ids,
        scenario=args.scenario,
        redact=not args.allow_sensitive_text,
    )
    if not records:
        print("No eligible conversations found.", file=sys.stderr)
        return 2

    if args.with_llm:
        print(
            "Running DeepEval offline. Redacted transcripts may be sent to the configured judge provider.",
            file=sys.stderr,
        )

    try:
        evaluated = [
            _evaluate_record(record, with_llm=args.with_llm, model=args.model)
            for record in records
        ]
    except Exception as error:
        print(f"Evaluation failed: {error}", file=sys.stderr)
        return 3
    all_gaps = [gap for record in records for gap in record.voice_response_gaps_ms()]
    report = {
        "generatedAt": datetime.now(UTC).isoformat(),
        "mode": "deepeval" if args.with_llm else "deterministic-only",
        "judgeModel": (args.model or os.getenv("PAVIAGEN_EVAL_MODEL")) if args.with_llm else None,
        "conversationCount": len(evaluated),
        "passedCount": sum(1 for item in evaluated if item["passed"]),
        "voiceTiming": {
            "sampleCount": len(all_gaps),
            "medianGapMs": statistics.median(all_gaps) if all_gaps else None,
            "p95GapMs": _percentile(all_gaps, 0.95),
            "medianTargetMs": VOICE_MEDIAN_TARGET_MS,
            "p95TargetMs": VOICE_P95_TARGET_MS,
            "medianTargetMet": (
                statistics.median(all_gaps) <= VOICE_MEDIAN_TARGET_MS
                if all_gaps else None
            ),
            "p95TargetMet": (
                _percentile(all_gaps, 0.95) <= VOICE_P95_TARGET_MS
                if all_gaps else None
            ),
        },
        "conversations": evaluated,
    }

    for item in evaluated:
        status = "PASS" if item["passed"] else "FAIL"
        print(
            f"[{status}] conversation={item['conversationId']} scenario={item['scenario']} "
            f"turns={item['turnCount']}"
        )
        if item["voiceConfig"]:
            print(f"  - Voice config: {_voice_config_label(item['voiceConfig'])}")
        for metric in item["metrics"]:
            print(
                f"  - {metric['name']}: {metric['score']:.3f} "
                f"({'pass' if metric['passed'] else 'fail'})"
            )
            if not metric["passed"] and metric.get("reason"):
                print(f"    {metric['reason']}")

    if all_gaps:
        print(
            f"Voice response timing: median={report['voiceTiming']['medianGapMs']:.0f} ms "
            f"(target <= {VOICE_MEDIAN_TARGET_MS} ms: "
            f"{'pass' if report['voiceTiming']['medianTargetMet'] else 'fail'}), "
            f"p95={report['voiceTiming']['p95GapMs']:.0f} ms "
            f"(target <= {VOICE_P95_TARGET_MS} ms: "
            f"{'pass' if report['voiceTiming']['p95TargetMet'] else 'fail'}), "
            f"n={len(all_gaps)}"
        )
    else:
        print("Voice response timing: no synchronized user-to-patient timing pairs found.")

    if args.output:
        output_path = Path(args.output).expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Report written to {output_path}")

    any_failure = any(not item["passed"] for item in evaluated)
    return 1 if args.fail_on_violation and any_failure else 0


if __name__ == "__main__":
    raise SystemExit(main())
