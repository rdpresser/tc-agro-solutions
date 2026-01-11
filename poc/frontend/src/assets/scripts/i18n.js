// Simple i18n module for frontend toasts and messages
// Default locale: English

let currentLocale = 'en';

const messages = {
  en: {
    // Generic
    'app.saving': 'Saving...',
    'error.generic': 'An unexpected error occurred',
    // HTML5 validation (generic English overrides)
    'validation.generic.required': 'Please fill out this field.',
    'validation.generic.email': 'Please enter a valid email address.',
    'validation.generic.number': 'Please enter a valid number.',
    'validation.generic.min': 'Please select a value greater than or equal to {min}.',
    'validation.generic.max': 'Please select a value less than or equal to {max}.',
    'validation.generic.pattern': 'Please match the requested format.',
    'validation.generic.too_short': 'Please lengthen this text to at least {min} characters.',
    'validation.generic.too_long': 'Please shorten this text to no more than {max} characters.',
    'validation.generic.step': 'Please enter a valid value.',
    'validation.generic.bad_input': 'Please enter a valid value.',

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
    'property.load_failed': 'Failed to load properties',
    'property.save_failed': 'Failed to save property',
    'property.not_found': 'Property not found',
    'property.created_success': 'Property created successfully',
    'property.updated_success': 'Property updated successfully',
    'property.delete_success': 'Property deleted successfully',
    'property.delete_failed': 'Failed to delete property',

    // Plots
    'validation.plot.required_fields': 'Please fill in all required fields',
    'validation.plot.property_required': 'Please select a property',
    'validation.plot.name_required': 'Please enter plot name',
    'validation.plot.crop_required': 'Crop type is required',
    'plot.load_failed': 'Failed to load plots',
    'plot.save_failed': 'Failed to save plot',
    'plot.not_found': 'Plot not found',
    'plot.created_success': 'Plot created successfully!',
    'plot.updated_success': 'Plot updated successfully!',
    'plot.delete_success': 'Plot deleted successfully',
    'plot.delete_failed': 'Failed to delete plot',

    // Dashboard
    'dashboard.load_failed': 'Failed to load dashboard data',

    // Alerts
    'alerts.new': 'New alert: {title}',
    'alerts.load_failed': 'Failed to load alerts',
    'alerts.resolve_success': 'Alert resolved successfully',
    'alerts.resolve_failed': 'Failed to resolve alert',

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

// Override native browser validation messages to English using i18n keys
// Attach to one or more forms via selector or element
function overrideNativeValidation(target = 'form', { showToasts = false } = {}) {
  const forms = typeof target === 'string' ? document.querySelectorAll(target) : [target];
  forms.forEach((form) => {
    if (!form) return;

    // Capture invalid events in the capture phase to run before browser UI
    form.addEventListener(
      'invalid',
      (e) => {
        const el = e.target;
        const v = el.validity;

        let msg = '';
        if (v.valueMissing) {
          msg = t('validation.generic.required');
        } else if (v.typeMismatch) {
          if (el.type === 'email') msg = t('validation.generic.email');
          else if (el.type === 'url') msg = t('validation.generic.pattern');
          else msg = t('validation.generic.bad_input');
        } else if (v.patternMismatch) {
          msg = t('validation.generic.pattern');
        } else if (v.rangeUnderflow) {
          msg = t('validation.generic.min', { min: el.min });
        } else if (v.rangeOverflow) {
          msg = t('validation.generic.max', { max: el.max });
        } else if (v.stepMismatch) {
          msg = t('validation.generic.step');
        } else if (v.tooShort) {
          msg = t('validation.generic.too_short', { min: el.minLength });
        } else if (v.tooLong) {
          msg = t('validation.generic.too_long', { max: el.maxLength });
        } else if (v.badInput) {
          msg = t('validation.generic.bad_input');
        }

        if (msg) {
          el.setCustomValidity(msg);
          if (showToasts) showToast(msg, 'warning');
        }
      },
      true
    );

    // Clear custom validity on input/change so the browser re-evaluates
    form.addEventListener('input', (e) => {
      if (e.target && typeof e.target.setCustomValidity === 'function') {
        e.target.setCustomValidity('');
      }
    });
    form.addEventListener('change', (e) => {
      if (e.target && typeof e.target.setCustomValidity === 'function') {
        e.target.setCustomValidity('');
      }
    });
  });
}

export { setLocale, t, toast, overrideNativeValidation };
