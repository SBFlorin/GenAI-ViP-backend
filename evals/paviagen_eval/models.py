from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class TurnRecord:
    role: str
    content: str
    created_at: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ConversationRecord:
    conversation_id: int
    title: str
    model: str | None
    metadata: dict[str, Any]
    turns: tuple[TurnRecord, ...]

    @property
    def patient_snapshot(self) -> dict[str, Any]:
        value = self.metadata.get("patientSnapshot")
        return value if isinstance(value, dict) else {}

    @property
    def requested_scenario_title(self) -> str:
        explicit = self.metadata.get("requestedScenarioTitle")
        if explicit:
            return str(explicit)

        case_match = re.search(r"Cazul\s+nr\.?\s*\d+", self.title, re.IGNORECASE)
        if case_match:
            return case_match.group(0)
        for title in (
            "Pacient nefumător",
            "Fumător interesat",
            "Fumător neinteresat",
            "Fost fumător",
        ):
            if title in self.title:
                return title

        snapshot_title = self.patient_snapshot.get("scenarioTitle")
        return str(
            self.metadata.get("scenarioTitle")
            or snapshot_title
            or self.title
        )

    @property
    def scenario_title(self) -> str:
        return self.requested_scenario_title

    @property
    def assistant_turns(self) -> tuple[TurnRecord, ...]:
        return tuple(turn for turn in self.turns if turn.role == "assistant")

    def voice_response_gaps_ms(self) -> list[float]:
        """Return transcript-derived user-end to patient-start gaps per live session."""
        gaps: list[float] = []
        previous_user: TurnRecord | None = None

        for turn in self.turns:
            if turn.role == "user":
                previous_user = turn
                continue
            if turn.role != "assistant" or previous_user is None:
                continue

            user_meta = previous_user.metadata
            assistant_meta = turn.metadata
            same_session = (
                user_meta.get("liveSessionId")
                and user_meta.get("liveSessionId") == assistant_meta.get("liveSessionId")
            )
            if not same_session:
                continue

            user_end = user_meta.get("endMs")
            assistant_start = assistant_meta.get("startMs")
            if isinstance(user_end, (int, float)) and isinstance(assistant_start, (int, float)):
                gaps.append(float(assistant_start - user_end))

        return gaps
