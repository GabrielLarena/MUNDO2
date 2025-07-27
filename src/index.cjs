require('dotenv').config();

const express = require('express');
const { auth } = require('express-oauth2-jwt-bearer');
const { migrate } = require('./db/database.cjs');

// --- Import Routers ---
const profileRouter = require('./routes/profile.cjs');
const glucoseRouter = require('./routes/glucose.cjs');
const annotationsRouter = require('./routes/annotations.cjs');
const remindersRouter = require('./routes/reminders.cjs');
const foodLogRouter = require('./routes/food-log.cjs');
const utilsRouter = require('./routes/utils.cjs');
const foodItemsRouter = require('./routes/food-items.cjs');

// --- Initialization ---
const app = express();
const PORT = process.env.PORT || 3000;

try {
    migrate();
} catch (error) {
    console.error("Could not start server due to migration failure:", error.message);
    process.exit(1);
}

// --- Auth0 Middleware ---
const checkJwt = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  tokenSigningAlg: 'RS256'
});

// --- Middlewares ---
app.use(express.json());
app.use(express.static('public'));

// --- API Router ---
const apiRouter = express.Router();
apiRouter.use(checkJwt);
apiRouter.use('/profile', profileRouter);
apiRouter.use('/glucose-reports', glucoseRouter);
apiRouter.use('/annotations', annotationsRouter);
apiRouter.use('/reminders', remindersRouter);
apiRouter.use('/food-log', foodLogRouter);
apiRouter.use('/food-items', foodItemsRouter);

// Mount the API routers
app.use('/api', apiRouter);
app.use('/utils', utilsRouter);

// --- Server Start ---
app.listen(PORT, () => {
  console.log(`Listening on port: ${PORT}`);
});
