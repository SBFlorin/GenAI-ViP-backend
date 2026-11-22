const { DEFAULT_EVALUATOR_FORMS } = require('../data/defaultEvaluatorForms');

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object') {
    return base;
  }
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const key of Object.keys(patch)) {
    const pv = patch[key];
    const bv = out[key];
    if (pv && typeof pv === 'object' && !Array.isArray(pv) && bv && typeof bv === 'object' && !Array.isArray(bv)) {
      out[key] = deepMerge(bv, pv);
    } else {
      out[key] = pv;
    }
  }
  return out;
}

function normalizeLikertSections(sections) {
  if (!Array.isArray(sections)) {
    return DEFAULT_EVALUATOR_FORMS.sessionEvaluation.likertSections;
  }
  return sections
    .filter((s) => s && Array.isArray(s.items))
    .map((s, idx) => ({
      key: String(s.key || String.fromCharCode(65 + idx)).trim() || String(idx),
      title: String(s.title || '').trim(),
      items: Array.isArray(s.items)
        ? s.items.map((i) => String(i).trim()).filter(Boolean)
        : []
    }))
    .filter((s) => s.items.length > 0);
}

function normalizeOptionsList(options) {
  if (!Array.isArray(options)) return [];
  return options.map((o) => String(o).trim()).filter(Boolean);
}

function normalizeProfileFields(list, fallback) {
  if (!Array.isArray(list) || !list.length) {
    return fallback;
  }
  const seen = new Set();
  return list
    .filter((f) => f && String(f.key || '').trim() && String(f.label || '').trim())
    .map((f) => {
      let key = String(f.key).trim();
      if (seen.has(key)) key = `${key}_${seen.size}`;
      seen.add(key);
      const type = f.type === 'checkbox' ? 'checkbox' : 'radio';
      const normalized = {
        key,
        type,
        label: String(f.label).trim(),
        options: normalizeOptionsList(f.options),
        required: Boolean(f.required)
      };
      if (f.otherFieldKey) {
        normalized.otherFieldKey = String(f.otherFieldKey).trim();
        normalized.otherOptionLabel = String(f.otherOptionLabel || 'Other').trim();
      }
      return normalized;
    })
    .filter((f) => f.options.length > 0);
}

function buildLegacyProfileFields(merged, base) {
  const defs = [
    ['professions', 'checkbox', 'professionOther'],
    ['experience', 'radio', null],
    ['cessationCounselling', 'radio', null],
    ['teaching', 'radio', null],
    ['affiliations', 'checkbox', 'affiliationOther']
  ];
  return defs
    .map(([key, type, otherKey]) => {
      const legacy = merged[key] || base[key];
      if (!legacy?.label) return null;
      const field = {
        key,
        type,
        label: legacy.label,
        options: normalizeOptionsList(legacy.options),
        required: key !== 'affiliations'
      };
      if (otherKey) {
        field.otherFieldKey = otherKey;
        field.otherOptionLabel = 'Other';
      }
      return field;
    })
    .filter(Boolean);
}

function normalizeChoiceFields(list, fallback) {
  if (!Array.isArray(list) || !list.length) {
    return fallback;
  }
  const seen = new Set();
  return list
    .filter((f) => f && String(f.key || '').trim() && String(f.label || '').trim())
    .map((f) => {
      let key = String(f.key).trim();
      if (seen.has(key)) key = `${key}_${seen.size}`;
      seen.add(key);
      return {
        key,
        label: String(f.label).trim(),
        options: normalizeOptionsList(f.options),
        required: f.required !== false
      };
    })
    .filter((f) => f.options.length > 0);
}

function buildLegacyChoiceFields(merged, base) {
  const fields = [];
  if (merged.scenarioOptions?.label) {
    fields.push({
      key: 'scenarioTested',
      label: merged.scenarioOptions.label,
      options: normalizeOptionsList(merged.scenarioOptions.options || base.scenarioOptions?.options),
      required: true
    });
  }
  if (merged.exchangeOptions?.label) {
    fields.push({
      key: 'approxExchanges',
      label: merged.exchangeOptions.label,
      options: normalizeOptionsList(merged.exchangeOptions.options || base.exchangeOptions?.options),
      required: true
    });
  }
  return fields.length ? fields : base.choiceFields;
}

function normalizeExpertProfile(form) {
  const base = DEFAULT_EVALUATOR_FORMS.expertProfile;
  const merged = deepMerge(base, form || {});
  merged.profileFields = normalizeProfileFields(
    merged.profileFields,
    buildLegacyProfileFields(merged, base)
  );
  if (!merged.profileFields.length) {
    merged.profileFields = base.profileFields;
  }
  return merged;
}

