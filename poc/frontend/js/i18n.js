// Simple i18n module for frontend toasts and messages
// Default locale: English

let currentLocale = 'en';

const messages = {
  en: {
    // Generic
    'app.saving': 'Saving...',
    'error.generic': 'An unexpected error occurred',

    // Auth
    'auth.invalid_credentials': 'Invalid email or password',
    'auth.login_success': 'Login successful!',
    'auth.welcome': 'Welcome, {name}!',
    'auth.logged_out': 'You have been logged out',
    'auth.signing_in': 'Signing in...',
    'validation.auth.fill_fields': 'Please fill in all fields.',
    'validation.auth.email_invalid': 'Please enter a valid email address.',
    'validation.auth.password_required': 'Please enter your password.',

    // Properties
    'validation.property.required_fields': 'Please fill in all required fields',
    'validation.property.name_required': 'Property name is required',
    'validation.property.location_required': 'Location is required',
    'validation.property.area_required': 'Area (hectares) is required',
    'property.load_failed': 'Failed to load property',
    'property.save_failed': 'Failed to save property',
    'property.not_found': 'Property not found',
    'property.created_success': 'Property created successfully',
    'property.updated_success': 'Property updated successfully',

    // Plots
    'validation.plot.property_required': 'Please select a property',
    'validation.plot.name_required': 'Please enter plot name',
    'validation.plot.crop_required': 'Crop type is required',
    'plot.load_failed': 'Failed to load plot',
    'plot.save_failed': 'Failed to save plot',
    'plot.not_found': 'Plot not found',
    'plot.created_success': 'Plot created successfully!',
    'plot.updated_success': 'Plot updated successfully!',

    // Dashboard
    'dashboard.load_failed': 'Failed to load dashboard data',

    // Alerts
    'alerts.new': 'New alert: {title}',

    // Connection
    'connection.connected': 'Connected',
    'connection.reconnecting': 'Reconnecting...',
    'connection.disconnected': 'Disconnected',

    // Real-time
    'realtime.restored': 'Real-time connection restored',
    'realtime.mock_fallback': 'Real-time connection unavailable, using mock data',

    // Sensors
    'sensors.load_failed': 'Failed to load sensors',
    'sensors.updated': 'Sensors updated'
  }
};

function setLocale(locale) {
  currentLocale = messages[locale] ? locale : 'en';
}

function t(key, params = {}) {
  const dict = messages[currentLocale] || messages.en;
  let text = dict[key] || key;
  // naive interpolation: replace {param} with params[param]
  Object.keys(params).forEach((p) => {
    text = text.replace(new RegExp(`\\{${p}\\}`, 'g'), String(params[p]));
  });
  return text;
}

// Toast wrapper
import { showToast } from './utils.js';
function toast(key, type = 'info', params = {}) {
  showToast(t(key, params), type);
}

export { setLocale, t, toast };
