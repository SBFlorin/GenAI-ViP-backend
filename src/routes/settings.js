const express = require('express');
const router = express.Router();
const { Settings } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const adminEvaluatorController = require('../controllers/adminEvaluatorController');

// All settings routes require authentication
router.use(authenticateToken);

// GET /api/v1/settings - Retrieve settings
router.get('/', async (req, res) => {
    try {
        let settings = await Settings.findOne({
            where: { id: 1 }
        });
        
        if (!settings) {
            // Create default settings if none exist
            settings = await Settings.create({ id: 1 });
        }
        
        res.json(settings);
    } catch (err) {
        console.error('Get settings error:', err);
        res.status(500).json({ error: `Failed to get settings: ${err.message}` });
    }
});

// POST /api/v1/settings - Create or update settings (upsert)
router.post('/', requireRole('admin'), async (req, res) => {
    try {
        let settings = await Settings.findOne({
            where: { id: 1 }
        });
        
        const { healthProfile, sessionTimeout } = req.body;
        
        if (settings) {
            // Update existing settings
            const updateData = {};
            if (healthProfile !== undefined) updateData.healthProfile = healthProfile;
            if (sessionTimeout !== undefined) updateData.sessionTimeout = sessionTimeout;
            
            await settings.update(updateData);
            res.json({ 
                message: 'Settings updated successfully.', 
                settings 
            });
        } else {
            // Create new settings with provided data
            settings = await Settings.create({
                id: 1,
                ...(healthProfile !== undefined && { healthProfile }),
                ...(sessionTimeout !== undefined && { sessionTimeout })
            });
            res.status(201).json({ 
                message: 'Settings created successfully.', 
                settings 
            });
        }
    } catch (err) {
        console.error('Create/update settings error:', err);
        res.status(500).json({ error: `Failed to create/update settings: ${err.message}` });
    }
});

// PUT /api/v1/settings - Update user settings
router.put('/', requireRole('admin'), async (req, res) => {
    try {
        let settings = await Settings.findOne({
            where: { id: 1 }
        });
        
        if (!settings) {
            settings = await Settings.create({
                id: 1,
                ...req.body
            });
        } else {
            await settings.update(req.body);
        }
        
        res.json({ 
            message: 'Settings updated successfully.', 
            settings 
        });
    } catch (err) {
        console.error('Update settings error:', err);
        res.status(500).json({ error: `Failed to update settings: ${err.message}` });
    }
});

// PATCH /api/v1/settings/health-profile - Update health profile
router.patch('/health-profile', requireRole('admin'), async (req, res) => {
    try {
        let settings = await Settings.findOne({
            where: { id: 1 }
        });
        
        if (!settings) {
            settings = await Settings.create({
                id: 1
            });
        }
        
        await settings.updateHealthProfile(req.body);
        
        res.json({ 
            message: 'Health profile updated successfully.', 
            healthProfile: settings.healthProfile 
        });
    } catch (err) {
        console.error('Update health profile error:', err);
        res.status(500).json({ error: `Failed to update health profile: ${err.message}` });
    }
});

// PATCH /api/v1/settings/chat-preferences - Update chat preferences
router.patch('/chat-preferences', async (req, res) => {
    try {
        let settings = await Settings.findOne({
            where: { id: 1 }
        });
        
        if (!settings) {
            settings = await Settings.create({
                id: 1
            });
        }
        
        await settings.updateChatPreferences(req.body);
        
        res.json({ 
            message: 'Chat preferences updated successfully.', 
            chatPreferences: settings.chatPreferences 
        });
    } catch (err) {
        console.error('Update chat preferences error:', err);
        res.status(500).json({ error: `Failed to update chat preferences: ${err.message}` });
    }
});

// Evaluator questionnaire definitions (admin only; same handlers as /admin routes)
router.get(
  '/evaluator-forms',
  authenticateToken,
  requireRole('admin'),
  adminEvaluatorController.getEvaluatorForms
);
router.put(
  '/evaluator-forms/:formKey',
  authenticateToken,
  requireRole('admin'),
  adminEvaluatorController.updateEvaluatorForm
);
router.post(
  '/evaluator-forms/:formKey',
  authenticateToken,
  requireRole('admin'),
  adminEvaluatorController.updateEvaluatorForm
);

router.get(
  '/evaluator-consent',
  authenticateToken,
  requireRole('admin'),
  adminEvaluatorController.getEvaluatorConsent
);
router.put(
  '/evaluator-consent',
  authenticateToken,
  requireRole('admin'),
  adminEvaluatorController.updateEvaluatorConsent
);
router.post(
  '/evaluator-consent',
  authenticateToken,
  requireRole('admin'),
  adminEvaluatorController.updateEvaluatorConsent
);

// POST /api/v1/settings/reset - Reset settings to defaults
router.post('/reset', requireRole('admin'), async (req, res) => {
    try {
        let settings = await Settings.findOne({
            where: { id: 1 }
        });
        
        if (!settings) {
            settings = await Settings.create({
                id: 1
            });
        } else {
            await settings.destroy();
            settings = await Settings.create({
                id: 1
            });
        }
        
        res.json({ 
            message: 'Settings reset to defaults successfully.', 
            settings 
        });
    } catch (err) {
        console.error('Reset settings error:', err);
        res.status(500).json({ error: `Failed to reset settings: ${err.message}` });
    }
});

module.exports = router;
