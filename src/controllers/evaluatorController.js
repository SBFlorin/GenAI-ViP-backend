const {
  EvaluatorStudyProgress,
  Conversation,
  Settings
} = require('../db');
const { getEvaluatorFormsConfig } = require('../utils/evaluatorFormsConfig');
const { getEvaluatorConsentText } = require('../utils/evaluatorConsentConfig');
const { buildAttemptSummary, buildAttemptDetail } = require('../utils/evaluatorStudyHelpers');
const { buildEvaluatorPersonaView } = require('../utils/evaluatorPersonaView');

function getPersonaTotal() {
  return Settings.getEvaluatorPersonaTotal();
}

function normalizeParticipantName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function findSessionRecord(sessions, sessionOrder) {
  return (sessions || []).find((s) => s.sessionOrder === sessionOrder) || null;
}

function upsertSession(sessions, sessionOrder, patch) {
  const list = Array.isArray(sessions) ? [...sessions] : [];
  const idx = list.findIndex((s) => s.sessionOrder === sessionOrder);
  const base =
    idx >= 0
      ? { ...list[idx] }
      : {
          sessionOrder,
          scenarioId: null,
          personaName: null,
          conversationId: null,
          chatCompletedAt: null,
          evaluationSubmittedAt: null,
          evaluationData: null
        };
  const updated = { ...base, ...patch };
  if (idx >= 0) {
    list[idx] = updated;
  } else {
    list.push(updated);
  }
  return list;
}

function buildProgressResponse(progress) {
  const totalPersonas = getPersonaTotal();
  const currentPersona = Settings.getDefaultPersonaBySessionOrder(progress.currentPersonaIndex);
  const studyCompleted = Boolean(progress.studyCompletedAt);
  const detail = buildAttemptDetail(progress);

  return {
    attemptId: progress.id,
    participantName: progress.participantName,
    medicGender: progress.medicGender || null,
    consentAcceptedAt: progress.consentAcceptedAt,
    profileCompleted: progress.profileCompleted,
    profileData: detail.profileData,
    currentPersonaIndex: progress.currentPersonaIndex,
    totalPersonas,
    studyCompleted,
    studyCompletedAt: progress.studyCompletedAt,
    overallEvaluationSubmitted: Boolean(progress.overallEvaluationSubmittedAt),
    overallEvaluationSubmittedAt: progress.overallEvaluationSubmittedAt,
    overallEvaluationData: detail.overallEvaluationData,
    currentPersona: buildEvaluatorPersonaView(currentPersona),
    sessions: detail.sessions
  };
}

async function getAttemptForUser(userId, attemptId) {
  const progress = await EvaluatorStudyProgress.findOne({
    where: { id: attemptId, userId }
  });
  if (!progress) {
    const err = new Error('Evaluator attempt not found.');
    err.status = 404;
    throw err;
  }
  return progress;
}

