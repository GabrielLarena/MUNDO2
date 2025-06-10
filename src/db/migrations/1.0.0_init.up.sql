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

-- One-time reminders
CREATE TABLE reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    reminder_at TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    is_checked BOOLEAN NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Recurring reminder templates
CREATE TABLE recurring_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    time_of_day TEXT NOT NULL, -- e.g., '08:00'
    days_of_week TEXT NOT NULL, -- e.g., 'MON,WED,FRI'
    title TEXT NOT NULL,
    description TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- A global catalog of food items
CREATE TABLE food_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT
);

-- A log of food consumed by a user
CREATE TABLE daily_food_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    food_item_id INTEGER NOT NULL,
    log_date TEXT NOT NULL, -- e.g., '2023-10-27'
    meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    carbs_g REAL,
    protein_g REAL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (food_item_id) REFERENCES food_items (id)
);
