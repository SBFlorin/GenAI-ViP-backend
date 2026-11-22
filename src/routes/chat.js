const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 25 * 1024 * 1024 // 25MB limit (OpenAI limit)
    }
});

// All chat routes require authentication
router.use(authenticateToken);

// Conversation routes
router.get('/conversations', chatController.getConversations);
router.post('/conversations', chatController.createConversation);
router.get('/conversations/:conversationId', chatController.getConversation);
router.put('/conversations/:conversationId', chatController.updateConversation);
router.delete('/conversations/:conversationId', chatController.deleteConversation);

// Message routes
router.post('/conversations/:conversationId/messages', chatController.sendMessage);
router.post('/conversations/:conversationId/live/session', chatController.createLiveSession);
router.post('/conversations/:conversationId/live/transcripts', chatController.syncLiveTranscripts);
router.post('/speech', chatController.generateSpeech);
router.post('/transcribe', upload.single('file'), chatController.transcribeAudio);

module.exports = router;
