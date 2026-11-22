const express = require('express');
const router = express.Router();
const evaluatorController = require('../controllers/evaluatorController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken, requireRole('evaluator'));

router.get('/consent', evaluatorController.getConsent);
router.get('/forms', evaluatorController.getForms);
router.get('/attempts', evaluatorController.listAttempts);
router.post('/attempts', evaluatorController.createAttempt);

router.get('/attempts/:attemptId/progress', evaluatorController.getProgress);
router.put('/attempts/:attemptId/profile', evaluatorController.saveProfile);
router.post('/attempts/:attemptId/sessions/:sessionOrder/start', evaluatorController.startSession);
router.post(
  '/attempts/:attemptId/sessions/:sessionOrder/chat-complete',
  evaluatorController.markChatComplete
);
router.put('/attempts/:attemptId/sessions/:sessionOrder/evaluation', evaluatorController.saveEvaluation);
router.put('/attempts/:attemptId/overall-evaluation', evaluatorController.saveOverallEvaluation);
router.post('/attempts/:attemptId/advance', evaluatorController.advance);

module.exports = router;
