const express = require('express');
const { db } = require('../db/database.cjs');
const router = express.Router();

/**
 * GET /api/annotations
 * Gets all annotations for the current user.
 */
router.get('/', (req, res) => {
    const userId = req.auth.payload.sub;
    const stmt = db.prepare('SELECT * FROM profile_annotations WHERE user_id = ?');
    const annotations = stmt.all(userId);
    res.json(annotations);
});

/**
 * POST /api/annotations
 * Creates a new annotation.
 * Body: { title: string, content: string }
 */
router.post('/', (req, res) => {
    const userId = req.auth.payload.sub;
    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({ message: "Title and content are required." });
    }

    const stmt = db.prepare('INSERT INTO profile_annotations (user_id, title, content) VALUES (?, ?, ?)');
    const info = stmt.run(userId, title, content);

    const newAnnotation = db.prepare('SELECT * FROM profile_annotations WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(newAnnotation);
});

/**
 * DELETE /api/annotations/:id
 * Deletes a specific annotation belonging to the user.
 */
router.delete('/:id', (req, res) => {
    const userId = req.auth.payload.sub;
    const annotationId = req.params.id;

    // The "AND user_id = ?" is a crucial security check
    const stmt = db.prepare('DELETE FROM profile_annotations WHERE id = ? AND user_id = ?');
    const info = stmt.run(annotationId, userId);

    if (info.changes === 0) {
        return res.status(404).json({ message: "Annotation not found or you do not have permission to delete it." });
    }

    res.status(204).send(); // 204 No Content for successful deletion
});

module.exports = router;
