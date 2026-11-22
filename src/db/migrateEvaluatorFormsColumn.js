/**
 * Add evaluatorForms JSON column to Settings if missing.
 */
async function migrateEvaluatorFormsColumn(sequelize) {
  const [tables] = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='Settings'"
  );
  if (!tables.length) {
    return;
  }

  const [cols] = await sequelize.query('PRAGMA table_info(Settings)');
  const hasColumn = cols.some((c) => c.name === 'evaluatorForms');
  if (hasColumn) {
    return;
  }

  await sequelize.query('ALTER TABLE Settings ADD COLUMN evaluatorForms JSON;');
}

module.exports = { migrateEvaluatorFormsColumn };
