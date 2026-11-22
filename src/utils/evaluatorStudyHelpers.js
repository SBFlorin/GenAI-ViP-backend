const { Settings } = require('../db');

function getPersonaTotal() {
  return Settings.getEvaluatorPersonaTotal();
}

function buildAttemptSummary(progress) {
  const totalPersonas = getPersonaTotal();
  const completed = Boolean(progress.studyCompletedAt);
  const sessions = progress.sessions || [];
  const completedEvaluations = sessions.filter((s) => s.evaluationSubmittedAt).length;

  let statusLabel = 'În curs';
  if (completed && progress.overallEvaluationSubmittedAt) {
    statusLabel = 'Finalizat';
  } else if (completed) {
    statusLabel = 'Evaluare finală aplicație';
  } else if (!progress.profileCompleted) {
    statusLabel = 'Neînceput — profil expert';
  } else {
    statusLabel = `Personaj ${progress.currentPersonaIndex} din ${totalPersonas}`;
  }

  return {
    id: progress.id,
    participantName: progress.participantName,
    medicGender: progress.medicGender || null,
    consentAcceptedAt: progress.consentAcceptedAt,
    profileCompleted: progress.profileCompleted,
    currentPersonaIndex: progress.currentPersonaIndex,
    totalPersonas,
    studyCompleted: completed,
    studyCompletedAt: progress.studyCompletedAt,
    updatedAt: progress.updatedAt,
    createdAt: progress.createdAt,
    statusLabel,
    completedEvaluations
  };
}

function buildAttemptDetail(progress) {
  const summary = buildAttemptSummary(progress);
  const sessions = Array.isArray(progress.sessions) ? progress.sessions : [];

  let overallEvaluationData = progress.overallEvaluationData || {};
  if (typeof overallEvaluationData === 'string') {
    try {
      overallEvaluationData = JSON.parse(overallEvaluationData);
    } catch {
      overallEvaluationData = {};
    }
  }
  if (!overallEvaluationData || typeof overallEvaluationData !== 'object') {
    overallEvaluationData = {};
  }

  return {
    ...summary,
    consentTextSnapshot: progress.consentTextSnapshot || null,
    profileData: progress.profileData || {},
    overallEvaluationData,
    overallEvaluationSubmittedAt: progress.overallEvaluationSubmittedAt,
    sessions: sessions.map((s) => ({
      sessionOrder: s.sessionOrder,
      scenarioId: s.scenarioId,
      personaName: s.personaName,
      conversationId: s.conversationId,
      chatCompletedAt: s.chatCompletedAt,
      evaluationSubmittedAt: s.evaluationSubmittedAt,
      evaluationData: s.evaluationData || null,
      hasEvaluation: Boolean(s.evaluationSubmittedAt && s.evaluationData)
    }))
  };
}

module.exports = {
  buildAttemptSummary,
  buildAttemptDetail
};
