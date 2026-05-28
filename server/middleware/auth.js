const db = require('../db');

// Simple middleware for demo purposes to authenticate users
const authMiddleware = async (req, res, next) => {
    // For demo: pass user ID in 'x-user-id' header
    const userId = req.headers['x-user-id'];
    
    if (!userId) {
        return res.status(401).json({ error: 'Authentication required. Missing x-user-id header.' });
    }

    try {
        const [users] = await db.execute('SELECT * FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid user ID.' });
        }
        
        req.user = users[0];
        next();
    } catch (err) {
        res.status(500).json({ error: 'Database error during authentication.' });
    }
};

module.exports = authMiddleware;
