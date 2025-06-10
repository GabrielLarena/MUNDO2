const express = require('express');
const { db } = require('../db/database.cjs');
const router = express.Router();

/**
 * POST /api/glucose-reports
 * Creates a new glucose report for the current user at the current time.
 * Body: { glucose_mg_dl: number }
 */
router.post('/', (req, res) => {
    const userId = req.auth.payload.sub;
    const { glucose_mg_dl } = req.body;

    if (typeof glucose_mg_dl !== 'number') {
        return res.status(400).json({ message: "glucose_mg_dl must be a number." });
    }

    const stmt = db.prepare('INSERT INTO glucose_reports (user_id, glucose_mg_dl) VALUES (?, ?)');
    const info = stmt.run(userId, glucose_mg_dl);

    const newReport = db.prepare('SELECT * FROM glucose_reports WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(newReport);
});

/**
 * GET /api/glucose-reports?limit=<days>
 * Returns the highest glucose reading for each day within the last <limit> days.
 */
router.get('/', (req, res) => {
    const userId = req.auth.payload.sub;
    const limitDays = parseInt(req.query.limit, 10) || 7; // Default to 7 days

    const stmt = db.prepare(`
        SELECT
            date(reported_at) as report_date,
            MAX(glucose_mg_dl) as max_glucose
        FROM glucose_reports
        WHERE
            user_id = ? AND
            reported_at >= date('now', '-' || ? || ' days')
        GROUP BY report_date
        ORDER BY report_date DESC
    `);

    const reports = stmt.all(userId, String(limitDays));
    res.json(reports);
});

module.exports = router;
