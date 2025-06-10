let auth0Client = null;

// =================================================
// == CONFIGURE THIS SECTION =======================
// =================================================
const config = {
  domain: "dev-x2v3dlltiosc2rnp.us.auth0.com",  
  clientId: "hIQ3gWLV7VtYGC0eobsW5ev2WjQaXPo4",
  audience: "https://dietamigo"
};
// =================================================

// --- Helper function for making authenticated API calls ---
const callApi = async (endpoint, method = 'GET', body = null) => {
    try {
        const token = await auth0Client.getTokenSilently();
        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
            }
        };
        if (body) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`/api${endpoint}`, options);

        if (response.status === 204) { // Handle successful DELETE with no content
            return { success: true, status: 204 };
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "API call failed");
        }

        return data;
    } catch (e) {
        console.error("API call error:", e);
        alert(`Error: ${e.message}`);
        throw e;
    }
};


// --- Render Functions (Update the UI) ---
const renderJson = (elementId, data) => {
    document.getElementById(elementId).innerText = JSON.stringify(data, null, 2);
};

const renderList = (elementId, items, deleteHandler, patchHandler = null) => {
    const container = document.getElementById(elementId);
    container.innerHTML = '';
    if (!items || items.length === 0) {
        container.innerHTML = '<li>No items found.</li>';
        return;
    }
    items.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `<pre>${JSON.stringify(item, null, 2)}</pre>`;

        const deleteBtn = document.createElement('button');
        deleteBtn.innerText = 'Delete';
        deleteBtn.dataset.id = item.id;
        deleteBtn.onclick = () => deleteHandler(item.id);
        li.appendChild(deleteBtn);

        if (patchHandler && item.hasOwnProperty('is_checked')) {
            const patchBtn = document.createElement('button');
            patchBtn.innerText = `Mark as ${item.is_checked ? 'Unchecked' : 'Checked'}`;
            patchBtn.dataset.id = item.id;
            patchBtn.onclick = () => patchHandler(item.id, !item.is_checked);
            li.appendChild(patchBtn);
        }

        container.appendChild(li);
    });
};


// --- API Interaction Functions ---

// Profile
const getProfile = async () => renderJson('profile-result', await callApi('/profile'));
const updateProfile = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const body = Object.fromEntries(formData.entries());
    // Convert empty strings to null and numbers where appropriate
    for(let key in body) {
        if(body[key] === '') delete body[key];
        if(['age', 'weight_kg'].includes(key) && body[key]) body[key] = Number(body[key]);
    }
    await callApi('/profile', 'PATCH', body);
    getProfile();
};

// Glucose
const getGlucose = async () => renderJson('glucose-result', await callApi('/glucose-reports?limit=30'));
const addGlucose = async (e) => {
    e.preventDefault();
    const body = { glucose_mg_dl: Number(e.target.glucose_mg_dl.value) };
    await callApi('/glucose-reports', 'POST', body);
    e.target.reset();
    getGlucose();
};

// Annotations
const getAnnotations = async () => renderList('annotations-result', await callApi('/annotations'), deleteAnnotation);
const addAnnotation = async (e) => {
    e.preventDefault();
    const body = { title: e.target.title.value, content: e.target.content.value };
    await callApi('/annotations', 'POST', body);
    e.target.reset();
    getAnnotations();
};
const deleteAnnotation = async (id) => {
    if (confirm(`Delete annotation ${id}?`)) {
        await callApi(`/annotations/${id}`, 'DELETE');
        getAnnotations();
    }
};

// Reminders
const getReminders = async () => renderList('reminders-result', await callApi('/reminders?limit=90'), deleteReminder, patchReminder);
const addReminder = async (e) => {
    e.preventDefault();
    const body = { reminder_at: e.target.reminder_at.value, title: e.target.title.value, description: e.target.description.value };
    await callApi('/reminders', 'POST', body);
    e.target.reset();
    getReminders();
};
const deleteReminder = async (id) => {
    if (confirm(`Delete reminder ${id}?`)) {
        await callApi(`/reminders/${id}`, 'DELETE');
        getReminders();
    }
};
const patchReminder = async (id, is_checked) => {
    await callApi(`/reminders/${id}`, 'PATCH', { is_checked });
    getReminders();
};

