const { app, server } = require('./app');
const { sequelize } = require('./db');
const socketService = require('./services/socketService');

const PORT = process.env.PORT || 3000;

const { migrateEvaluatorAttemptsMultiUser } = require('./db/migrateEvaluatorAttempts');
const { migrateEvaluatorFormsColumn } = require('./db/migrateEvaluatorFormsColumn');
const { migrateEvaluatorMedicGender } = require('./db/migrateEvaluatorMedicGender');
const { migrateEvaluatorConsent } = require('./db/migrateEvaluatorConsent');
const { migrateEvaluatorSessionEvaluationForm } = require('./db/migrateEvaluatorSessionEvaluationForm');
const { migrateEvaluatorOverallEvaluation } = require('./db/migrateEvaluatorOverallEvaluation');

async function startServer() {
  try {
    await migrateEvaluatorAttemptsMultiUser(sequelize);
    await sequelize.sync();
    await migrateEvaluatorFormsColumn(sequelize);
    await migrateEvaluatorMedicGender(sequelize);
    await migrateEvaluatorConsent(sequelize);
    await migrateEvaluatorSessionEvaluationForm(sequelize);
    await migrateEvaluatorOverallEvaluation(sequelize);
  } catch (err) {
    console.error('Database startup failed:', err);
    process.exit(1);
  }

  socketService.initialize(server);

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Socket.IO server ready on port ${PORT}`);
  });
}

startServer();

module.exports = { app, server };
