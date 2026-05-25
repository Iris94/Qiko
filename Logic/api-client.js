/**
 * Universal API Client Wrapper for Qiko Extension.
 * Standardizes fetch operations, JSON serialization/deserialization, and error handling.
 */

/**
 * Perform a fetch request to a specified endpoint.
 *
 * @param {string} endpoint - The target URL.
 * @param {string} [method='POST'] - HTTP method (GET, POST, PUT, DELETE, PATCH, etc.).
 * @param {Object|string|null} [body=null] - The payload body. Will be JSON stringified if it is an object.
 * @param {string|null} [token=null] - Optional Firebase ID token for authentication. Appended to database requests.
 * @returns {Promise<any>} The parsed JSON response or null for empty responses.
 * @throws {Error} Structured error object containing status code and error message.
 */
export async function callApi(endpoint, method = 'POST', body = null, token = null) {
  let url = endpoint;

  // Append database auth token query parameter if provided
  if (token) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}auth=${encodeURIComponent(token)}`;
  }

  const options = {
    method: method.toUpperCase(),
    headers: {}
  };

  // Set payload headers and serialize if necessary
  if (body !== null) {
    if (typeof body === 'object') {
      options.body = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
    } else {
      // If body is a string and it starts with JSON syntax ({ or [), send as is.
      // Otherwise, we stringify it to ensure primitives (strings, numbers, booleans)
      // are correctly formatted as valid JSON values for JSON-based APIs like Firebase.
      if (typeof body === 'string' && (body.trim().startsWith('{') || body.trim().startsWith('['))) {
        options.body = body;
      } else {
        options.body = JSON.stringify(body);
      }
      options.headers['Content-Type'] = 'application/json';
    }
  }

  try {
    const response = await fetch(url, options);
    
    // Parse response body if present
    let responseData = null;
    const contentType = response.headers.get('Content-Type');
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      const text = await response.text();
      if (text) {
        try {
          responseData = JSON.parse(text);
        } catch {
          responseData = text;
        }
      }
    }

    // Handle HTTP errors
    if (!response.ok) {
      // Extract Firebase specific error message if available
      let errorMessage = `HTTP error! Status: ${response.status}`;
      if (responseData) {
        if (responseData.error && typeof responseData.error === 'object' && responseData.error.message) {
          errorMessage = responseData.error.message;
        } else if (responseData.error && typeof responseData.error === 'string') {
          errorMessage = responseData.error;
        } else if (responseData.message) {
          errorMessage = responseData.message;
        }
      }
      
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = responseData;
      throw error;
    }

    return responseData;
  } catch (err) {
    // If it's already our structured error, rethrow it
    if (err.status !== undefined) {
      throw err;
    }
    
    // Network or other fetch-related errors
    console.error(`API Call failed on ${method} ${url}:`, err);
    throw new Error(err.message || 'Network connection failure.');
  }
}
