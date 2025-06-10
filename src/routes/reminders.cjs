const express = require('express');
const { db } = require('../db/database.cjs');
const router = express.Router();

// --- One-Time Reminders ---

router.get('/', (req, res) => {
    const userId = req.auth.payload.sub;
    const limitDays = parseInt(req.query.limit, 10) || 30;
    const stmt = db.prepare(`
        SELECT * FROM reminders
        WHERE user_id = ? AND reminder_at >= date('now', '-' || ? || ' days')
        ORDER BY reminder_at ASC
    `);
    res.json(stmt.all(userId, String(limitDays)));
});

router.post('/', (req, res) => {
    const userId = req.auth.payload.sub;
    const { reminder_at, title, description } = req.body;
    if (!reminder_at || !title) return res.status(400).json({ message: "reminder_at and title are required." });

    const stmt = db.prepare('INSERT INTO reminders (user_id, reminder_at, title, description) VALUES (?, ?, ?, ?)');
    const info = stmt.run(userId, reminder_at, title, description);
    const newReminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(newReminder);
});

router.patch('/:id', (req, res) => {
    const userId = req.auth.payload.sub;
    const reminderId = req.params.id;
    const { is_checked } = req.body; // Can be extended to update title, etc.

    if (typeof is_checked !== 'boolean') return res.status(400).json({ message: "is_checked must be a boolean." });

    const stmt = db.prepare('UPDATE reminders SET is_checked = ? WHERE id = ? AND user_id = ?');
    const info = stmt.run(is_checked, reminderId, userId);

    if (info.changes === 0) return res.status(404).json({ message: "Reminder not found." });
    res.status(200).json({ message: "Updated successfully." });
});

router.delete('/:id', (req, res) => {
    const userId = req.auth.payload.sub;
    const reminderId = req.params.id;
    const stmt = db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?');
    const info = stmt.run(reminderId, userId);
    if (info.changes === 0) return res.status(404).json({ message: "Reminder not found." });
    res.status(204).send();
});

// --- Recurring Reminders ---

router.get('/recurring', (req, res) => {
    const userId = req.auth.payload.sub;
    const stmt = db.prepare('SELECT * FROM recurring_reminders WHERE user_id = ?');
    res.json(stmt.all(userId));
});

router.post('/recurring', (req, res) => {
    const userId = req.auth.payload.sub;
    const { time_of_day, days_of_week, title, description } = req.body;
    if (!time_of_day || !days_of_week || !title) return res.status(400).json({ message: "time_of_day, days_of_week, and title are required." });

    const stmt = db.prepare('INSERT INTO recurring_reminders (user_id, time_of_day, days_of_week, title, description) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(userId, time_of_day, days_of_week, title, description);
    const newReminder = db.prepare('SELECT * FROM recurring_reminders WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(newReminder);
});

router.delete('/recurring/:id', (req, res) => {
    const userId = req.auth.payload.sub;
    const reminderId = req.params.id;
    const stmt = db.prepare('DELETE FROM recurring_reminders WHERE id = ? AND user_id = ?');
    const info = stmt.run(reminderId, userId);
    if (info.changes === 0) return res.status(404).json({ message: "Recurring reminder not found." });
    res.status(204).send();
});

module.exports = router;
