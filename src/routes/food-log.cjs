const express = require('express');
const { db } = require('../db/database.cjs');
const router = express.Router();

/**
 * GET /api/food-log?date=YYYY-MM-DD
 * Gets the food log for a specific date. Defaults to today.
 */
router.get('/', (req, res) => {
    const userId = req.auth.payload.sub;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const stmt = db.prepare(`
        SELECT l.*, f.name as food_name
        FROM daily_food_log l
        JOIN food_items f ON l.food_item_id = f.id
        WHERE l.user_id = ? AND l.log_date = ?
        ORDER BY l.id ASC
    `);
    const logs = stmt.all(userId, date);
    res.json(logs);
});

/**
 * POST /api/food-log
 * Adds an entry to the food log.
 * Body: { food_item_id, log_date, meal_type, carbs_g, protein_g }
 */
router.post('/', (req, res) => {
    const userId = req.auth.payload.sub;
    const { food_item_id, log_date, meal_type, carbs_g, protein_g } = req.body;

    // Basic validation
    if (!food_item_id || !log_date || !meal_type) {
        return res.status(400).json({ message: "food_item_id, log_date, and meal_type are required." });
    }

    const stmt = db.prepare('INSERT INTO daily_food_log (user_id, food_item_id, log_date, meal_type, carbs_g, protein_g) VALUES (?, ?, ?, ?, ?, ?)');
    const info = stmt.run(userId, food_item_id, log_date, meal_type, carbs_g, protein_g);

    const newLog = db.prepare('SELECT * FROM daily_food_log WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(newLog);
});

/**
 * DELETE /api/food-log/:id
 * Deletes a food log entry.
 */
router.delete('/:id', (req, res) => {
    const userId = req.auth.payload.sub;
    const logId = req.params.id;
    const stmt = db.prepare('DELETE FROM daily_food_log WHERE id = ? AND user_id = ?');
    const info = stmt.run(logId, userId);
    if (info.changes === 0) return res.status(404).json({ message: "Log entry not found." });
    res.status(204).send();
});

module.exports = router;
