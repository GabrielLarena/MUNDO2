// --- Configuration ---
// Ensure these match your Auth0 application settings
const AUTH_CONFIG = {
  domain: 'dev-x2v3dlltiosc2rnp.us.auth0.com',
  clientId: 'hIQ3gWLV7VtYGC0eobsW5ev2WjQaXPo4',
  audience: 'https://dietamigo',
  // redirectUri should point to the page handling the callback (often login.html or the main page if handling there)
  redirectUri: window.location.origin + '/login.html', // Adjust path if needed
};

// --- Client Instance and Initialization ---
let auth0Client = null;
let initPromise = null; // To handle concurrent init calls
const TOKEN_STORAGE_KEY = 'access_token'; // Key for localStorage

/**
 * Initialize the Auth0 client (only once).
 * Because the SDK is loaded globally, we create the client instance here.
 * Returns a promise that resolves to the client instance.
 * @returns {Promise<Auth0Client>}
 */
export async function initAuth() {
  // If initialization is already in progress or done, return the promise/client
  if (initPromise) {
    return initPromise;
  }
  if (auth0Client) {
    return auth0Client;
  }

  // Start initialization and store the promise
  initPromise = (async () => {
    try {
      // Use the globally available 'auth0' object to create the client
      // Note: The constructor signature might differ slightly from the imported version
      auth0Client = new auth0.Auth0Client({
        domain: AUTH_CONFIG.domain,
        clientId: AUTH_CONFIG.clientId,
        cacheLocation: 'localstorage', // Defaults to 'memory'
        useRefreshTokens: true, // Enable for better UX
        authorizationParams: {
          audience: AUTH_CONFIG.audience,
          redirect_uri: AUTH_CONFIG.redirectUri,
        },
        // Legacy config options (might be needed depending on the exact global version)
        // audience: AUTH_CONFIG.audience,
        // redirect_uri: AUTH_CONFIG.redirectUri
      });
      console.log('Auth0 client initialized.');
      return auth0Client;
    } catch (error) {
      console.error('Error initializing Auth0 client:', error);
      // Reset promise so init can be retried if needed
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Redirect the user to Auth0's Universal Login page.
 * This function initiates the login flow.
 */
export async function login() {
  try {
    const client = await initAuth(); // Ensure client is initialized
    await client.loginWithRedirect({
      authorizationParams: {
        audience: AUTH_CONFIG.audience,
        redirect_uri: AUTH_CONFIG.redirectUri,
      },
    });
  } catch (error) {
    console.error('Login initiation error:', error);
    // Handle login initiation error (e.g., display message)
  }
}

/**
 * Call this on your callback page (e.g., /login.html) to complete the redirect flow.
 * This processes the result from Auth0 and stores the token.
 * @returns {Promise<Object>} Object containing appState and token.
 */
export async function handleRedirectCallback() {
  try {
    const client = await initAuth(); // Ensure client is initialized

    // Process the authentication result from the URL
    const redirectResult = await client.handleRedirectCallback();
    console.log('Auth0 redirect callback result:', redirectResult);

    // After handling the callback, get the access token
    // getTokenSilently is often used here or shortly after to ensure token is available
    const token = await client.getTokenSilently({
      authorizationParams: {
        audience: AUTH_CONFIG.audience,
        redirect_uri: AUTH_CONFIG.redirectUri,
      },
    });

    // Store the token in localStorage for easy access by other parts of your app
    localStorage.setItem(TOKEN_STORAGE_KEY, token);

    console.log('Auth callback handled, token stored.');
    // Remove query parameters from the URL for a clean address bar
    window.history.replaceState({}, document.title, window.location.pathname);
    return { appState: redirectResult.appState, token };
  } catch (error) {
    console.error('Error handling Auth0 redirect callback:', error);
    // Potentially clear any stale state
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    // Re-throw to allow caller to handle (e.g., redirect to login)
    throw error;
  }
}

/**
 * Return the current access token.
 * 1) Checks localStorage for a stored token.
 * 2) If not found/expired, attempts silent token renewal.
 * @returns {Promise<string|null>} The access token, or null if unable to retrieve.
 */
export async function getAccessToken() {
  try {
    // 1) Quick check in your own localStorage key (optional, for easy access)
    // Note: The SPA SDK manages its own token cache internally.
    let token = localStorage.getItem(TOKEN_STORAGE_KEY);

    if (token) {
      // Optional: Add basic expiry check if you store expiry time too
      // Or just rely on getTokenSilently's internal handling
      console.log("Token found in localStorage.");
      return token;
    }

    // 2) Fallback/Primary: Use Auth0 SDK to get the token (handles internal cache/silent renewal)
    const client = await initAuth();
    token = await client.getTokenSilently({
      authorizationParams: {
        audience: AUTH_CONFIG.audience,
        redirect_uri: AUTH_CONFIG.redirectUri, // Make sure redirect_uri matches config
      },
    });

    // Mirror it again in localStorage if needed by other non-async parts
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    console.log("Token retrieved via getTokenSilently.");
    return token;
  } catch (error) {
    console.error('Error retrieving access token:', error);
    // Clear potentially invalid token
    localStorage.removeItem(TOKEN_STORAGE_KEY);

    // Check if it's a login required error (user needs to log in)
    if (error.error === 'login_required' || error.error === 'consent_required') {
      console.log('Login required to get token.');
      return null; // Indicate no token available
    }

    // Handle other errors (e.g., network issues)
    // Let the caller decide how to handle unexpected errors
    throw error;
  }
}

/**
 * Logs the user out both locally and at Auth0,
 * then redirects to `returnTo`.
 * @param {string} returnTo - The URL to redirect the user to after logout.
 */
export async function logout(returnTo = window.location.origin) {
  try {
    // Clear your simple key from localStorage
    localStorage.removeItem(TOKEN_STORAGE_KEY);

    const client = await initAuth(); // Ensure client is initialized
    await client.logout({
      logoutParams: {
        returnTo: returnTo, // URL to return to after logout
      },
    });
    // Note: The SDK handles the redirect, so code below might not execute
  } catch (error) {
    console.error('Logout error:', error);
    // Handle logout error (e.g., display message)
    // Even if SDK logout fails, local cleanup was done
    // You might want to redirect manually here if SDK fails
    window.location.replace(returnTo);
  }
}
