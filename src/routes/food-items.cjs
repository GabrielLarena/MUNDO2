const express = require('express');
const { db } = require('../db/database.cjs');
const router = express.Router();

router.use((req, res, next) => {
  const userId = req.auth.payload.sub;
  const findUserStmt = db.prepare('SELECT * FROM users WHERE id = ?');
  let user = findUserStmt.get(userId);

  if (!user) {
    // Try to get email from a custom claim if needed, or just use sub
    // This part depends on your specific setup and needs
    const userEmail = req.auth.payload[process.env.AUTH0_AUDIENCE + 'email'];
    if (!userEmail) {
       // Fallback or error handling if email is critical and not found
       // For just creating the user link, maybe email isn't strictly needed initially
       // Or you could decide not to create the user here if email is missing
       // Let's assume id (sub) is enough for the FK for now.
       console.log("Warning: Email claim not found in token for user", userId);
       // You could potentially just insert with NULL email or a placeholder
       // Or skip user creation if email is mandatory for your user logic.
       // For now, let's proceed with just the ID for the FK.
       userEmail = null; // Or handle as appropriate
    }

    const insertUserStmt = db.prepare('INSERT INTO users (id, email) VALUES (?, ?)');
    try {
       insertUserStmt.run(userId, userEmail); // Might insert email as NULL if userEmail is null
       user = findUserStmt.get(userId); // Re-fetch the newly created user
       console.log("New user created in DB:", userId);
    } catch (insertError) {
        console.error("Error creating user in DB:", insertError);
        // If it's a unique constraint error, maybe the user was created concurrently,
        // but that's unlikely with the SELECT check. Re-throw or handle.
        return res.status(500).json({ message: "Internal server error during user setup." });
    }
  }

  // If user exists or was just created, continue
  next();
});

/**
 * GET /api/food-items/search?q=<query>
 * Searches for food items by name.
 * If 'q' is provided, finds the 10 most similar items (using LIKE with %query%).
 * If 'q' is not provided, returns the first 10 items ordered by ID.
 * Query parameter 'q' should be URL-encoded.
 */
router.get('/search', (req, res) => {
  const searchTerm = req.query.q;

  let stmt;
  let params = [];

  if (searchTerm && typeof searchTerm === 'string') {
    // Sanitize input slightly and prepare for LIKE search
    // Using %term% for "contains" search. Adjust collation if needed for case sensitivity.
    const sanitizedTerm = searchTerm.trim();
    if (sanitizedTerm.length > 0) {
      stmt = db.prepare(`
        SELECT id, name, energy_kcal_per_100g, protein_g_per_100g, carbs_g_per_100g
        FROM food_items
        WHERE name LIKE ?
        ORDER BY name
        LIMIT 10
      `);
      params = [`%${sanitizedTerm}%`];
    } else {
      // If trimmed term is empty, treat as no term provided
      stmt = db.prepare(`
        SELECT id, name, energy_kcal_per_100g, protein_g_per_100g, carbs_g_per_100g
        FROM food_items
        ORDER BY id
        LIMIT 10
      `);
    }
  } else {
    // No search term provided, return first 10 by ID
     stmt = db.prepare(`
        SELECT id, name, energy_kcal_per_100g, protein_g_per_100g, carbs_g_per_100g
        FROM food_items
        ORDER BY id
        LIMIT 10
      `);
  }

  try {
    const items = stmt.all(...params);
    res.json(items);
  } catch (err) {
    console.error("Error searching food items:", err);
    res.status(500).json({ message: "Internal server error while searching food items." });
  }
});

module.exports = router;
