/**
 * Add overall (final) application evaluation fields to evaluator progress rows.
 */
async function migrateEvaluatorOverallEvaluation(sequelize) {
  const [tables] = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='EvaluatorStudyProgresses'"
  );
  if (!tables.length) {
    return;
  }

  const [cols] = await sequelize.query('PRAGMA table_info(EvaluatorStudyProgresses)');
  if (!cols.some((c) => c.name === 'overallEvaluationData')) {
    await sequelize.query(
      'ALTER TABLE EvaluatorStudyProgresses ADD COLUMN overallEvaluationData TEXT;'
    );
  }
  if (!cols.some((c) => c.name === 'overallEvaluationSubmittedAt')) {
    await sequelize.query(
      'ALTER TABLE EvaluatorStudyProgresses ADD COLUMN overallEvaluationSubmittedAt DATETIME;'
    );
  }
}

module.exports = { migrateEvaluatorOverallEvaluation };
