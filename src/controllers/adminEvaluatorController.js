const { EvaluatorStudyProgress, User, Settings } = require('../db');
const {
  getEvaluatorFormsConfig,
  validateFormPatch,
  normalizeExpertProfile,
  normalizeSessionEvaluation,
  normalizeOverallEvaluation
} = require('../utils/evaluatorFormsConfig');
const {
  getEvaluatorConsentText,
  normalizeConsentText
} = require('../utils/evaluatorConsentConfig');
const {
  buildAttemptSummary,
  buildAttemptDetail
} = require('../utils/evaluatorStudyHelpers');
const { buildCsvForAttempts, sanitizeFilename } = require('../utils/evaluatorCsvExport');

function formatUserLabel(user) {
  if (!user) return '—';
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  if (name && user.email) {
    return `${name} (${user.email})`;
  }
  return user.email || user.username || `User #${user.id}`;
}

async function getSettingsRow() {
  let settings = await Settings.findOne({ where: { id: 1 } });
  if (!settings) {
    settings = await Settings.create({ id: 1 });
  }
  return settings;
}

const adminEvaluatorController = {
  async getEvaluatorForms(req, res, next) {
    try {
      const settings = await getSettingsRow();
      const forms = getEvaluatorFormsConfig(settings.evaluatorForms);
      res.json({ forms });
    } catch (error) {
      next(error);
    }
  },

  async updateEvaluatorForm(req, res, next) {
    try {
      const formKey = req.params.formKey;
      const { form } = req.body;
      if (!form || typeof form !== 'object') {
        return res.status(400).json({ error: 'form object is required in body.' });
      }

      validateFormPatch(formKey, form);

      const settings = await getSettingsRow();
      const current = getEvaluatorFormsConfig(settings.evaluatorForms);
      const nextForms = { ...current };

      if (formKey === 'expertProfile') {
        nextForms.expertProfile = normalizeExpertProfile(form);
      } else if (formKey === 'sessionEvaluation') {
        nextForms.sessionEvaluation = normalizeSessionEvaluation(form);
      } else if (formKey === 'overallEvaluation') {
        nextForms.overallEvaluation = normalizeOverallEvaluation(form);
      } else {
        return res.status(400).json({ error: 'Unknown form key.' });
      }

      await settings.update({ evaluatorForms: nextForms });
      res.json({
        message: 'Form updated successfully.',
        forms: nextForms
      });
    } catch (error) {
      if (error.message && error.message.includes('Unknown form')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  },

  async getEvaluatorConsent(req, res, next) {
    try {
      const settings = await getSettingsRow();
      res.json({ consentText: getEvaluatorConsentText(settings) });
    } catch (error) {
      next(error);
    }
  },

  async updateEvaluatorConsent(req, res, next) {
    try {
      const { consentText } = req.body;
      if (consentText === undefined || consentText === null) {
        return res.status(400).json({ error: 'consentText is required in body.' });
      }

      const settings = await getSettingsRow();
      const normalized = normalizeConsentText(consentText);
      await settings.update({ evaluatorConsentText: normalized });
      res.json({
        message: 'Consent text updated successfully.',
        consentText: normalized
      });
    } catch (error) {
      next(error);
    }
  },

  async listAllAttempts(req, res, next) {
    try {
      const rows = await EvaluatorStudyProgress.findAll({
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'email', 'username', 'firstName', 'lastName']
          }
        ],
        order: [['updatedAt', 'DESC']]
      });

      res.json({
        attempts: rows.map((row) => {
          const summary = buildAttemptSummary(row);
          const user = row.user;
          return {
            ...summary,
            userId: row.userId,
            accountEmail: user?.email ?? null,
            accountUsername: user?.username ?? null,
            accountLabel: formatUserLabel(user)
          };
        })
      });
    } catch (error) {
      next(error);
    }
  },

  async exportAllAttemptsCsv(req, res, next) {
    try {
      const settings = await getSettingsRow();
      const rows = await EvaluatorStudyProgress.findAll({
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'email', 'username', 'firstName', 'lastName']
          }
        ],
        order: [['participantName', 'ASC'], ['updatedAt', 'DESC']]
      });

      const { csv, rowCount } = await buildCsvForAttempts(rows, settings.evaluatorForms);
      const filename = 'evaluator-responses-all.csv';
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(`\uFEFF${csv}`);
    } catch (error) {
      next(error);
    }
  },

  async exportAttemptCsv(req, res, next) {
    try {
      const attemptId = parseInt(req.params.attemptId, 10);
      if (Number.isNaN(attemptId)) {
        return res.status(400).json({ error: 'Invalid attempt id.' });
      }

      const row = await EvaluatorStudyProgress.findOne({
        where: { id: attemptId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'email', 'username', 'firstName', 'lastName']
          }
        ]
      });

      if (!row) {
        return res.status(404).json({ error: 'Evaluator attempt not found.' });
      }

      const settings = await getSettingsRow();
      const { csv } = await buildCsvForAttempts([row], settings.evaluatorForms);
      const safeName = sanitizeFilename(row.participantName);
      const filename = `evaluator-${safeName}-${attemptId}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(`\uFEFF${csv}`);
    } catch (error) {
      next(error);
    }
  },

  async getAttemptDetail(req, res, next) {
    try {
      const attemptId = parseInt(req.params.attemptId, 10);
      if (Number.isNaN(attemptId)) {
        return res.status(400).json({ error: 'Invalid attempt id.' });
      }

      const row = await EvaluatorStudyProgress.findOne({
        where: { id: attemptId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'email', 'username', 'firstName', 'lastName']
          }
        ]
      });

      if (!row) {
        return res.status(404).json({ error: 'Evaluator attempt not found.' });
      }

      const detail = buildAttemptDetail(row);
      res.json({
        ...detail,
        userId: row.userId,
        accountEmail: row.user?.email ?? null,
        accountUsername: row.user?.username ?? null,
        accountLabel: formatUserLabel(row.user)
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = adminEvaluatorController;
