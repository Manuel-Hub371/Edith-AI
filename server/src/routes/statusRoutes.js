const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const mongoose = require('mongoose');

// @desc    Get system diagnostic status
// @route   GET /api/user/status
// @access  Private
router.get('/status', protect, async (req, res) => {
    try {
        const dbStatus = mongoose.connection.readyState === 1 ? 'OPTIMIZED' : 'DISCONNECTED';
        const aiStatus = process.env.GOOGLE_API_KEY ? 'READY' : 'KEY_MISSING';

        res.json({
            aiCore: aiStatus,
            neuralLink: "ENCRYPTED",
            localCache: "SYNCED",
            environment: "STABLE",
            dbStatus: dbStatus,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ message: 'Diagnostic failure' });
    }
});

module.exports = router;