const evaluatorController = {
  async getConsent(req, res, next) {
    try {
      let settings = await Settings.findOne({ where: { id: 1 } });
      if (!settings) {
        settings = await Settings.create({ id: 1 });
      }
      res.json({ consentText: getEvaluatorConsentText(settings) });
    } catch (error) {
      next(error);
    }
  },

  async getForms(req, res, next) {
    try {
      let settings = await Settings.findOne({ where: { id: 1 } });
      if (!settings) {
        settings = await Settings.create({ id: 1 });
      }
      const forms = getEvaluatorFormsConfig(settings.evaluatorForms);
      res.json({ forms });
    } catch (error) {
      next(error);
    }
  },

  async listAttempts(req, res, next) {
    try {
      const rows = await EvaluatorStudyProgress.findAll({
        where: { userId: req.user.id },
        order: [['updatedAt', 'DESC']]
      });
      res.json({
        attempts: rows.map(buildAttemptSummary)
      });
    } catch (error) {
      next(error);
    }
  },

  async createAttempt(req, res, next) {
    try {
      const participantName = normalizeParticipantName(req.body?.participantName);
      const medicGender =
        Settings.resolveMedicGenderFromAddressing(req.body?.medicAddressing) ||
        (req.body?.medicGender === 'femeie' || req.body?.medicGender === 'barbat'
          ? req.body.medicGender
          : null);

      if (!participantName || participantName.length < 2) {
        return res.status(400).json({
          error: 'Numele de utilizator este obligatoriu (minim 2 caractere).'
        });
      }
      if (participantName.length > 120) {
        return res.status(400).json({ error: 'Numele de utilizator este prea lung.' });
      }
      if (!medicGender) {
        return res.status(400).json({
          error: 'medicAddressing is required (Domnul doctor or Doamna doctor).'
        });
      }

      const existing = await EvaluatorStudyProgress.findOne({
        where: { userId: req.user.id, participantName }
      });
      if (existing) {
        if (existing.studyCompletedAt) {
          return res.status(409).json({
            error: 'Vă rugăm folosiți un alt nume de utilizator.'
          });
        }
        if (medicGender && existing.medicGender !== medicGender) {
          await existing.update({ medicGender });
        }
        await existing.reload();

        return res.json({
          attempt: buildAttemptSummary(existing),
          progress: buildProgressResponse(existing),
          resumed: true
        });
      }

      if (!req.body?.consentAccepted) {
        return res.status(400).json({
          error: 'consentAccepted is required before starting a new evaluation.'
        });
      }

      let settings = await Settings.findOne({ where: { id: 1 } });
      if (!settings) {
        settings = await Settings.create({ id: 1 });
      }
      const consentText = getEvaluatorConsentText(settings);
      const now = new Date();

      const progress = await EvaluatorStudyProgress.create({
        userId: req.user.id,
        participantName,
        medicGender,
        consentAcceptedAt: now,
        consentTextSnapshot: consentText,
        profileCompleted: false,
        profileData: {},
        currentPersonaIndex: 1,
        sessions: [],
        studyCompletedAt: null
      });

      res.status(201).json({
        attempt: buildAttemptSummary(progress),
        progress: buildProgressResponse(progress),
        resumed: false
      });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        const existing = await EvaluatorStudyProgress.findOne({
          where: {
            userId: req.user.id,
            participantName: normalizeParticipantName(req.body?.participantName)
          }
        });
        if (existing && !existing.studyCompletedAt) {
          return res.json({
            attempt: buildAttemptSummary(existing),
            progress: buildProgressResponse(existing),
            resumed: true
          });
        }
        return res.status(409).json({
          error: 'Vă rugăm folosiți un alt nume de utilizator.'
        });
      }
      next(error);
    }
  },

  async getProgress(req, res, next) {
    try {
      const progress = await getAttemptForUser(req.user.id, req.params.attemptId);
      res.json(buildProgressResponse(progress));
    } catch (error) {
      if (error.status === 404) {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  },

  async saveProfile(req, res, next) {
    try {
      const { profileData } = req.body;
      if (!profileData || typeof profileData !== 'object') {
        return res.status(400).json({ error: 'profileData is required.' });
      }

      const progress = await getAttemptForUser(req.user.id, req.params.attemptId);
      await progress.update({
        profileData,
        profileCompleted: true
      });

      res.json(buildProgressResponse(progress));
    } catch (error) {
      if (error.status === 404) {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  },

  async startSession(req, res, next) {
    try {
      const sessionOrder = parseInt(req.params.sessionOrder, 10);
      if (Number.isNaN(sessionOrder)) {
        return res.status(400).json({ error: 'Invalid session order.' });
      }

      const persona = Settings.getDefaultPersonaBySessionOrder(sessionOrder);
      if (!persona) {
        return res.status(404).json({ error: 'Persona not found for this session order.' });
      }

      const progress = await getAttemptForUser(req.user.id, req.params.attemptId);
      if (!progress.profileCompleted) {
        return res.status(400).json({ error: 'Complete the expert profile before starting sessions.' });
      }
      if (progress.studyCompletedAt) {
        return res.status(400).json({ error: 'Study is already completed.' });
      }
      if (sessionOrder !== progress.currentPersonaIndex) {
        return res.status(400).json({
          error: `Expected session order ${progress.currentPersonaIndex}, not ${sessionOrder}.`
        });
      }

      const existing = findSessionRecord(progress.sessions, sessionOrder);
      if (existing?.conversationId) {
        const conversation = await Conversation.findOne({
          where: { id: existing.conversationId, userId: req.user.id }
        });
        if (conversation) {
          return res.json({
            progress: buildProgressResponse(progress),
            conversation
          });
        }
      }

      const settingsRow = await Settings.findOne({ where: { id: 1 } });
      const medicGender = progress.medicGender || null;
      const { systemPrompt, scenarioTitle, sex, snapshotPatch } =
        Settings.applyForcedPersonaToConversation(settingsRow, persona, medicGender);

      const conversationMetadata = {
        messageCount: 0,
        tokenUsage: 0,
        lastActivity: null,
        tags: ['evaluator_study'],
        medicGender,
        medicGenderPreset: Boolean(medicGender),
        studyMode: 'evaluator',
        evaluatorAttemptId: progress.id,
        evaluatorParticipantName: progress.participantName,
        forcedPersonaId: persona.id,
        selectedDefaultPersonaId: persona.id,
        selectedDefaultPersonaSessionOrder: persona.sessionOrder,
        scenarioTitle,
        scenarioIndex: `evaluator-${persona.id}`,
        personaSource: 'evaluator_forced',
        personaName: persona.name,
        personaGender: sex,
        effectiveGender: sex,
        patientSnapshot: {
          scenarioTitle,
          ...snapshotPatch,
          medicGender,
          medicGenderPreset: Boolean(medicGender)
        }
      };

      const conversation = await Conversation.create({
        userId: req.user.id,
        title: `${progress.participantName} — ${persona.name}`,
        model: 'gpt-4o',
        systemPrompt,
        metadata: conversationMetadata
      });

      const { Message, Settings: SettingsModel } = require('../db');
      const messageCount = await Message.count({ where: { conversationId: conversation.id } });
      let openingMessage = null;
      if (messageCount === 0 && !medicGender) {
        openingMessage = await Message.create({
          conversationId: conversation.id,
          role: 'assistant',
          content: SettingsModel.MEDIC_GENDER_OPENING_MESSAGE,
          metadata: {
            type: 'medic_gender_opening',
            seeded: true,
            timestamp: new Date().toISOString()
          }
        });
        await conversation.updateActivity();
      }

      const sessions = upsertSession(progress.sessions, sessionOrder, {
        sessionOrder,
        scenarioId: persona.id,
        personaName: persona.name,
        conversationId: conversation.id,
        chatCompletedAt: null,
        evaluationSubmittedAt: null,
        evaluationData: null
      });

      await progress.update({ sessions });

      res.status(201).json({
        progress: buildProgressResponse(progress),
        conversation,
        openingMessage
      });
    } catch (error) {
      if (error.status === 404) {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  },

  async markChatComplete(req, res, next) {
    try {
      const sessionOrder = parseInt(req.params.sessionOrder, 10);
      const progress = await getAttemptForUser(req.user.id, req.params.attemptId);

      if (sessionOrder !== progress.currentPersonaIndex) {
        return res.status(400).json({ error: 'Invalid session order for current step.' });
      }

      const sessions = upsertSession(progress.sessions, sessionOrder, {
        chatCompletedAt: new Date().toISOString()
      });
      await progress.update({ sessions });

      res.json(buildProgressResponse(progress));
    } catch (error) {
      if (error.status === 404) {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  },

  async saveEvaluation(req, res, next) {
    try {
      const sessionOrder = parseInt(req.params.sessionOrder, 10);
      const { evaluationData } = req.body;

      if (!evaluationData || typeof evaluationData !== 'object') {
        return res.status(400).json({ error: 'evaluationData is required.' });
      }

      const progress = await getAttemptForUser(req.user.id, req.params.attemptId);
      if (sessionOrder !== progress.currentPersonaIndex) {
        return res.status(400).json({ error: 'Invalid session order for current step.' });
      }

      const session = findSessionRecord(progress.sessions, sessionOrder);
      if (!session?.conversationId) {
        return res.status(400).json({ error: 'Start the chat session before submitting evaluation.' });
      }

      const sessions = upsertSession(progress.sessions, sessionOrder, {
        evaluationData,
        evaluationSubmittedAt: new Date().toISOString()
      });
      await progress.update({ sessions });

      res.json(buildProgressResponse(progress));
    } catch (error) {
      if (error.status === 404) {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  },

  async advance(req, res, next) {
    try {
      const progress = await getAttemptForUser(req.user.id, req.params.attemptId);
      if (progress.studyCompletedAt) {
        return res.status(400).json({ error: 'Study is already completed.' });
      }

      const sessionOrder = progress.currentPersonaIndex;
      const session = findSessionRecord(progress.sessions, sessionOrder);

      if (!session?.evaluationSubmittedAt) {
        return res.status(400).json({
          error: 'Submit the session evaluation before advancing to the next persona.'
        });
      }

      const total = getPersonaTotal();
      const nextIndex = sessionOrder + 1;

      if (nextIndex > total) {
        await progress.update({
          currentPersonaIndex: total + 1,
          studyCompletedAt: new Date()
        });
      } else {
        await progress.update({ currentPersonaIndex: nextIndex });
      }

      await progress.reload();
      res.json(buildProgressResponse(progress));
    } catch (error) {
      if (error.status === 404) {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  },

  async saveOverallEvaluation(req, res, next) {
    try {
      const { evaluationData } = req.body;
      if (!evaluationData || typeof evaluationData !== 'object') {
        return res.status(400).json({ error: 'evaluationData is required.' });
      }

      const progress = await getAttemptForUser(req.user.id, req.params.attemptId);
      if (!progress.studyCompletedAt) {
        return res.status(400).json({
          error: 'Complete all persona sessions before submitting the overall evaluation.'
        });
      }
      if (progress.overallEvaluationSubmittedAt) {
        return res.status(400).json({ error: 'Overall evaluation was already submitted.' });
      }

      progress.set('overallEvaluationData', evaluationData);
      progress.set('overallEvaluationSubmittedAt', new Date());
      // Force dirty flag so Sequelize persists JSON into SQLite TEXT columns
      // added via raw ALTER TABLE migrations.
      progress.changed('overallEvaluationData', true);
      await progress.save();
      await progress.reload();

      res.json(buildProgressResponse(progress));
    } catch (error) {
      if (error.status === 404) {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  }
};

module.exports = evaluatorController;
