const { DEFAULT_EVALUATOR_CONSENT_TEXT } = require('../data/defaultEvaluatorConsent');

function normalizeConsentText(text) {
  const trimmed = String(text || '').trim();
  return trimmed || DEFAULT_EVALUATOR_CONSENT_TEXT;
}

function getEvaluatorConsentText(settingsRow) {
  if (!settingsRow) {
    return DEFAULT_EVALUATOR_CONSENT_TEXT;
  }
  return normalizeConsentText(settingsRow.evaluatorConsentText);
}

module.exports = {
  DEFAULT_EVALUATOR_CONSENT_TEXT,
  normalizeConsentText,
  getEvaluatorConsentText
};