function normalizeTextFields(list, fallback) {
  if (!Array.isArray(list) || !list.length) {
    return fallback;
  }
  const seen = new Set();
  return list
    .filter((f) => f && String(f.key || '').trim() && String(f.label || '').trim())
    .map((f) => {
      let key = String(f.key).trim();
      if (seen.has(key)) {
        key = `${key}_${seen.size}`;
      }
      seen.add(key);
      const rows = parseInt(f.rows, 10);
      return {
        key,
        label: String(f.label).trim(),
        placeholder: String(f.placeholder ?? f.label).trim(),
        rows: Number.isFinite(rows) && rows >= 2 && rows <= 12 ? rows : 3
      };
    });
}

function buildLegacyEvaluationTextFields(merged, base) {
  return [
    {
      key: 'successComments',
      label: merged.successCommentsLabel || base.successCommentsLabel,
      placeholder: '',
      rows: 3
    },
    {
      key: 'improvementComments',
      label: merged.improvementCommentsLabel || base.improvementCommentsLabel,
      placeholder: '',
      rows: 3
    }
  ];
}

function normalizeSessionEvaluation(form) {
  const base = DEFAULT_EVALUATOR_FORMS.sessionEvaluation;
  const merged = deepMerge(base, form || {});
  merged.likertSections = normalizeLikertSections(merged.likertSections);
  merged.evaluationTextFields = normalizeTextFields(
    merged.evaluationTextFields,
    buildLegacyEvaluationTextFields(merged, base)
  );
  merged.errorReportTextFields = normalizeTextFields(
    merged.errorReportTextFields,
    base.errorReportTextFields
  );
  merged.choiceFields = normalizeChoiceFields(merged.choiceFields, buildLegacyChoiceFields(merged, base));
  merged.showSessionMeta = merged.showSessionMeta === true;
  merged.showChoiceFieldsSection = merged.showChoiceFieldsSection === true;
  merged.showOverallQuality = merged.showOverallQuality === true;
  merged.showEvaluationTextFieldsSection = merged.showEvaluationTextFieldsSection !== false;
  merged.showErrorReportSection = merged.showErrorReportSection !== false;
  merged.showErrorIssuesSection = merged.showErrorIssuesSection === true;
  merged.showErrorIssueOptions = merged.showErrorIssueOptions !== false;
  merged.showErrorSeverityOptions = merged.showErrorSeverityOptions === true;
  merged.showErrorReportTextFieldsSection = merged.showErrorReportTextFieldsSection === true;
  merged.errorIssueOptions = (merged.errorIssueOptions || [])
    .map((o) => String(o).trim())
    .filter(Boolean);
  merged.errorSeverityOptions = (merged.errorSeverityOptions || [])
    .map((o) => String(o).trim())
    .filter(Boolean);
  return merged;
}

function normalizeOverallEvaluation(form) {
  const base = DEFAULT_EVALUATOR_FORMS.overallEvaluation;
  const merged = deepMerge(base, form || {});
  merged.likertSections = normalizeLikertSections(merged.likertSections);
  merged.evaluationTextFields = normalizeTextFields(
    merged.evaluationTextFields,
    base.evaluationTextFields
  );
  return merged;
}

function getEvaluatorFormsConfig(stored) {
  const storedForms = stored && typeof stored === 'object' ? stored : {};
  return {
    expertProfile: normalizeExpertProfile(storedForms.expertProfile),
    sessionEvaluation: normalizeSessionEvaluation(storedForms.sessionEvaluation),
    overallEvaluation: normalizeOverallEvaluation(storedForms.overallEvaluation)
  };
}

function validateFormPatch(formKey, patch) {
  if (!patch || typeof patch !== 'object') {
    throw new Error('Form data must be an object.');
  }
  if (formKey === 'expertProfile') {
    const normalized = normalizeExpertProfile(patch);
    if (!normalized.profileFields.length) {
      throw new Error('At least one profile field is required.');
    }
    return true;
  }
  if (formKey === 'sessionEvaluation') {
    const normalized = normalizeSessionEvaluation(patch);
    if (!normalized.likertSections.length) {
      throw new Error('At least one Likert section with items is required.');
    }
    return true;
  }
  if (formKey === 'overallEvaluation') {
    const normalized = normalizeOverallEvaluation(patch);
    if (!normalized.likertSections.length) {
      throw new Error('At least one Likert section with items is required.');
    }
    return true;
  }
  throw new Error('Unknown form key. Use expertProfile, sessionEvaluation, or overallEvaluation.');
}

module.exports = {
  DEFAULT_EVALUATOR_FORMS,
  getEvaluatorFormsConfig,
  validateFormPatch,
  normalizeExpertProfile,
  normalizeSessionEvaluation,
  normalizeOverallEvaluation
};
