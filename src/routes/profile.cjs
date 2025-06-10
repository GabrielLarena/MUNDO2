const express = require('express');
const { db } = require('../db/database.cjs');
const router = express.Router();

// Middleware to find or create user on every request to this router
router.use((req, res, next) => {
    const userId = req.auth.payload.sub;
    const findUserStmt = db.prepare('SELECT * FROM users WHERE id = ?');
    let user = findUserStmt.get(userId);

    if (!user) {
        const userEmail = req.auth.payload[process.env.AUTH0_AUDIENCE + 'email'];
        if (!userEmail) {
            return res.status(400).json({ message: "Custom email claim not found in token." });
        }
        const insertUserStmt = db.prepare('INSERT INTO users (id, email) VALUES (?, ?)');
        insertUserStmt.run(userId, userEmail);
        user = findUserStmt.get(userId);
    }
    req.user = user; // Attach user object to the request
    next();
});

/**
 * GET /api/profile
 * Gets the current user's profile.
 */
router.get('/', (req, res) => {
    res.json(req.user);
});

/**
 * PATCH /api/profile
 * Updates the current user's profile.
 * Body: { name, bio, profile_picture_url, age, gender, weight_kg }
 */
router.patch('/', (req, res) => {
    const userId = req.user.id;
    const { name, bio, profile_picture_url, age, gender, weight_kg } = req.body;

    const fields = { name, bio, profile_picture_url, age, gender, weight_kg };
    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) {
            updates.push(`${key} = ?`);
            values.push(value);
        }
    }

    if (updates.length === 0) {
        return res.status(400).json({ message: "No fields to update provided." });
    }

    values.push(userId); // for the WHERE clause

    const stmt = db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.json(updatedUser);
});

module.exports = router;
