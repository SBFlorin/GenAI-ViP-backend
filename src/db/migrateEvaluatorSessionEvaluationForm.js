/**
 * Upgrade stored session evaluation form to v2 (Romanian post-conversation questionnaire).
 */
const { DEFAULT_EVALUATOR_FORMS } = require('../data/defaultEvaluatorForms');

const SESSION_EVALUATION_FORM_VERSION = 2;

async function migrateEvaluatorSessionEvaluationForm(sequelize) {
  const { Settings } = require('../db');
  const settings = await Settings.findOne({ where: { id: 1 } });
  if (!settings) {
    return;
  }

  const forms =
    settings.evaluatorForms && typeof settings.evaluatorForms === 'object'
      ? settings.evaluatorForms
      : {};

  if (forms.sessionEvaluationFormVersion >= SESSION_EVALUATION_FORM_VERSION) {
    return;
  }

  await settings.update({
    evaluatorForms: {
      ...forms,
      expertProfile: forms.expertProfile || DEFAULT_EVALUATOR_FORMS.expertProfile,
      sessionEvaluation: DEFAULT_EVALUATOR_FORMS.sessionEvaluation,
      sessionEvaluationFormVersion: SESSION_EVALUATION_FORM_VERSION
    }
  });
}

module.exports = {
  migrateEvaluatorSessionEvaluationForm,
  SESSION_EVALUATION_FORM_VERSION
};
