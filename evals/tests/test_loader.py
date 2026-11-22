import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from evals.paviagen_eval.loader import load_conversations


class LoaderTests(unittest.TestCase):
    def test_loads_read_only_conversation_and_redacts_contact_data(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "test.sqlite"
            connection = sqlite3.connect(database)
            connection.executescript(
                """
                CREATE TABLE Conversations (
                    id INTEGER PRIMARY KEY,
                    title TEXT NOT NULL,
                    model TEXT,
                    metadata JSON,
                    deletedAt DATETIME
                );
                CREATE TABLE Messages (
                    id INTEGER PRIMARY KEY,
                    conversationId INTEGER NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    metadata JSON,
                    createdAt DATETIME
                );
                """
            )
            metadata = {
                "requestedScenarioTitle": "Fumător interesat",
                "firstUserMessage": "Contact: medic@example.com, 0712 345 678",
                "patientSnapshot": {
                    "scenarioTitle": "Fumător interesat",
                    "quitMotivation": "interested",
                },
            }
            connection.execute(
                "INSERT INTO Conversations VALUES (?, ?, ?, ?, NULL)",
                (1, "Training - Fumător interesat", "test-model", json.dumps(metadata)),
            )
            connection.execute(
                "INSERT INTO Messages VALUES (?, ?, ?, ?, ?, ?)",
                (
                    1,
                    1,
                    "user",
                    "Scrieți-mi la medic@example.com sau 0712 345 678.",
                    "{}",
                    "2026-01-01T10:00:00Z",
                ),
            )
            connection.execute(
                "INSERT INTO Messages VALUES (?, ?, ?, ?, ?, ?)",
                (2, 1, "assistant", "Da, sunt interesat să renunț.", "{}", "2026-01-01T10:00:01Z"),
            )
            connection.commit()
            connection.close()

            records = load_conversations(database, limit=5)

            self.assertEqual(len(records), 1)
            self.assertEqual(records[0].scenario_title, "Fumător interesat")
            self.assertIn("[EMAIL REDACTAT]", records[0].turns[0].content)
            self.assertIn("[TELEFON REDACTAT]", records[0].turns[0].content)
            self.assertIn("[EMAIL REDACTAT]", records[0].metadata["firstUserMessage"])
            self.assertIn("[TELEFON REDACTAT]", records[0].metadata["firstUserMessage"])


if __name__ == "__main__":
    unittest.main()
