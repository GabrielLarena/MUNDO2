/**
 * A simple client library to interact with the backend API.
 * Assumes the backend is hosted at the same origin or configured for CORS.
 * Requires a valid Auth0 access token to be set before making requests.
 */
class ApiClient {
    constructor(basePath = '/api') {
        this.basePath = basePath;
        this.token = null;
    }
    /**
     * Sets the authentication token for subsequent requests.
     * @param {string} token - The JWT access token from Auth0.
     */
    setAuthToken(token) {
        this.token = token;
    }
    /**
     * Helper to make HTTP requests.
     * @private
     */
    async _request(url, options = {}) {
        if (!this.token) {
            console.error("API Client: Auth token not set. Please call setAuthToken(token).");
            throw new Error("Authentication token is required.");
        }
        const fullUrl = `${this.basePath}${url}`;
        const defaultHeaders = {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
        const config = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            }
        };
        try {
            const response = await fetch(fullUrl, config);
            if (!response.ok) {
                // Try to parse error message from response body
                let errorMessage = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    // Ignore if error body isn't JSON
                }
                throw new Error(errorMessage);
            }
            // If the response is 204 No Content, return null or an empty object
            if (response.status === 204) {
                return null;
            }
            return await response.json();
        } catch (error) {
            console.error(`API Request failed: ${fullUrl}`, error);
            throw error; // Re-throw for the caller to handle
        }
    }
    // --- Profile ---
    async getProfile() {
        return this._request('/profile');
    }
    async updateProfile(profileData) {
        return this._request('/profile', {
            method: 'PATCH',
            body: JSON.stringify(profileData)
        });
    }
    // --- Food Items (Catalog) ---
    // Note: Loading from CSV is typically a backend utility, not exposed to standard frontend users.
    // If needed, a specific admin function could be added.
    // --- Daily Food Log (with Meal Grouping) ---
    //
/**
 * Fetches the food log for a specific date, grouped into meals.
 * @param {string} [date] - Date in YYYY-MM-DD format. Defaults to today if omitted.
 * @param {number} [limit] - Maximum number of meal groups to return.
 * @param {number} [offset] - Number of meal groups to skip.
 * @returns {Promise<Array>} - A promise that resolves to an array of meal objects.
 *   Each meal: { meal_group_id, logged_at, items: [...] }
 */
