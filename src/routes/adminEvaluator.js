const express = require('express');
const router = express.Router();
const adminEvaluatorController = require('../controllers/adminEvaluatorController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken, requireRole('admin'));

router.get('/evaluator-forms', adminEvaluatorController.getEvaluatorForms);
router.get('/evaluator-consent', adminEvaluatorController.getEvaluatorConsent);
router.put('/evaluator-consent', adminEvaluatorController.updateEvaluatorConsent);
router.post('/evaluator-consent', adminEvaluatorController.updateEvaluatorConsent);
router.put('/evaluator-forms/:formKey', adminEvaluatorController.updateEvaluatorForm);
router.post('/evaluator-forms/:formKey', adminEvaluatorController.updateEvaluatorForm);

router.get('/evaluator-attempts', adminEvaluatorController.listAllAttempts);
router.get('/evaluator-attempts/export/all.csv', adminEvaluatorController.exportAllAttemptsCsv);
router.get('/evaluator-attempts/:attemptId/export.csv', adminEvaluatorController.exportAttemptCsv);
router.get('/evaluator-attempts/:attemptId', adminEvaluatorController.getAttemptDetail);

module.exports = router;
