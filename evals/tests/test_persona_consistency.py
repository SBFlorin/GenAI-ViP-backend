import unittest

from evals.paviagen_eval.models import ConversationRecord, TurnRecord
from evals.paviagen_eval.persona_consistency import evaluate_persona_consistency


def conversation(
    scenario: str,
    quit_motivation: str,
    patient_reply: str,
    **snapshot_overrides,
) -> ConversationRecord:
    snapshot = {
        "scenarioTitle": scenario,
        "quitMotivation": quit_motivation,
        "neverSmoked": False,
        "formerSmoker": False,
        **snapshot_overrides,
    }
    return ConversationRecord(
        conversation_id=1,
        title=f"Training - {scenario}",
        model="test-model",
        metadata={
            "requestedScenarioTitle": scenario,
            "scenarioTitle": scenario,
            "patientSnapshot": snapshot,
        },
        turns=(
            TurnRecord(role="user", content="Doriți să renunțați la fumat?"),
            TurnRecord(role="assistant", content=patient_reply),
        ),
    )


class PersonaConsistencyTests(unittest.TestCase):
    def test_interested_smoker_accepts_consistent_reply(self):
        record = conversation(
            "Fumător interesat",
            "interested",
            "Da, sunt interesat să renunț și aș dori să aflu mai multe.",
        )
        self.assertTrue(evaluate_persona_consistency(record).passed)

    def test_interested_smoker_rejects_uninterested_reply(self):
        record = conversation(
            "Fumător interesat",
            "interested",
            "Nu sunt interesat să renunț la fumat acum.",
        )
        result = evaluate_persona_consistency(record)
        self.assertFalse(result.passed)
        self.assertIn("contradicts interested", result.reason)

    def test_uninterested_smoker_rejects_interested_reply(self):
        record = conversation(
            "Fumător neinteresat",
            "uninterested",
            "Da, sunt interesată să renunț și accept planul.",
        )
        result = evaluate_persona_consistency(record)
        self.assertFalse(result.passed)
        self.assertIn("contradicts uninterested", result.reason)

    def test_uninterested_smoker_accepts_explicit_refusal(self):
        record = conversation(
            "Fumător neinteresat",
            "uninterested",
            "Înțeleg riscurile, dar nu vreau să renunț acum.",
        )
        self.assertTrue(evaluate_persona_consistency(record).passed)

    def test_selected_scenario_must_match_snapshot(self):
        record = conversation(
            "Fumător interesat",
            "uninterested",
            "Bună ziua.",
        )
        record = ConversationRecord(
            conversation_id=record.conversation_id,
            title=record.title,
            model=record.model,
            metadata={
                **record.metadata,
                "patientSnapshot": {
                    **record.patient_snapshot,
                    "scenarioTitle": "Fumător neinteresat",
                },
            },
            turns=record.turns,
        )
        result = evaluate_persona_consistency(record)
        self.assertFalse(result.passed)
        self.assertIn("conflicts with snapshot", result.reason)

    def test_former_smoker_cannot_claim_never_smoked(self):
        record = conversation(
            "Fost fumător",
            "abstinent",
            "Nu am fumat niciodată.",
            formerSmoker=True,
        )
        result = evaluate_persona_consistency(record)
        self.assertFalse(result.passed)
        self.assertIn("denies all smoking history", result.reason)

    def test_voice_response_gaps_use_same_live_session(self):
        record = ConversationRecord(
            conversation_id=2,
            title="Voice test",
            model="test-model",
            metadata={},
            turns=(
                TurnRecord(
                    role="user",
                    content="Bună ziua",
                    metadata={"liveSessionId": "session-1", "startMs": 0, "endMs": 900},
                ),
                TurnRecord(
                    role="assistant",
                    content="Bună ziua",
                    metadata={"liveSessionId": "session-1", "startMs": 1250, "endMs": 1800},
                ),
            ),
        )
        self.assertEqual(record.voice_response_gaps_ms(), [350.0])


if __name__ == "__main__":
    unittest.main()
