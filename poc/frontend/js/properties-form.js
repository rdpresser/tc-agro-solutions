/**
 * Properties Form Page - TC Agro Solutions
 * Entry point script for property create/edit
 */

import { $, showToast, getQueryParam } from './utils.js';
import { requireAuth } from './auth.js';
import { getProperty, createProperty, updateProperty } from './api.js';
import { initProtectedPage } from './common.js';

// ============================================
// Page Initialization
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Verify authentication
  if (!requireAuth()) return;
  
  // Initialize protected page (sidebar, user display)
  initProtectedPage();
  
  // Check if editing existing property
  const id = getQueryParam('id');
  if (id) {
    await loadProperty(id);
  }
  
  // Setup form handler
  setupFormHandler();
});

// ============================================
// Load Property for Edit
// ============================================

async function loadProperty(id) {
  try {
    const property = await getProperty(id);
    if (!property) {
      showToast('Property not found', 'danger');
      window.location.href = 'properties.html';
      return;
    }
    
    // Update page titles
    const pageTitle = document.getElementById('pageTitle');
    const formTitle = document.getElementById('formTitle');
    const breadcrumbTitle = document.getElementById('breadcrumbTitle');
    const submitBtn = document.getElementById('submitBtn');
    
    if (pageTitle) pageTitle.textContent = 'Edit Property';
    if (formTitle) formTitle.textContent = 'Edit Property';
    if (breadcrumbTitle) breadcrumbTitle.textContent = property.name;
    if (submitBtn) submitBtn.innerHTML = '💾 Update Property';
    
    // Populate form
    populateForm(property);
    
  } catch (error) {
    console.error('Failed to load property:', error);
    showToast('Failed to load property', 'danger');
  }
}

// ============================================
// Populate Form
// ============================================

function populateForm(property) {
  const fields = {
    propertyId: property.id,
    name: property.name || '',
    location: property.location || '',
    areaHectares: property.areaHectares || '',
    latitude: property.latitude || '',
    longitude: property.longitude || '',
    status: property.status || 'active',
    notes: property.notes || ''
  };
  
  Object.entries(fields).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.value = value;
  });
}

// ============================================
// Form Submit Handler
// ============================================

function setupFormHandler() {
  const form = document.getElementById('propertyForm');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('propertyId')?.value;
    const submitBtn = document.getElementById('submitBtn');
    
    const data = {
      name: document.getElementById('name')?.value,
      location: document.getElementById('location')?.value,
      areaHectares: parseFloat(document.getElementById('areaHectares')?.value) || 0,
      latitude: document.getElementById('latitude')?.value 
        ? parseFloat(document.getElementById('latitude').value) 
        : null,
      longitude: document.getElementById('longitude')?.value 
        ? parseFloat(document.getElementById('longitude').value) 
        : null,
      status: document.getElementById('status')?.value || 'active',
      notes: document.getElementById('notes')?.value || ''
    };
    
    // Validation
    if (!data.name || !data.location || !data.areaHectares) {
      showToast('Please fill in all required fields', 'warning');
      return;
    }
    
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Salvando...';
      }
      
      if (id) {
        // Update existing
        await updateProperty(id, data);
        showToast('Property updated successfully', 'success');
      } else {
        // Create new
        await createProperty(data);
        showToast('Property created successfully', 'success');
      }
      
      // Redirect to list
      setTimeout(() => {
        window.location.href = 'properties.html';
      }, 1000);
      
    } catch (error) {
      console.error('Failed to save property:', error);
      showToast('Failed to save property', 'danger');
      
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '💾 Save Property';
      }
    }
  });
}
