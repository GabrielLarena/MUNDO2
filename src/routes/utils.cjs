const express = require('express');
const { db } = require('../db/database.cjs');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser'); 
const router = express.Router();

/**
 * GET /utils/load
 * Utility endpoint to load food items from a CSV file into the database.
 * Expected CSV columns (based on your sample): Descrição dos alimentos, Energia (kcal), Proteína (g), Carboidrato (g)
 * This is a utility endpoint, access should be restricted.
 * For now, we'll restrict it to users with a valid JWT (meaning any logged-in user, adjust authZ as needed).
 * Consider adding an environment variable flag (e.g., ENABLE_CSV_LOAD) for extra safety in production.
 */
router.get('/load', async (req, res) => {
    const csvFilePath = path.join(__dirname, '../../assets/alimentos.csv');

    if (!fs.existsSync(csvFilePath)) {
        console.error(`CSV file not found at path: ${csvFilePath}`);
        return res.status(500).json({ message: "CSV file not found on the server." });
    }

    const results = [];
    let processedCount = 0;
    let errorCount = 0;

    console.log(`Starting to load food items from ${csvFilePath}`);

    try {
        // Prepare the SQL statement for upsert (insert or update)
        // This uses SQLite's ON CONFLICT clause assuming 'name' has a UNIQUE constraint
        const upsertStmt = db.prepare(`
            INSERT INTO food_items (name, energy_kcal_per_100g, protein_g_per_100g, carbs_g_per_100g)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
                energy_kcal_per_100g = excluded.energy_kcal_per_100g,
                protein_g_per_100g = excluded.protein_g_per_100g,
                carbs_g_per_100g = excluded.carbs_g_per_100g
        `);

        // Wrap the database operations in a transaction for better performance and atomicity
        db.exec('BEGIN TRANSACTION');

        fs.createReadStream(csvFilePath)
            .pipe(csv({
                separator: ';', // Specify the separator used in your CSV
                // Map CSV headers to more usable property names and handle commas in numbers
                mapHeaders: ({ header, index }) => {
                     switch(header.trim()) {
                        case 'Descrição dos alimentos': return 'name';
                        case 'Energia (kcal)': return 'energy_kcal_per_100g';
                        case 'Proteína (g)': return 'protein_g_per_100g';
                        case 'Carboidrato (g)': return 'carbs_g_per_100g';
                        default: return header; // Ignore other columns
                     }
                },
                // Convert string values to appropriate types and handle commas/NA
                mapValues: ({ header, index, value }) => {
                    value = value?.trim();
                    if (!value || value.toUpperCase() === 'NA' || value === '') {
                        // Handle 'NA' or empty values. For numerical fields, we might want to use null or 0.
                        // Assuming we want to store numbers, use 0 or null. Let's use null for now.
                        if (['energy_kcal_per_100g', 'protein_g_per_100g', 'carbs_g_per_100g'].includes(header)) {
                            return null; // Or 0 if you prefer
                        }
                        return value; // Return as is for other fields (though name shouldn't be NA)
                    }
                    // Handle decimal commas (e.g., "70,1" -> 70.1)
                    if (['energy_kcal_per_100g', 'protein_g_per_100g', 'carbs_g_per_100g'].includes(header)) {
                         const normalizedValue = value.replace(',', '.');
                         const num = parseFloat(normalizedValue);
                         return isNaN(num) ? null : num; // Convert to float or null if invalid
                    }
                    return value; // Return other string values as is
                }
            }))
            .on('data', (data) => {
                results.push(data);
                // console.log('Parsed row:', data); // Optional: Log parsed rows
            })
            .on('end', () => {
                console.log(`Finished parsing CSV. Total rows parsed: ${results.length}`);

                for (const item of results) {
                    if (!item.name) {
                        console.warn(`Skipping row due to missing name:`, item);
                        errorCount++;
                        continue;
                    }

                    try {
                        upsertStmt.run(
                            item.name,
                            item.energy_kcal_per_100g,
                            item.protein_g_per_100g,
                            item.carbs_g_per_100g
                        );
                        processedCount++;
                    } catch (dbErr) {
                        console.error(`Database error upserting item '${item.name}':`, dbErr);
                        errorCount++;
                    }
                }

                db.exec('COMMIT'); // Commit the transaction if everything went well so far

                console.log(`CSV loading completed. Processed: ${processedCount}, Errors: ${errorCount}`);
                res.json({
                    message: "CSV loading process finished.",
                    processed: processedCount,
                    errors: errorCount
                });
            })
            .on('error', (csvErr) => {
                console.error("Error reading or parsing CSV file:", csvErr);
                db.exec('ROLLBACK'); // Rollback transaction on CSV read/parse error
                res.status(500).json({ message: "Error reading or parsing CSV file.", error: csvErr.message });
            });

    } catch (err) {
        console.error("Unexpected error during CSV loading:", err);
        try {
             db.exec('ROLLBACK');
        } catch (rollbackErr) {
            console.error("Error rolling back transaction:", rollbackErr);
        }
        res.status(500).json({ message: "Internal server error during CSV loading.", error: err.message });
    }
});

module.exports = router;
