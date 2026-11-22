/**
 * Add medicGender column to EvaluatorStudyProgresses if missing.
 */
async function migrateEvaluatorMedicGender(sequelize) {
  const [tables] = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='EvaluatorStudyProgresses'"
  );
  if (!tables.length) {
    return;
  }

  const [cols] = await sequelize.query('PRAGMA table_info(EvaluatorStudyProgresses)');
  const hasColumn = cols.some((c) => c.name === 'medicGender');
  if (hasColumn) {
    return;
  }

  await sequelize.query('ALTER TABLE EvaluatorStudyProgresses ADD COLUMN medicGender VARCHAR(16);');
}

module.exports = { migrateEvaluatorMedicGender };
