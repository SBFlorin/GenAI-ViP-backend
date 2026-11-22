const { Message } = require('../db');
const { getEvaluatorFormsConfig } = require('./evaluatorFormsConfig');
const { rowsToCsvString, sanitizeFilename } = require('./csv');


/**
 * SQLite columns added via raw ALTER TABLE TEXT may come back as JSON strings
 * even when the Sequelize attribute is DataTypes.JSON. Always normalize.
 */
function parseJsonField(value, fallback = {}) {
  if (value == null || value === '') {
    return fallback;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
      return fallback;
    } catch {
      return fallback;
    }
  }
  if (typeof value === 'object') {
    return value;
  }
  return fallback;
}

function hasOverallEvaluation(progress) {
  if (progress?.overallEvaluationSubmittedAt) {
    return true;
  }
  const data = parseJsonField(progress?.overallEvaluationData, null);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }
  return Object.keys(data).length > 0;
}

function formatList(val) {
  if (Array.isArray(val)) return val.join('; ');
  return val == null ? '' : String(val);
}

function formatIso(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function formatMedicAddressing(medicGender) {
  if (medicGender === 'femeie') return 'Doamna doctor';
  if (medicGender === 'barbat') return 'Domnul doctor';
  return '';
}

function formatErrorReport(report) {
  if (!report || typeof report !== 'object') return '';
  try {
    return JSON.stringify(report);
  } catch {
    return '';
  }
}

function formatProfileFieldValue(value) {
  if (Array.isArray(value)) return formatList(value);
  if (value === null || value === undefined) return '';
  return String(value);
}

function collectLikertColumns(formsConfig) {
  const cols = [];
  const sections = formsConfig?.sessionEvaluation?.likertSections || [];
  for (const section of sections) {
    (section.items || []).forEach((item, idx) => {
      const key = `${section.key}-${idx}`;
      const shortLabel = String(item).slice(0, 80).replace(/\s+/g, ' ');
      cols.push({
        key,
        header: `Likert ${idx + 1}: ${shortLabel}`
      });
    });
  }
  return cols;
}

function collectProfileColumns(formsConfig) {
  const fields = formsConfig?.expertProfile?.profileFields || [];
  const cols = [];
  for (const field of fields) {
    cols.push({
      key: `profile_${field.key}`,
      header: `Profil: ${field.label || field.key}`
    });
    if (field.otherFieldKey) {
      cols.push({
        key: `profile_${field.otherFieldKey}`,
        header: `Profil: ${field.otherOptionLabel || field.otherFieldKey}`
      });
    }
  }
  return cols;
}

function collectEvaluationTextColumns(formsConfig) {
  const fields = formsConfig?.sessionEvaluation?.evaluationTextFields || [];
  return fields.map((field) => ({
    key: `eval_${field.key}`,
    header: field.label || field.key
  }));
}

function collectOverallLikertColumns(formsConfig) {
  const cols = [];
  const sections = formsConfig?.overallEvaluation?.likertSections || [];
  for (const section of sections) {
    (section.items || []).forEach((item, idx) => {
      const key = `${section.key}-${idx}`;
      const shortLabel = String(item).slice(0, 80).replace(/\s+/g, ' ');
      cols.push({
        key,
        header: `Eval. finală Likert ${idx + 1}: ${shortLabel}`
      });
    });
  }
  return cols;
}

function collectOverallTextColumns(formsConfig) {
  const fields = formsConfig?.overallEvaluation?.evaluationTextFields || [];
  return fields.map((field) => ({
    key: `overall_${field.key}`,
    header: field.label || field.key,
    fieldKey: field.key
  }));
}

function collectErrorIssueColumns(formsConfig) {
  const options = formsConfig?.sessionEvaluation?.errorIssueOptions || [];
  return options.map((opt, idx) => ({
    key: `error_issue_${idx}`,
    header: `Problemă observată: ${String(opt).slice(0, 80)}`,
    option: opt
  }));
}

function likertValues(likertObj, likertColumns) {
  const out = {};
  const likert = likertObj && typeof likertObj === 'object' ? likertObj : {};
  for (const col of likertColumns) {
    out[`likert_${col.key}`] = likert[col.key] ?? '';
  }
  return out;
}

function profileFieldValues(profileData, profileColumns) {
  const out = {};
  const data = profileData && typeof profileData === 'object' ? profileData : {};
  for (const col of profileColumns) {
    const fieldKey = col.key.replace(/^profile_/, '');
    out[col.key] = formatProfileFieldValue(data[fieldKey]);
  }
  return out;
}

function evaluationTextValues(evaluationData, evalTextColumns) {
  const out = {};
  const ev = evaluationData && typeof evaluationData === 'object' ? evaluationData : {};
  for (const col of evalTextColumns) {
    const fieldKey = col.key.replace(/^eval_/, '');
    out[col.key] = ev[fieldKey] ?? '';
  }
  return out;
}

function overallTextValues(overallData, overallTextColumns) {
  const out = {};
  const ev = overallData && typeof overallData === 'object' ? overallData : {};
  for (const col of overallTextColumns) {
    out[col.key] = ev[col.fieldKey] ?? '';
  }
  return out;
}

function overallLikertValues(overallData, overallLikertColumns) {
  const out = {};
  const likert = overallData?.likert && typeof overallData.likert === 'object' ? overallData.likert : {};
  for (const col of overallLikertColumns) {
    out[`overall_likert_${col.key}`] = likert[col.key] ?? '';
  }
  return out;
}

function errorIssueValues(evaluationData, errorIssueColumns) {
  const out = {};
  const issues = Array.isArray(evaluationData?.errorReport?.issues)
    ? evaluationData.errorReport.issues
    : [];
  for (const col of errorIssueColumns) {
    out[col.key] = issues.includes(col.option) ? 'da' : 'nu';
  }
  out.error_issues_selected = formatList(issues);
  out.error_issue_other = evaluationData?.errorReport?.issueOther ?? '';
  return out;
}

function summarizeMessages(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const medic = list.filter((m) => m.role === 'user').length;
  const patient = list.filter((m) => m.role === 'assistant').length;
  const system = list.filter((m) => m.role === 'system').length;
  return {
    total_message_count: list.length,
    medic_message_count: medic,
    patient_message_count: patient,
    system_message_count: system,
    conversation_exchanges: Math.min(medic, patient)
  };
}

function formatConversationTranscript(messages) {
  if (!Array.isArray(messages) || !messages.length) return '';
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
    .map((m) => {
      const label =
        m.role === 'user' ? 'Medic' : m.role === 'assistant' ? 'Pacient virtual' : 'Sistem';
      const ts = formatIso(m.createdAt);
      return `[${ts}] ${label}: ${m.content}`;
    })
    .join('\n\n');
}

function conversationValues(conversationId, messagesMap) {
  const messages = conversationId ? messagesMap.get(conversationId) || [] : [];
  const counts = summarizeMessages(messages);
  const firstAt = messages[0]?.createdAt;
  const lastAt = messages[messages.length - 1]?.createdAt;
  return {
    ...counts,
    conversation_started_at: formatIso(firstAt),
    conversation_last_message_at: formatIso(lastAt),
    conversation_transcript: formatConversationTranscript(messages)
  };
}

function buildBaseColumns({
  likertColumns,
  profileColumns,
  evalTextColumns,
  errorIssueColumns,
  overallLikertColumns,
  overallTextColumns
}) {
  return [
    { key: 'attempt_id', header: 'ID tentativă' },
    { key: 'participant_name', header: 'Nume participant' },
    { key: 'login_email', header: 'Email cont' },
    { key: 'login_username', header: 'Username cont' },
    { key: 'login_first_name', header: 'Prenume cont' },
    { key: 'login_last_name', header: 'Nume cont' },
    { key: 'medic_gender', header: 'Gen medic (cod)' },
    { key: 'medic_addressing', header: 'Forma de adresare' },
    { key: 'consent_accepted_at', header: 'Consimțământ acceptat la' },
    { key: 'row_type', header: 'Tip rând' },
    { key: 'study_completed', header: 'Studiu finalizat' },
    { key: 'study_completed_at', header: 'Studiu finalizat la' },
    { key: 'profile_completed', header: 'Profil completat' },
    { key: 'attempt_created_at', header: 'Tentativă creată la' },
    { key: 'attempt_updated_at', header: 'Tentativă actualizată la' },
    { key: 'session_order', header: 'Ordine scenariu' },
    { key: 'persona_name', header: 'Nume personaj virtual' },
    { key: 'scenario_id', header: 'ID scenariu' },
    { key: 'conversation_id', header: 'ID conversație' },
    { key: 'chat_completed_at', header: 'Conversație finalizată la' },
    { key: 'evaluation_submitted_at', header: 'Evaluare trimisă la' },
    { key: 'total_message_count', header: 'Total mesaje conversație' },
    { key: 'medic_message_count', header: 'Mesaje medic (user)' },
    { key: 'patient_message_count', header: 'Mesaje pacient virtual (assistant)' },
    { key: 'system_message_count', header: 'Mesaje sistem' },
    { key: 'conversation_exchanges', header: 'Schimburi conversaționale (min medic/pacient)' },
    { key: 'conversation_started_at', header: 'Conversație începută la' },
    { key: 'conversation_last_message_at', header: 'Ultimul mesaj la' },
    { key: 'conversation_transcript', header: 'Transcript conversație' },
    ...profileColumns.map((c) => ({ key: c.key, header: c.header })),
    { key: 'scenario_tested', header: 'Scenariu testat (legacy)' },
    { key: 'approx_exchanges', header: 'Schimburi estimate (legacy)' },
    { key: 'overall_quality', header: 'Calitate generală (legacy)' },
    { key: 'success_comments', header: 'Comentarii succes (legacy)' },
    { key: 'improvement_comments', header: 'Comentarii îmbunătățire (legacy)' },
    ...evalTextColumns.map((c) => ({ key: c.key, header: c.header })),
    { key: 'error_issues_selected', header: 'Tipuri răspunsuri problematice (listă)' },
    { key: 'error_issue_other', header: 'Alt răspuns problematic (text)' },
    ...errorIssueColumns.map((c) => ({ key: c.key, header: c.header })),
    { key: 'error_report', header: 'Raport erori (JSON)' },
    ...likertColumns.map((c) => ({ key: `likert_${c.key}`, header: c.header })),
    { key: 'overall_evaluation_submitted_at', header: 'Evaluare finală trimisă la' },
    ...overallTextColumns.map((c) => ({ key: c.key, header: c.header })),
    ...overallLikertColumns.map((c) => ({
      key: `overall_likert_${c.key}`,
      header: c.header
    }))
  ];
}

function attemptMeta(progress, user) {
  return {
    attempt_id: progress.id,
    participant_name: progress.participantName,
    login_email: user?.email ?? '',
    login_username: user?.username ?? '',
    login_first_name: user?.firstName ?? '',
    login_last_name: user?.lastName ?? '',
    medic_gender: progress.medicGender ?? '',
    medic_addressing: formatMedicAddressing(progress.medicGender),
    consent_accepted_at: formatIso(progress.consentAcceptedAt),
    study_completed: progress.studyCompletedAt ? 'da' : 'nu',
    study_completed_at: formatIso(progress.studyCompletedAt),
    profile_completed: progress.profileCompleted ? 'da' : 'nu',
    attempt_created_at: formatIso(progress.createdAt),
    attempt_updated_at: formatIso(progress.updatedAt)
  };
}

function emptyOverallFields(columnSets) {
  const out = { overall_evaluation_submitted_at: '' };
  for (const col of columnSets.overallTextColumns || []) {
    out[col.key] = '';
  }
  for (const col of columnSets.overallLikertColumns || []) {
    out[`overall_likert_${col.key}`] = '';
  }
  return out;
}

function emptySessionFields(columnSets) {
  return {
    session_order: '',
    persona_name: '',
    scenario_id: '',
    conversation_id: '',
    chat_completed_at: '',
    evaluation_submitted_at: '',
    total_message_count: '',
    medic_message_count: '',
    patient_message_count: '',
    system_message_count: '',
    conversation_exchanges: '',
    conversation_started_at: '',
    conversation_last_message_at: '',
    conversation_transcript: '',
    scenario_tested: '',
    approx_exchanges: '',
    overall_quality: '',
    success_comments: '',
    improvement_comments: '',
    error_issues_selected: '',
    error_issue_other: '',
    error_report: '',
    ...emptyOverallFields(columnSets)
  };
}

function profileRow(progress, user, formsConfig, columnSets) {
  const p = progress.profileData || {};
  return {
    ...attemptMeta(progress, user),
    row_type: 'profil_expert',
    ...emptySessionFields(columnSets),
    ...profileFieldValues(p, columnSets.profileColumns),
    ...evaluationTextValues({}, columnSets.evalTextColumns),
    ...errorIssueValues({}, columnSets.errorIssueColumns),
    ...likertValues({}, columnSets.likertColumns)
  };
}

function overallEvaluationRow(progress, user, columnSets) {
  const ev = parseJsonField(progress.overallEvaluationData, {});
  return {
    ...attemptMeta(progress, user),
    row_type: 'evaluare_finala',
    ...emptySessionFields(columnSets),
    ...profileFieldValues({}, columnSets.profileColumns),
    ...evaluationTextValues({}, columnSets.evalTextColumns),
    ...errorIssueValues({}, columnSets.errorIssueColumns),
    ...likertValues({}, columnSets.likertColumns),
    overall_evaluation_submitted_at: formatIso(progress.overallEvaluationSubmittedAt),
    ...overallTextValues(ev, columnSets.overallTextColumns),
    ...overallLikertValues(ev, columnSets.overallLikertColumns)
  };
}

function sessionRow(progress, user, session, formsConfig, columnSets, messagesMap) {
  const ev = session.evaluationData || {};
  const hasEvaluation = Boolean(session.evaluationSubmittedAt || session.evaluationData);
  return {
    ...attemptMeta(progress, user),
    row_type: hasEvaluation ? 'evaluare_sesiune' : 'conversatie_sesiune',
    session_order: session.sessionOrder ?? '',
    persona_name: session.personaName ?? '',
    scenario_id: session.scenarioId ?? '',
    conversation_id: session.conversationId ?? '',
    chat_completed_at: formatIso(session.chatCompletedAt),
    evaluation_submitted_at: formatIso(session.evaluationSubmittedAt),
    ...conversationValues(session.conversationId, messagesMap),
    ...profileFieldValues({}, columnSets.profileColumns),
    scenario_tested: ev.scenarioTested ?? '',
    approx_exchanges: ev.approxExchanges ?? '',
    overall_quality: ev.overallQuality ?? '',
    success_comments: ev.successComments ?? '',
    improvement_comments: ev.improvementComments ?? '',
    ...evaluationTextValues(ev, columnSets.evalTextColumns),
    ...errorIssueValues(ev, columnSets.errorIssueColumns),
    error_report: formatErrorReport(ev.errorReport),
    ...likertValues(ev.likert, columnSets.likertColumns),
    ...emptyOverallFields(columnSets)
  };
}

function buildRowsForProgress(progress, user, formsConfig, columnSets, messagesMap) {
  const rows = [];
  if (progress.profileCompleted) {
    rows.push(profileRow(progress, user, formsConfig, columnSets));
  }

  const sessions = Array.isArray(progress.sessions) ? progress.sessions : [];
  const sorted = [...sessions].sort((a, b) => (a.sessionOrder || 0) - (b.sessionOrder || 0));
  for (const session of sorted) {
    if (session.conversationId || session.evaluationSubmittedAt || session.evaluationData) {
      rows.push(sessionRow(progress, user, session, formsConfig, columnSets, messagesMap));
    }
  }

  if (hasOverallEvaluation(progress)) {
    rows.push(overallEvaluationRow(progress, user, columnSets));
  }

  if (!rows.length) {
    rows.push({
      ...profileRow(progress, user, formsConfig, columnSets),
      row_type: 'metadata'
    });
  }
  return rows;
}

async function loadMessagesMap(conversationIds) {
  const uniqueIds = [...new Set(conversationIds.filter(Boolean))];
  const map = new Map();
  if (!uniqueIds.length) {
    return map;
  }

  const messages = await Message.findAll({
    where: { conversationId: uniqueIds },
    order: [
      ['conversationId', 'ASC'],
      ['createdAt', 'ASC'],
      ['id', 'ASC']
    ]
  });

  for (const msg of messages) {
    if (!map.has(msg.conversationId)) {
      map.set(msg.conversationId, []);
    }
    map.get(msg.conversationId).push(msg);
  }
  return map;
}

function collectConversationIds(progressList) {
  const ids = [];
  for (const progress of progressList) {
    const sessions = Array.isArray(progress.sessions) ? progress.sessions : [];
    for (const session of sessions) {
      if (session.conversationId) {
        ids.push(session.conversationId);
      }
    }
  }
  return ids;
}

function buildColumnSets(formsConfig) {
  return {
    likertColumns: collectLikertColumns(formsConfig),
    profileColumns: collectProfileColumns(formsConfig),
    evalTextColumns: collectEvaluationTextColumns(formsConfig),
    errorIssueColumns: collectErrorIssueColumns(formsConfig),
    overallLikertColumns: collectOverallLikertColumns(formsConfig),
    overallTextColumns: collectOverallTextColumns(formsConfig)
  };
}

async function buildCsvForAttempts(progressList, evaluatorFormsStored) {
  const formsConfig = getEvaluatorFormsConfig(evaluatorFormsStored);
  const columnSets = buildColumnSets(formsConfig);
  const columns = buildBaseColumns(columnSets);
  const messagesMap = await loadMessagesMap(collectConversationIds(progressList));

  const allRows = [];
  for (const progress of progressList) {
    const user = progress.user || null;
    allRows.push(...buildRowsForProgress(progress, user, formsConfig, columnSets, messagesMap));
  }

  const csv = rowsToCsvString(allRows, columns);
  return { csv, rowCount: allRows.length };
}

module.exports = {
  buildCsvForAttempts,
  buildRowsForProgress,
  buildBaseColumns,
  buildColumnSets,
  collectOverallLikertColumns,
  collectOverallTextColumns,
  parseJsonField,
  hasOverallEvaluation,
  sanitizeFilename,
  rowsToCsvString,
  formatConversationTranscript,
  summarizeMessages,
  loadMessagesMap
};
