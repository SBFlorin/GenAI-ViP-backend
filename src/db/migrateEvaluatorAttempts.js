/**
 * SQLite migration: one progress row per user -> many rows per user (participantName).
 */
async function migrateEvaluatorAttemptsMultiUser(sequelize) {
  const [tables] = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='EvaluatorStudyProgresses'"
  );
  if (!tables.length) {
    return;
  }

  const [createSqlRows] = await sequelize.query(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='EvaluatorStudyProgresses'"
  );
  const createSql = createSqlRows[0]?.sql || '';
  if (createSql.includes('participantName')) {
    return;
  }

  await sequelize.query(`
    CREATE TABLE EvaluatorStudyProgresses_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      participantName VARCHAR(255) NOT NULL,
      profileCompleted TINYINT(1) NOT NULL DEFAULT 0,
      profileData JSON NOT NULL DEFAULT '{}',
      currentPersonaIndex INTEGER NOT NULL DEFAULT 1,
      sessions JSON NOT NULL DEFAULT '[]',
      studyCompletedAt DATETIME,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      UNIQUE(userId, participantName)
    );
  `);

  await sequelize.query(`
    INSERT INTO EvaluatorStudyProgresses_new (
      id, userId, participantName, profileCompleted, profileData,
      currentPersonaIndex, sessions, studyCompletedAt, createdAt, updatedAt
    )
    SELECT
      id, userId, 'Evaluator', profileCompleted, profileData,
      currentPersonaIndex, sessions, studyCompletedAt, createdAt, updatedAt
    FROM EvaluatorStudyProgresses;
  `);

  await sequelize.query('DROP TABLE EvaluatorStudyProgresses;');
  await sequelize.query(
    'ALTER TABLE EvaluatorStudyProgresses_new RENAME TO EvaluatorStudyProgresses;'
  );
}

module.exports = { migrateEvaluatorAttemptsMultiUser };
