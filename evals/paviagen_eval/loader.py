from __future__ import annotations

import json
import re
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Any

from .models import ConversationRecord, TurnRecord


EMAIL_PATTERN = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
PHONE_PATTERN = re.compile(r"(?<!\d)(?:\+?40|0)[\s.-]?(?:\d[\s.-]?){8,9}(?!\d)")


def _json_object(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def redact_sensitive_text(text: str) -> str:
    text = EMAIL_PATTERN.sub("[EMAIL REDACTAT]", text)
    return PHONE_PATTERN.sub("[TELEFON REDACTAT]", text)


def _redact_structure(value: Any) -> Any:
    if isinstance(value, str):
        return redact_sensitive_text(value)
    if isinstance(value, dict):
        return {key: _redact_structure(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_redact_structure(item) for item in value]
    return value


def _open_read_only(database_path: Path) -> sqlite3.Connection:
    resolved = database_path.expanduser().resolve()
    if not resolved.is_file():
        raise FileNotFoundError(f"Paviagen database not found: {resolved}")
    connection = sqlite3.connect(f"{resolved.as_uri()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def load_conversations(
    database_path: str | Path,
    *,
    limit: int = 20,
    conversation_ids: list[int] | None = None,
    scenario: str | None = None,
    redact: bool = True,
    min_turns: int = 2,
) -> list[ConversationRecord]:
    """Load conversations without opening SQLite for writes."""
    if limit < 1:
        raise ValueError("limit must be at least 1")

    filters = ["deletedAt IS NULL"]
    parameters: list[Any] = []
    if conversation_ids:
        placeholders = ", ".join("?" for _ in conversation_ids)
        filters.append(f"id IN ({placeholders})")
        parameters.extend(conversation_ids)
    if scenario:
        filters.append("(title LIKE ? OR metadata LIKE ?)")
        parameters.extend([f"%{scenario}%", f"%{scenario}%"])

    query = f"""
        SELECT id, title, model, metadata
        FROM Conversations
        WHERE {' AND '.join(filters)}
        ORDER BY id DESC
        LIMIT ?
    """
    parameters.append(limit)

    records: list[ConversationRecord] = []
    with closing(_open_read_only(Path(database_path))) as connection:
        conversations = connection.execute(query, parameters).fetchall()
        for conversation in conversations:
            message_rows = connection.execute(
                """
                SELECT role, content, metadata, createdAt
                FROM Messages
                WHERE conversationId = ? AND role IN ('user', 'assistant')
                ORDER BY createdAt ASC, id ASC
                """,
                (conversation["id"],),
            ).fetchall()

            turns = tuple(
                TurnRecord(
                    role=row["role"],
                    content=redact_sensitive_text(row["content"]) if redact else row["content"],
                    created_at=row["createdAt"],
                    metadata=_json_object(row["metadata"]),
                )
                for row in message_rows
                if row["content"] and row["content"].strip()
            )
            if len(turns) < min_turns or not any(turn.role == "assistant" for turn in turns):
                continue

            conversation_metadata = _json_object(conversation["metadata"])
            if redact:
                conversation_metadata = _redact_structure(conversation_metadata)

            records.append(
                ConversationRecord(
                    conversation_id=conversation["id"],
                    title=conversation["title"],
                    model=conversation["model"],
                    metadata=conversation_metadata,
                    turns=turns,
                )
            )

    return records
