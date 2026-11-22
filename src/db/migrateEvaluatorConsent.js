/**
 * Add evaluator consent settings and per-participant consent acceptance columns.
 */
async function migrateEvaluatorConsent(sequelize) {
  const [settingsTables] = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='Settings'"
  );
  if (settingsTables.length) {
    const [settingsCols] = await sequelize.query('PRAGMA table_info(Settings)');
    if (!settingsCols.some((c) => c.name === 'evaluatorConsentText')) {
      await sequelize.query('ALTER TABLE Settings ADD COLUMN evaluatorConsentText TEXT;');
    }
  }

  const [progressTables] = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='EvaluatorStudyProgresses'"
  );
  if (!progressTables.length) {
    return;
  }

  const [progressCols] = await sequelize.query('PRAGMA table_info(EvaluatorStudyProgresses)');
  if (!progressCols.some((c) => c.name === 'consentAcceptedAt')) {
    await sequelize.query('ALTER TABLE EvaluatorStudyProgresses ADD COLUMN consentAcceptedAt DATETIME;');
  }
  if (!progressCols.some((c) => c.name === 'consentTextSnapshot')) {
    await sequelize.query('ALTER TABLE EvaluatorStudyProgresses ADD COLUMN consentTextSnapshot TEXT;');
  }
}

module.exports = { migrateEvaluatorConsent };
