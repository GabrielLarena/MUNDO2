const express = require('express');
const { db } = require('../db/database.cjs');

const router = express.Router();

router.use((req, res, next) => {
  const userId = req.auth.payload.sub;
  const findUserStmt = db.prepare('SELECT * FROM users WHERE id = ?');
  let user = findUserStmt.get(userId);

  if (!user) {
    const userEmail = req.auth.payload[process.env.AUTH0_AUDIENCE + 'email'];
    if (!userEmail) {
       console.log("Warning: Email claim not found in token for user", userId);
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

// Helper function to calculate dates for a recurring reminder within a date range
function getDatesForRecurringReminder(startDateStr, endDateStr, timeOfDay, daysOfWeekStr) {
    const dates = [];
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    // Parse days of week string into a set of integers (0=Sunday, 6=Saturday)
    const validDays = new Set(
        daysOfWeekStr.split(',').map(day => {
            const map = { 'SUN': 0, 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6 };
            return map[day.trim().toUpperCase()];
        }).filter(d => d !== undefined)
    );

    if (validDays.size === 0) return dates; // Invalid days string

    const timeParts = timeOfDay.split(':');
    if (timeParts.length !== 2) return dates; // Invalid time format
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return dates; // Invalid time values

    const currentDate = new Date(startDate);
    
    // Adjust start date to the beginning of the week to ensure we catch weekly patterns correctly
    // This loop ensures we start checking from a consistent point
    while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay(); // 0 (Sunday) to 6 (Saturday)
        
        if (validDays.has(dayOfWeek)) {
            // Set the time for this date instance
            const instanceDate = new Date(currentDate);
            instanceDate.setHours(hours, minutes, 0, 0); // Set hours and minutes, reset seconds/milliseconds
            
            // Only add if it's within our target range
            if (instanceDate >= startDate && instanceDate <= endDate) {
                dates.push(instanceDate.toISOString());
            }
        }
        
        // Move to the next day
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
}


/**
 * GET /api/reminders?limit=<days>
 * Fetches a unified list of reminders for the next <limit> days.
 * Includes:
 *   - One-time reminders scheduled within the period.
 *   - Instances of recurring reminders that fall within the period.
 * Each item in the returned list has a 'reminder_at' datetime.
 * Recurring reminders will have a generated 'reminder_at' for each occurrence.
 */
router.get('/', (req, res) => {
    const userId = req.auth.payload.sub;
    const limitDays = parseInt(req.query.limit, 10) || 30;

    // Define the date range: from now to now + limitDays
    const now = new Date();
    const startDateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + limitDays);
    const endDateStr = futureDate.toISOString().split('T')[0]; // YYYY-MM-DD

    let oneTimeReminders = [];
    let recurringInstances = [];

    try {
        // 1. Fetch one-time reminders within the range
        const oneTimeStmt = db.prepare(`
            SELECT *, id as backend_id, 'one-time' as type FROM reminders
            WHERE user_id = ? AND reminder_at IS NOT NULL AND date(reminder_at) >= date('now') AND date(reminder_at) <= date('now', '+' || ? || ' days')
            ORDER BY reminder_at ASC
        `);
        oneTimeReminders = oneTimeStmt.all(userId, String(limitDays));

        // 2. Fetch recurring reminders for the user
        const recurringStmt = db.prepare(`
            SELECT *, id as backend_id, 'recurring' as type FROM reminders
            WHERE user_id = ? AND time_of_day IS NOT NULL AND days_of_week IS NOT NULL
        `);
        const recurringReminders = recurringStmt.all(userId);

        // 3. Generate instances for recurring reminders
        recurringReminders.forEach(reminder => {
            const dates = getDatesForRecurringReminder(startDateStr, endDateStr, reminder.time_of_day, reminder.days_of_week);
            dates.forEach(dateStr => {
                // Create an instance object that looks like a regular reminder
                // We can use a composite ID or a flag to distinguish it on the frontend if needed later
                // For now, just make it look like a regular reminder with a calculated datetime
                recurringInstances.push({
                    ...reminder, // Include all fields from the recurring template
                    id: `${reminder.backend_id}_${dateStr}`, // Unique ID for this instance
                    reminder_at: dateStr, // The calculated datetime for this instance
                    // title, description, is_checked are inherited from the template
                });
            });
        });

        // 4. Merge and sort the lists
        const allReminders = [...oneTimeReminders, ...recurringInstances];
        allReminders.sort((a, b) => new Date(a.reminder_at) - new Date(b.reminder_at));

        res.json(allReminders);
    } catch (err) {
        console.error("Error fetching reminders:", err);
        res.status(500).json({ message: "Internal server error while fetching reminders." });
    }
});

/**
 * POST /api/reminders
 * Creates a new reminder.
 * For one-time: { reminder_at: "YYYY-MM-DDTHH:MM:SS", title, description }
 * For recurring: { time_of_day: "HH:MM", days_of_week: "MON,WED,FRI", title, description }
 */
router.post('/', (req, res) => {
    const userId = req.auth.payload.sub;
    const { reminder_at, time_of_day, days_of_week, title, description } = req.body;

    // Basic validation: Must be one type or the other
    const isOneTime = !!reminder_at;
    const isRecurring = !!(time_of_day && days_of_week);

    if (!(isOneTime || isRecurring) || (isOneTime && isRecurring)) {
        return res.status(400).json({
            message: "Invalid request. Provide either (reminder_at) for one-time OR (time_of_day AND days_of_week) for recurring reminder."
        });
    }

    if (!title) {
        return res.status(400).json({ message: "title is required." });
    }

    // Prepare SQL based on type
    let stmt;
    let params;
    if (isOneTime) {
        stmt = db.prepare('INSERT INTO reminders (user_id, reminder_at, title, description) VALUES (?, ?, ?, ?)');
        params = [userId, reminder_at, title, description];
    } else { // isRecurring
        stmt = db.prepare('INSERT INTO reminders (user_id, time_of_day, days_of_week, title, description) VALUES (?, ?, ?, ?, ?)');
        params = [userId, time_of_day, days_of_week, title, description];
    }

    try {
        const info = stmt.run(...params);
        const newReminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(info.lastInsertRowid);
        res.status(201).json(newReminder);
    } catch (err) {
        console.error("Error creating reminder:", err);
        res.status(500).json({ message: "Internal server error while creating reminder." });
    }
});

/**
 * PATCH /api/reminders/:id
 * Updates a reminder. Can update title, description, is_checked.
 * For one-time reminders, reminder_at can also be updated.
 * For recurring reminders, time_of_day and days_of_week can also be updated.
 * Note: The ID used here should be the original database ID, not the composite one generated for instances.
 */
router.patch('/:id', (req, res) => {
    // Extract the actual database ID in case a composite ID was passed (though frontend should ideally use the real ID)
    const rawId = req.params.id;
    const parts = rawId.split('_');
    const reminderId = parts[0]; // Use the first part as the actual ID

    const userId = req.auth.payload.sub;
    const { reminder_at, time_of_day, days_of_week, title, description, is_checked } = req.body;

    // Build dynamic update query
    const fields = [];
    const values = [];

    if (reminder_at !== undefined) fields.push('reminder_at = ?'), values.push(reminder_at);
    if (time_of_day !== undefined) fields.push('time_of_day = ?'), values.push(time_of_day);
    if (days_of_week !== undefined) fields.push('days_of_week = ?'), values.push(days_of_week);
    if (title !== undefined) fields.push('title = ?'), values.push(title);
    if (description !== undefined) fields.push('description = ?'), values.push(description);
    if (typeof is_checked === 'boolean' || typeof is_checked === 'number') fields.push('is_checked = ?'), values.push(is_checked);

    if (fields.length === 0) {
        return res.status(400).json({ message: "No fields provided to update." });
    }

    values.push(reminderId, userId); // for WHERE clause

    const stmt = db.prepare(`UPDATE reminders SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`);
    const info = stmt.run(...values);

    if (info.changes === 0) {
        return res.status(404).json({ message: "Reminder not found or you do not have permission to update it." });
    }
    res.status(200).json({ message: "Reminder updated successfully." });
});

/**
 * DELETE /api/reminders/:id
 * Deletes a specific reminder (either one-time or recurring) belonging to the user.
 * Note: The ID used here should be the original database ID.
 */
router.delete('/:id', (req, res) => {
    // Extract the actual database ID
    const rawId = req.params.id;
    const parts = rawId.split('_');
    const reminderId = parts[0];

    const userId = req.auth.payload.sub;

    const stmt = db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?');
    const info = stmt.run(reminderId, userId);

    if (info.changes === 0) {
        return res.status(404).json({ message: "Reminder not found or you do not have permission to delete it." });
    }
    res.status(204).send(); // 204 No Content for successful deletion
});

module.exports = router;
