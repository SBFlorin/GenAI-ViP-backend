const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const adminUsersController = require('../controllers/adminUsersController');

router.use(authenticateToken, requireRole('admin'));

router.get('/', adminUsersController.listUsers);
router.post('/', adminUsersController.createUser);
router.patch('/:userId/role', adminUsersController.updateRole);

module.exports = router;
