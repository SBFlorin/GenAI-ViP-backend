from __future__ import annotations

import json
from typing import Any

from deepeval.metrics import (
    BaseConversationalMetric,
    ConversationalGEval,
    RoleAdherenceMetric,
    TurnRelevancyMetric,
)
from deepeval.test_case import ConversationalTestCase, Turn

from .models import ConversationRecord, TurnRecord
from .persona_consistency import evaluate_persona_consistency


PERSONA_CONTEXT_PREFIX = "PAVIAGEN_PERSONA_JSON="


def describe_persona(record: ConversationRecord) -> str:
    snapshot = record.patient_snapshot
    facts = [
        f"scenariul clinic este {record.scenario_title}",
        f"identitatea este {snapshot.get('personaName') or record.metadata.get('personaName')}",
        f"sexul pacientului este {snapshot.get('sex')}",
        f"vârsta este {snapshot.get('exactAge')}",
        f"ocupația este {snapshot.get('occupation')}",
        f"statutul de fumat este {snapshot.get('smokingStatus')}",
        f"motivația de renunțare este {snapshot.get('quitMotivation')}",
        f"încrederea este {snapshot.get('confidenceLevel') or snapshot.get('confidence')}",
        f"istoricul este {snapshot.get('smokingHistoryRo') or snapshot.get('smokingHistoryNarrative')}",
    ]
    return "; ".join(fact for fact in facts if not fact.endswith("None"))


def build_chatbot_role(record: ConversationRecord) -> str:
    return (
        "Pacient virtual român într-o consultație de sfat minimal pentru renunțarea la "
        "fumat. Medicul este utilizatorul și conduce consultația. Pacientul răspunde "
        "natural, scurt, la persoana întâi, nu devine medic sau asistent și nu schimbă "
        f"datele profilului. Profil fix: {describe_persona(record)}."
    )


def build_test_case(record: ConversationRecord) -> ConversationalTestCase:
    evaluation_metadata = {
        key: record.metadata.get(key)
        for key in (
            "requestedScenarioTitle",
            "scenarioTitle",
            "selectedDefaultPersonaId",
            "selectedDefaultPersonaSessionOrder",
            "personaName",
            "personaGender",
            "effectiveGender",
            "patientSnapshot",
        )
        if record.metadata.get(key) is not None
    }
    context_payload = {
        "conversationId": record.conversation_id,
        "title": record.title,
        "model": record.model,
        "metadata": evaluation_metadata,
    }
    turns = [Turn(role=turn.role, content=turn.content) for turn in record.turns]
    return ConversationalTestCase(
        name=f"paviagen-conversation-{record.conversation_id}",
        turns=turns,
        scenario=(
            f"Studentul medic poartă o conversație în limba română cu un pacient virtual. "
            f"Scenariul selectat este: {record.scenario_title}."
        ),
        expected_outcome=(
            "Pacientul își păstrează exact profilul și rolul, răspunde relevant și natural, "
            "iar studentul oferă sfatul minimal de renunțare potrivit disponibilității pacientului."
        ),
        chatbot_role=build_chatbot_role(record),
        context=[PERSONA_CONTEXT_PREFIX + json.dumps(context_payload, ensure_ascii=False)],
        tags=[record.scenario_title, record.model or "unknown-model"],
    )


def _record_from_test_case(test_case: ConversationalTestCase) -> ConversationRecord:
    encoded_context = next(
        (
            item[len(PERSONA_CONTEXT_PREFIX) :]
            for item in (test_case.context or [])
            if isinstance(item, str) and item.startswith(PERSONA_CONTEXT_PREFIX)
        ),
        None,
    )
    if encoded_context is None:
        raise ValueError("Paviagen persona context is missing from the DeepEval test case")

    payload = json.loads(encoded_context)
    return ConversationRecord(
        conversation_id=int(payload["conversationId"]),
        title=str(payload.get("title") or ""),
        model=payload.get("model"),
        metadata=payload.get("metadata") or {},
        turns=tuple(
            TurnRecord(role=turn.role, content=str(turn.content)) for turn in test_case.turns
        ),
    )


class PersonaConsistencyMetric(BaseConversationalMetric):
    """Deterministic critical-fact gate integrated into DeepEval."""

    def __init__(self, threshold: float = 1.0):
        self.threshold = threshold
        self.include_reason = True
        self.async_mode = False
        self.strict_mode = True
        self.evaluation_model = "deterministic-rules"
        self.error = None
        self.score = 0.0
        self.reason = "Not measured"
        self.success = False

    def measure(self, test_case: ConversationalTestCase, *args: Any, **kwargs: Any) -> float:
        try:
            result = evaluate_persona_consistency(_record_from_test_case(test_case))
            self.score = result.score
            self.reason = result.reason
            self.success = result.passed
            return self.score
        except Exception as error:
            self.error = str(error)
            self.success = False
            raise

    async def a_measure(
        self, test_case: ConversationalTestCase, *args: Any, **kwargs: Any
    ) -> float:
        return self.measure(test_case, *args, **kwargs)

    def is_successful(self) -> bool:
        self.success = self.error is None and self.score >= self.threshold
        return self.success

    @property
    def __name__(self) -> str:
        return "Paviagen Persona Consistency"


def build_metrics(record: ConversationRecord, model: str | None = None) -> list[Any]:
    model_kwargs = {"model": model} if model else {}
    persona_description = describe_persona(record)

    return [
        PersonaConsistencyMetric(),
        RoleAdherenceMetric(
            threshold=0.8,
            include_reason=True,
            async_mode=False,
            **model_kwargs,
        ),
        TurnRelevancyMetric(
            threshold=0.7,
            include_reason=True,
            async_mode=False,
            **model_kwargs,
        ),
        ConversationalGEval(
            name="Paviagen Clinical Persona Fidelity",
            criteria=(
                "Evaluate only the assistant turns, which represent the virtual patient. "
                "The patient must speak natural Romanian, remain a patient rather than acting "
                "as a doctor or chatbot, answer concisely and preserve every relevant fixed "
                f"persona fact throughout the conversation. Expected persona: {persona_description}. "
                "Heavily penalize any contradiction of smoking status, willingness to quit, "
                "confidence, age, sex, occupation or smoking history."
            ),
            threshold=0.8,
            async_mode=False,
            **model_kwargs,
        ),
        ConversationalGEval(
            name="Paviagen Student Minimal Advice",
            criteria=(
                "Evaluate only the user turns, which represent the medical student. Assess whether "
                "the student respectfully identifies or confirms smoking status, gives a clear and "
                "personalized recommendation to stop smoking when applicable, assesses willingness "
                "to quit, and responds appropriately to the patient's readiness without judgment or "
                "unnecessary diagnosis. Do not reward the virtual patient's behavior in this metric."
            ),
            threshold=0.6,
            async_mode=False,
            **model_kwargs,
        ),
    ]
