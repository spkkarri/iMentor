// Debounce function: Limits the rate at which a function can fire.

export const debounce = (func, delay) => {
    let timeoutId;
    return function(...args) {
        const context = this;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(context, args), delay);
    };
};

// Throttle function: Ensures a function is called at most once in a specified time period.
export const throttle = (func, limit) => {
    let inThrottle;
    let lastFunc;
    let lastRan;
    return function(...args) {
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            lastRan = Date.now();
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
                if (lastFunc) {
                    lastFunc.apply(context, args); // Call with latest args if throttled
                    lastRan = Date.now();
                }
            }, limit);
        } else {
            lastFunc = func; // Store the latest call
        }
    };
};

// Simple function to format file size
export const formatFileSize = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Function to generate a simple unique ID (for client-side list keys, etc.)
export const generateUniqueId = (prefix = 'id') => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Function to safely get nested property
export const getNestedValue = (obj, path, defaultValue = undefined) => {
    const value = path.split('.').reduce((acc, part) => acc && acc[part], obj);
    return value === undefined ? defaultValue : value;
};

// Basic HTML escape (can be more comprehensive)
export const escapeHtml = (unsafe) => {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&")
         .replace(/</g, "<")
         .replace(/>/g, ">")
         .replace(/"/g, '"')
         .replace(/'/g, "'");
};

// You can add more utility functions here as your project grows.
// For example, date formatting, string manipulation, etc.

// Example: Truncate text
export const truncateText = (text, maxLength = 100) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
};