// Recurring Reminders
const getRecurringReminders = async () => renderList('recurring-reminders-result', await callApi('/reminders/recurring'), deleteRecurringReminder);
const addRecurringReminder = async (e) => {
    e.preventDefault();
    const body = { time_of_day: e.target.time_of_day.value, days_of_week: e.target.days_of_week.value, title: e.target.title.value, description: e.target.description.value };
    await callApi('/reminders/recurring', 'POST', body);
    e.target.reset();
    getRecurringReminders();
};
const deleteRecurringReminder = async (id) => {
    if (confirm(`Delete recurring reminder ${id}?`)) {
        await callApi(`/reminders/recurring/${id}`, 'DELETE');
        getRecurringReminders();
    }
};

// Food Log
const getFoodLog = async () => {
    const date = document.getElementById('food-log-date').value;
    renderList('food-log-result', await callApi(`/food-log?date=${date}`), deleteFoodLog);
};
const addFoodLog = async (e) => {
    e.preventDefault();
    const body = {
        food_item_id: Number(e.target.food_item_id.value),
        log_date: e.target.log_date.value,
        meal_type: e.target.meal_type.value,
        carbs_g: Number(e.target.carbs_g.value),
        protein_g: Number(e.target.protein_g.value)
    };
    await callApi('/food-log', 'POST', body);
    e.target.reset();
    getFoodLog();
};
const deleteFoodLog = async (id) => {
    if (confirm(`Delete food log entry ${id}?`)) {
        await callApi(`/food-log/${id}`, 'DELETE');
        getFoodLog();
    }
};

// --- Auth0 Boilerplate & Initial Setup ---
document.addEventListener("DOMContentLoaded", async () => {
    auth0Client = await auth0.createAuth0Client({
        domain: config.domain,
        clientId: config.clientId,
        authorizationParams: { audience: config.audience }
    });

    if (location.search.includes("code=") && location.search.includes("state=")) {
        await auth0Client.handleRedirectCallback();
        window.history.replaceState({}, document.title, "/");
    }

    updateUI();

    // Add event listeners for buttons
    document.getElementById("btn-login").addEventListener("click", () => auth0Client.loginWithRedirect({
    authorizationParams: {
      redirect_uri: window.location.origin
    }
  }));
    document.getElementById("btn-logout").addEventListener("click", () => auth0Client.logout({ logoutParams: { returnTo: window.location.origin } }));
});

const updateUI = async () => {
    const isAuthenticated = await auth0Client.isAuthenticated();
    document.getElementById("auth-actions").style.display = isAuthenticated ? "none" : "block";
    document.getElementById("gated-content").style.display = isAuthenticated ? "block" : "none";

    if (isAuthenticated) {
        // Attach form handlers
        document.getElementById('form-update-profile').addEventListener('submit', updateProfile);
        document.getElementById('form-add-glucose').addEventListener('submit', addGlucose);
        document.getElementById('form-add-annotation').addEventListener('submit', addAnnotation);
        document.getElementById('form-add-reminder').addEventListener('submit', addReminder);
        document.getElementById('form-add-recurring-reminder').addEventListener('submit', addRecurringReminder);
        document.getElementById('form-add-food-log').addEventListener('submit', addFoodLog);
        document.getElementById('btn-get-food-log').addEventListener('click', getFoodLog);

        // Initial data load
        getProfile();
        getGlucose();
        getAnnotations();
        getReminders();
        getRecurringReminders();
        document.getElementById('food-log-date').value = new Date().toISOString().split('T')[0];
        getFoodLog();
    }
};
