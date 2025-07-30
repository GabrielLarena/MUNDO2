const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/database.cjs');
const router = express.Router();

/**
 * GET /api/food-log
 * Optional query params:
 *   - date (YYYY-MM-DD): filter logs by a specific date
 *   - limit (number): limit number of results
 *   - offset (number): offset for pagination
 *
 * Returns:
 * [
 *   {
 *     meal_group_id: "...",
 *     logged_at: "...",
 *     items: [{...}, {...}]
 *   },
 *   ...
 * ]
 */
router.get('/', (req, res) => {
    const userId = req.auth.payload.sub;

    const { date, limit, offset } = req.query;

    // Build dynamic query
    let sql = `
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
        WHERE l.user_id = ?
    `;
    const params = [userId];

    // Apply date filter if provided
    if (date) {
        sql += ` AND l.log_date = ?`;
        params.push(date);
    }

    // Always order by meal group and logged time
    sql += ` ORDER BY l.meal_group_id ASC, l.logged_at ASC`;

    // Apply limit and offset if provided
    if (limit) {
        sql += ` LIMIT ?`;
        params.push(parseInt(limit));
    }
    if (offset) {
        sql += ` OFFSET ?`;
        params.push(parseInt(offset));
    }

    const stmt = db.prepare(sql);

    try {
        const logs = stmt.all(...params);

        // Group logs into meals based on meal_group_id
        const mealsMap = new Map();

        logs.forEach(log => {
            if (!mealsMap.has(log.meal_group_id)) {
                mealsMap.set(log.meal_group_id, {
                    meal_group_id: log.meal_group_id,
                    logged_at: log.logged_at,
                    items: []
                });
            }
            mealsMap.get(log.meal_group_id).items.push(log);
        });

        const meals = Array.from(mealsMap.values());

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

/* PATCH /api/food-log/:id
* Updates an existing food log entry for the authenticated user.
* Only the fields provided in the request body will be updated.
* Currently supports updating: weight_g, meal_group_id.
* Body: { weight_g: number (optional), meal_group_id: string (optional) }
* @param {string} id - The ID of the food log entry to update.
* @returns {Promise<Object>} - A promise that resolves to the updated log entry.
* Returns 400 if validation fails, 404 if the entry is not found or doesn't belong to the user.
*/
router.patch('/:id', (req, res) => {
  const userId = req.auth.payload.sub;
  const logId = req.params.id;
  const { weight_g, meal_group_id } = req.body; // Allow partial updates

  // Basic validation for provided fields
  const updates = {};
  if (weight_g !== undefined) {
    if (typeof weight_g !== 'number' || weight_g <= 0) {
      return res.status(400).json({ message: "If provided, 'weight_g' must be a positive number." });
    }
    updates.weight_g = weight_g;
  }
  if (meal_group_id !== undefined) {
     if (typeof meal_group_id !== 'string' || meal_group_id.trim() === '') {
       return res.status(400).json({ message: "If provided, 'meal_group_id' must be a non-empty string." });
     }
     updates.meal_group_id = meal_group_id.trim();
  }

  // Check if there's anything to update
  if (Object.keys(updates).length === 0) {
     return res.status(400).json({ message: "At least one field (weight_g, meal_group_id) must be provided for update." });
  }

  // Build dynamic UPDATE query
  const setClauseParts = Object.keys(updates).map(key => `${key} = ?`);
  const setClause = setClauseParts.join(', ');
  const values = [...Object.values(updates), logId, userId]; // Add logId and userId for WHERE clause

  const sql = `
    UPDATE daily_food_log
    SET ${setClause}
    WHERE id = ? AND user_id = ?
  `;

  try {
    const stmt = db.prepare(sql);
    const info = stmt.run(...values);

    if (info.changes === 0) {
      return res.status(404).json({ message: "Food log entry not found or you do not have permission to update it." });
    }

    // Fetch the updated entry to return it
    const selectStmt = db.prepare('SELECT * FROM daily_food_log WHERE id = ?');
    const updatedEntry = selectStmt.get(logId);

    res.json(updatedEntry);
  } catch (err) {
    console.error("Error updating food log entry:", err);
    res.status(500).json({ message: "Internal server error while updating food log entry." });
  }
});

/*** GET /api/food-log/range
* Fetches the food log for a date range, grouped into meals.
* Query params:
* - startDate (YYYY-MM-DD): Start date (inclusive)
* - endDate (YYYY-MM-DD): End date (inclusive)
* Returns:
* An array of meal objects, grouped by date within the range:
* [
*   { date: "YYYY-MM-DD", meals: [ { meal_group_id, logged_at, items: [...] }, ... ] },
*   ...
* ]
* Note: Meals within each date are ordered by meal_group_id and logged_at.*/
router.get('/range', (req, res) => {
    const userId = req.auth.payload.sub;
    const { startDate, endDate } = req.query;

    // Basic validation
    if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate query parameters are required." });
    }

    // Optional: Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
    }

    // Query to fetch logs within the date range
    const sql = `
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
        WHERE l.user_id = ? AND l.log_date BETWEEN ? AND ?
        ORDER BY l.log_date ASC, l.meal_group_id ASC, l.logged_at ASC
    `;

    const params = [userId, startDate, endDate];

    const stmt = db.prepare(sql);
    try {
        const logs = stmt.all(...params);

        // Group logs into meals based on meal_group_id
        const mealsByDateMap = new Map(); // Key: log_date string, Value: Map of meals for that date
        logs.forEach(log => {
            const dateStr = log.log_date;
            if (!mealsByDateMap.has(dateStr)) {
                mealsByDateMap.set(dateStr, new Map()); // Inner map for meals of this date
            }
            const mealsMapForDate = mealsByDateMap.get(dateStr);

            if (!mealsMapForDate.has(log.meal_group_id)) {
                mealsMapForDate.set(log.meal_group_id, {
                    meal_group_id: log.meal_group_id,
                    logged_at: log.logged_at,
                    items: []
                });
            }
            mealsMapForDate.get(log.meal_group_id).items.push(log);
        });

        // Convert grouped data into the desired output format
        const result = [];
        mealsByDateMap.forEach((mealsMapForDate, dateStr) => {
             const mealsArray = Array.from(mealsMapForDate.values());
             result.push({
                 date: dateStr,
                 meals: mealsArray
             });
        });

        // Sort the final result by date ascending
        result.sort((a, b) => a.date.localeCompare(b.date));

        res.json(result);
    } catch (err) {
        console.error("Error fetching food log range:", err);
        res.status(500).json({ message: "Internal server error while fetching food log range." });
    }
});

module.exports = router;
