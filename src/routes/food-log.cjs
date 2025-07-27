const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/database.cjs');
const router = express.Router();

/**
 * GET /api/food-log?date=YYYY-MM-DD
 * Gets the food log for a specific date, grouped into "meals" by meal_group_id.
 * Defaults to today's date if 'date' query param is not provided.
 * Returns: [{ meal_group_id: "...", logged_at: "...", items: [{...}, {...}] }, {...}]
 */
router.get('/', (req, res) => {
    const userId = req.auth.payload.sub;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const stmt = db.prepare(`
        SELECT
            l.id AS log_id,
            l.user_id,
            l.log_date,
            l.food_item_id,
            l.weight_g,
            l.logged_at,
            l.meal_group_id,
            f.name AS food_name,
            f.energy_kcal_per_100g,
            f.protein_g_per_100g,
            f.carbs_g_per_100g
        FROM daily_food_log l
        JOIN food_items f ON l.food_item_id = f.id
        WHERE l.user_id = ? AND l.log_date = ?
        ORDER BY l.meal_group_id ASC, l.logged_at ASC
    `);

    try {
        const logs = stmt.all(userId, date);

        // Group logs into meals based on meal_group_id
        const mealsMap = new Map();

        logs.forEach(log => {
            if (!mealsMap.has(log.meal_group_id)) {
                mealsMap.set(log.meal_group_id, {
                    meal_group_id: log.meal_group_id,
                    // Use the logged_at of the first item added to this group as the meal's time
                    logged_at: log.logged_at,
                    items: []
                });
            }
            // Add the log item to its corresponding meal group
            mealsMap.get(log.meal_group_id).items.push(log);
        });

        // Convert the Map values to an array for the response
        const meals = Array.from(mealsMap.values());

        // Optional: Sort meals by their first item's logged_at time if needed
        // meals.sort((a, b) => new Date(a.logged_at) - new Date(b.logged_at));

        res.json(meals);
    } catch (err) {
        console.error("Error fetching food log:", err);
        res.status(500).json({ message: "Internal server error while fetching food log." });
    }
});

/**
 * GET /api/food-log/totals?date=YYYY-MM-DD
 * Calculates and returns the total calories, protein, and carbs consumed on a specific date.
 * Defaults to today's date if 'date' query param is not provided.
 */
router.get('/totals', (req, res) => {
    const userId = req.auth.payload.sub;
    // Default to today's date if not provided
    const date = req.query.date || new Date().toISOString().split('T')[0];

    // Query to aggregate nutritional values based on weight consumed
    const stmt = db.prepare(`
        SELECT
            SUM((l.weight_g / 100.0) * f.energy_kcal_per_100g) AS total_energy_kcal,
            SUM((l.weight_g / 100.0) * f.protein_g_per_100g) AS total_protein_g,
            SUM((l.weight_g / 100.0) * f.carbs_g_per_100g) AS total_carbs_g
        FROM daily_food_log l
        JOIN food_items f ON l.food_item_id = f.id
        WHERE l.user_id = ? AND l.log_date = ?
    `);

    try {
        const totals = stmt.get(userId, date);

        // Handle case where no logs exist for the date
        if (!totals) {
             return res.json({
                total_energy_kcal: 0,
                total_protein_g: 0,
                total_carbs_g: 0
            });
        }

        // Ensure numeric types and round if desired (optional)
        const result = {
            total_energy_kcal: parseFloat(totals.total_energy_kcal?.toFixed(2)) || 0,
            total_protein_g: parseFloat(totals.total_protein_g?.toFixed(2)) || 0,
            total_carbs_g: parseFloat(totals.total_carbs_g?.toFixed(2)) || 0
        };

        res.json(result);
    } catch (err) {
        console.error("Error calculating food log totals:", err);
        res.status(500).json({ message: "Internal server error while calculating food log totals." });
    }
});


/**
 * POST /api/food-log
 * Adds an entry to the food log.
 * Body: { food_item_id: integer, log_date: string (YYYY-MM-DD), weight_g: number, meal_group_id: string (optional) }
 * If meal_group_id is not provided, a new one is generated, signifying a new meal.
 */
router.post('/', (req, res) => {
    const userId = req.auth.payload.sub;
    let { food_item_id, log_date, weight_g, meal_group_id } = req.body;

    // Basic validation
    if (!food_item_id || !log_date || typeof weight_g !== 'number' || weight_g <= 0) {
        return res.status(400).json({ message: "food_item_id, log_date, and a positive weight_g are required." });
    }

    // If no meal_group_id is provided, generate a new one for a new meal
    if (!meal_group_id) {
        meal_group_id = uuidv4();
    }

    // logged_at defaults to CURRENT_TIMESTAMP
    const stmt = db.prepare(`
        INSERT INTO daily_food_log
        (user_id, food_item_id, log_date, weight_g, meal_group_id)
        VALUES (?, ?, ?, ?, ?)
    `);

    try {
        const info = stmt.run(userId, food_item_id, log_date, weight_g, meal_group_id);
        const newLogId = info.lastInsertRowid;
        // Fetch the newly created log entry to return it
        const newLogStmt = db.prepare('SELECT * FROM daily_food_log WHERE id = ?');
        const newLog = newLogStmt.get(newLogId);
        res.status(201).json(newLog);
    } catch (err) {
        console.error("Error creating food log entry:", err);
        // Check for specific errors like foreign key constraint?
        res.status(500).json({ message: "Internal server error while creating food log entry." });
    }
});

/**
 * DELETE /api/food-log/:id
 * Deletes a specific food log entry belonging to the user.
 * This effectively removes one item from its associated "meal".
 */
router.delete('/:id', (req, res) => {
    const userId = req.auth.payload.sub;
    const logId = req.params.id;

    // Ensure the log entry belongs to the user
    const stmt = db.prepare('DELETE FROM daily_food_log WHERE id = ? AND user_id = ?');

    try {
        const info = stmt.run(logId, userId);
        if (info.changes === 0) {
            return res.status(404).json({ message: "Food log entry not found or you do not have permission to delete it." });
        }
        res.status(204).send(); // 204 No Content for successful deletion
    } catch(err) {
         console.error("Error deleting food log entry:", err);
         res.status(500).json({ message: "Internal server error while deleting food log entry." });
    }
});

module.exports = router;
