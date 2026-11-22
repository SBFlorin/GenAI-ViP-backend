import importlib.util
import unittest

from evals.paviagen_eval.models import ConversationRecord, TurnRecord


DEEPEVAL_AVAILABLE = importlib.util.find_spec("deepeval") is not None


@unittest.skipUnless(DEEPEVAL_AVAILABLE, "DeepEval is not installed")
class DeepEvalAdapterTests(unittest.TestCase):
    def setUp(self):
        from evals.paviagen_eval.deepeval_suite import build_test_case

        self.record = ConversationRecord(
            conversation_id=7,
            title="Training - Fumător interesat",
            model="test-model",
            metadata={
                "requestedScenarioTitle": "Fumător interesat",
                "scenarioTitle": "Fumător interesat",
                "patientSnapshot": {
                    "scenarioTitle": "Fumător interesat",
                    "quitMotivation": "interested",
                    "personaName": "Pacient test",
                    "sex": "barbat",
                    "exactAge": 40,
                    "occupation": "profesor",
                    "smokingStatus": "fumător actual",
                },
            },
            turns=(
                TurnRecord(role="user", content="Doriți să renunțați?"),
                TurnRecord(role="assistant", content="Da, sunt interesat să renunț."),
            ),
        )
        self.test_case = build_test_case(self.record)

    def test_builds_multi_turn_case_with_role_and_context(self):
        self.assertEqual(len(self.test_case.turns), 2)
        self.assertIn("Pacient virtual român", self.test_case.chatbot_role)
        self.assertTrue(self.test_case.context[0].startswith("PAVIAGEN_PERSONA_JSON="))

    def test_deterministic_metric_runs_inside_deepeval_contract(self):
        from evals.paviagen_eval.deepeval_suite import PersonaConsistencyMetric

        metric = PersonaConsistencyMetric()
        self.assertEqual(metric.measure(self.test_case), 1.0)
        self.assertTrue(metric.is_successful())


if __name__ == "__main__":
    unittest.main()
