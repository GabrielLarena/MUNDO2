-- Users table, id is the Auth0 subject identifier
CREATE TABLE users (
    id TEXT PRIMARY KEY NOT NULL, -- Corresponds to Auth0 'sub'
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    bio TEXT,
    profile_picture_url TEXT,
    age INTEGER,
    gender TEXT,
    weight_kg REAL
);
-- Glucose reports linked to a user
CREATE TABLE glucose_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    reported_at TEXT NOT NULL DEFAULT (datetime('now')),
    glucose_mg_dl INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
-- Profile annotations (e.g., medical history, notes) linked to a user
CREATE TABLE profile_annotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
-- Unified Reminders table for both one-time and recurring reminders
-- If reminder_at IS NOT NULL: it's a one-time reminder scheduled for that datetime.
-- If reminder_at IS NULL: it's a recurring reminder defined by time_of_day and days_of_week.
CREATE TABLE reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    -- Fields for one-time reminders
    reminder_at TEXT, -- Specific datetime for one-time reminders
    -- Fields for recurring reminders
    time_of_day TEXT, -- e.g., '08:00' (for recurring)
    days_of_week TEXT, -- e.g., 'MON,WED,FRI' (for recurring)
    -- Common fields
    title TEXT NOT NULL,
    description TEXT,
    is_checked BOOLEAN NOT NULL DEFAULT 0, -- Applicable mainly to instances of recurring reminders shown on a specific date
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
-- A global catalog of food items (Updated Schema)
CREATE TABLE food_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    energy_kcal_per_100g REAL NOT NULL, -- Energy in kcal per 100g
    protein_g_per_100g REAL NOT NULL,   -- Protein in grams per 100g
    carbs_g_per_100g REAL NOT NULL      -- Carbohydrates in grams per 100g
);
-- A log of food consumed by a user (Updated Schema)
CREATE TABLE daily_food_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    log_date TEXT NOT NULL,             -- e.g., '2023-10-27'
    food_item_id INTEGER NOT NULL,
    weight_g REAL NOT NULL,             -- Weight of the food item consumed in grams
    logged_at TEXT NOT NULL DEFAULT (datetime('now')), -- Timestamp when the item was logged
    meal_group_id TEXT NOT NULL,        -- Identifier to group items into a "meal"
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (food_item_id) REFERENCES food_items (id)
);
-- Index for efficient querying by user and date
CREATE INDEX idx_daily_food_log_user_date ON daily_food_log(user_id, log_date);
