from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from .models import ConversationRecord


def _normalized(text: str) -> str:
    return "".join(
        character
        for character in unicodedata.normalize("NFD", text.lower())
        if unicodedata.category(character) != "Mn"
    )


INTERESTED_CONTRADICTIONS = (
    re.compile(r"\bnu\s+(?:sunt|mai sunt)\s+interesat[ae]?\b"),
    re.compile(r"\bnu\s+vreau\s+sa\s+(?:ma\s+las|renunt)\b"),
    re.compile(r"\bnu\s+sunt\s+pregatit[ae]?\s+sa\s+renunt\b"),
    re.compile(r"\bnu\s+ma\s+gandesc\s+sa\s+renunt\b"),
)

UNINTERESTED_CONTRADICTIONS = (
    re.compile(r"\b(?:da,?\s+)?(?:sunt\s+)?interesat[ae]?\s+sa\s+renunt\b"),
    re.compile(r"(?<!nu\s)\bvreau\s+sa\s+(?:ma\s+las|renunt)\b"),
    re.compile(r"\bsunt\s+hotarat[ae]?\s+sa\s+renunt\b"),
    re.compile(r"\bm-?ati\s+convins\b"),
    re.compile(r"\bvoi\s+(?:incerca\s+sa\s+)?(?:ma\s+las|renunt)\b"),
    re.compile(r"\baccept\s+(?:planul|sa\s+renunt)\b"),
)

CURRENT_SMOKER_CLAIMS = (
    re.compile(r"(?<!nu\s)\bfumez\s+(?:acum|zilnic|cam|aproximativ|in jur de|\w+\s+tigari)"),
    re.compile(r"\bfumez\s+de\s+\w+"),
)

NEVER_SMOKED_CLAIMS = (
    re.compile(r"\bnu\s+am\s+fumat\s+niciodata\b"),
    re.compile(r"\bniciodata\s+nu\s+am\s+fumat\b"),
)


@dataclass(frozen=True)
class PersonaConsistencyResult:
    score: float
    passed: bool
    violations: tuple[str, ...]

    @property
    def reason(self) -> str:
        if not self.violations:
            return "No deterministic persona contradictions detected."
        return " | ".join(self.violations)


def _matches_any(text: str, patterns: tuple[re.Pattern[str], ...]) -> bool:
    return any(pattern.search(text) for pattern in patterns)


def evaluate_persona_consistency(record: ConversationRecord) -> PersonaConsistencyResult:
    snapshot = record.patient_snapshot
    expected_scenario = record.requested_scenario_title
    actual_scenario = str(snapshot.get("scenarioTitle") or record.metadata.get("scenarioTitle") or "")
    violations: list[str] = []

    if expected_scenario.startswith("Cazul nr"):
        expected_order_match = re.search(r"(\d+)", expected_scenario)
        expected_order = int(expected_order_match.group(1)) if expected_order_match else None
        actual_order = snapshot.get("sessionOrder") or record.metadata.get(
            "selectedDefaultPersonaSessionOrder"
        )
        if expected_order is not None and actual_order != expected_order:
            violations.append(
                f"Numbered case {expected_order} was paired with persona order {actual_order}."
            )
    elif expected_scenario and actual_scenario and expected_scenario != actual_scenario:
        violations.append(
            f"Selected scenario '{expected_scenario}' conflicts with snapshot '{actual_scenario}'."
        )

    quit_motivation = snapshot.get("quitMotivation")
    if expected_scenario == "Fumător interesat" and quit_motivation not in (None, "interested"):
        violations.append("Interested-smoker scenario has non-interested metadata.")
    if expected_scenario == "Fumător neinteresat" and quit_motivation not in (None, "uninterested"):
        violations.append("Uninterested-smoker scenario has interested metadata.")

    for index, turn in enumerate(record.assistant_turns, start=1):
        text = _normalized(turn.content)
        if quit_motivation == "interested" and _matches_any(text, INTERESTED_CONTRADICTIONS):
            violations.append(f"Patient turn {index} contradicts interested quitting motivation.")
        elif quit_motivation == "uninterested" and _matches_any(
            text, UNINTERESTED_CONTRADICTIONS
        ):
            violations.append(f"Patient turn {index} contradicts uninterested quitting motivation.")

        if snapshot.get("neverSmoked") and _matches_any(text, CURRENT_SMOKER_CLAIMS):
            violations.append(f"Patient turn {index} claims current smoking as a never-smoker.")
        if snapshot.get("formerSmoker"):
            if _matches_any(text, CURRENT_SMOKER_CLAIMS):
                violations.append(f"Patient turn {index} claims current smoking as a former smoker.")
            if _matches_any(text, NEVER_SMOKED_CLAIMS):
                violations.append(f"Patient turn {index} denies all smoking history as a former smoker.")

    unique_violations = tuple(dict.fromkeys(violations))
    return PersonaConsistencyResult(
        score=1.0 if not unique_violations else 0.0,
        passed=not unique_violations,
        violations=unique_violations,
    )