async getFoodLog(date, limit, offset) {
    const params = new URLSearchParams();
    
    if (date) {
        params.append('date', date);
    }
    if (limit !== undefined) {
        params.append('limit', limit.toString());
    }
    if (offset !== undefined) {
        params.append('offset', offset.toString());
    }
    
    const queryString = params.toString();
    const url = `/food-log${queryString ? `?${queryString}` : ''}`;
    
    return this._request(url);
}

    /**
     * Fetches the food log for a specific date, grouped into meals.
     * @param {string} date - Date in YYYY-MM-DD format. Defaults to today if omitted.
     * @returns {Promise<Array>} - A promise that resolves to an array of meal objects.
     *   Each meal: { meal_group_id, logged_at, items: [...] }
     */
    async getFoodLog(date) {
        let url = '/food-log';
        if (date) {
            url += `?date=${encodeURIComponent(date)}`;
        }
        return this._request(url);
    }

    /**
     * Fetches the total calories, protein, and carbs consumed on a specific date.
     * @param {string} date - Date in YYYY-MM-DD format. Defaults to today if omitted.
     * @returns {Promise<Object>} - A promise that resolves to an object with totals.
     *   { total_energy_kcal, total_protein_g, total_carbs_g }
     */
    async getFoodLogTotals(date) {
        let url = '/food-log/totals';
        if (date) {
            url += `?date=${encodeURIComponent(date)}`;
        }
        return this._request(url);
    }
    /**
     * Adds a new food item to the log.
     * If adding to a new meal, omit meal_group_id. The backend will generate one.
     * If adding to an existing meal, provide the meal_group_id.
     * @param {Object} logData - The data for the new log entry.
     *   { food_item_id, log_date, weight_g, meal_group_id (optional) }
     * @returns {Promise<Object>} - A promise that resolves to the created log entry.
     */
    async addFoodLogEntry(logData) {
        return this._request('/food-log', {
            method: 'POST',
            body: JSON.stringify(logData)
        });
    }
    /**
     * Deletes a specific food log entry by its ID.
     * This removes the item from its meal group.
     * @param {number} logId - The ID of the log entry to delete.
     * @returns {Promise<void>} - A promise that resolves when the entry is deleted.
     */
    async deleteFoodLogEntry(logId) {
        return this._request(`/food-log/${logId}`, {
            method: 'DELETE'
        });
    }

  /**
   * Updates an existing food log entry.
   * Sends a PATCH request with only the fields that need to be changed.
   * @param {number} logId - The ID of the log entry to update.
   * @param {Object} updateData - An object containing the fields to update and their new values.
   *                              e.g., { weight_g: 150 } or { meal_group_id: 'new-group-id' }
   * @returns {Promise<Object>} - A promise that resolves to the updated log entry object.
   */
  async updateFoodLogEntry(logId, updateData) {
    return this._request(`/food-log/${logId}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData)
    });
  }
    // --- Glucose Reports ---
    async createGlucoseReport(glucoseData) {
        return this._request('/glucose-reports', {
            method: 'POST',
            body: JSON.stringify(glucoseData)
        });
    }
    async getGlucoseReports(limitDays) {
        let url = '/glucose-reports';
        if (limitDays) {
            url += `?limit=${encodeURIComponent(limitDays)}`;
        }
        return this._request(url);
    }
    // --- Annotations ---
    async getAnnotations() {
        return this._request('/annotations');
    }
    async createAnnotation(annotationData) {
        return this._request('/annotations', {
            method: 'POST',
            body: JSON.stringify(annotationData)
        });
    }
    async deleteAnnotation(annotationId) {
        return this._request(`/annotations/${annotationId}`, {
            method: 'DELETE'
        });
    }
    // --- Unified Reminders ---
    /**
     * Fetches one-time reminders within a specified time window.
     * @param {number} limitDays - Number of days to look back and forward. Defaults to 30.
     * @returns {Promise<Array>} - A promise that resolves to an array of reminder objects.
     */
    async getReminders(limitDays) {
        let url = '/reminders';
        if (limitDays) {
             url += `?limit=${encodeURIComponent(limitDays)}`;
        }
        return this._request(url);
    }
    /**
     * Creates a new reminder (either one-time or recurring).
     * For one-time: { reminder_at, title, description }
     * For recurring: { time_of_day, days_of_week, title, description }
     * @param {Object} reminderData - The data for the new reminder.
     * @returns {Promise<Object>} - A promise that resolves to the created reminder object.
     */
    async createReminder(reminderData) {
        return this._request('/reminders', {
            method: 'POST',
            body: JSON.stringify(reminderData)
        });
    }
    /**
     * Updates an existing reminder.
     * @param {number} reminderId - The ID of the reminder to update.
     * @param {Object} updateData - The fields to update.
     * @returns {Promise<Object>} - A promise that resolves to a success message.
     */
    async updateReminder(reminderId, updateData) {
         return this._request(`/reminders/${reminderId}`, {
            method: 'PATCH',
            body: JSON.stringify(updateData)
        });
    }
    /**
     * Deletes a specific reminder.
     * @param {number} reminderId - The ID of the reminder to delete.
     * @returns {Promise<void>} - A promise that resolves when the reminder is deleted.
     */
    async deleteReminder(reminderId) {
        return this._request(`/reminders/${reminderId}`, {
            method: 'DELETE'
        });
    }

  /**
   * Searches for food items by name.
   * @param {string} [query] - The search term. If omitted, returns the first 10 items.
   * @returns {Promise<Array>} - A promise that resolves to an array of food item objects.
   *                             Returns up to 10 items.
   */
  async searchFoodItems(query) {
    let url = '/food-items/search';
    if (query) {
      // Ensure the query is properly URL encoded
      url += `?q=${encodeURIComponent(query)}`;
    }
    return this._request(url);
  }

}
// Create a singleton instance for easy import and use
const apiClient = new ApiClient();
export default apiClient;
// Export the class itself in case multiple instances are needed
export { ApiClient };
