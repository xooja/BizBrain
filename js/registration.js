/**
 * BizBrain — registration.js
 * Multi-step Business Registration Wizard controller.
 * Handles 4 steps (Account → Business → Config → Financials) + Review
 * API calls: check-username, check-email, register
 * Runs ONLINE ONLY (no offline registration).
 */

const Registration = window.Registration = (() => {

  'use strict';

  // ── Constants ──────────────────────────────────────────────
  const API_BASE = '/BizBrain-Pro/php/api/auth';

  const CURRENCIES = {
    PKR: { symbol: '₨', name: 'Pakistani Rupee' },
    USD: { symbol: '$',  name: 'US Dollar' },
    AED: { symbol: 'د.إ', name: 'UAE Dirham' },
    SAR: { symbol: '﷼',  name: 'Saudi Riyal' },
    EUR: { symbol: '€',  name: 'Euro' },
    GBP: { symbol: '£',  name: 'British Pound' },
    INR: { symbol: '₹',  name: 'Indian Rupee' },
    CAD: { symbol: 'C$', name: 'Canadian Dollar' },
    AUD: { symbol: 'A$', name: 'Australian Dollar' },
    JPY: { symbol: '¥',  name: 'Japanese Yen' },
    CNY: { symbol: '¥',  name: 'Chinese Yuan' },
  };

  const TIMEZONES = [
    'UTC', 'Asia/Karachi', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Kolkata',
    'Asia/Dhaka', 'Asia/Kabul', 'Asia/Baghdad', 'Asia/Tehran',
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
    'Africa/Cairo', 'Africa/Lagos', 'Africa/Nairobi',
    'Australia/Sydney', 'Australia/Melbourne',
    'Pacific/Auckland', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore',
  ];

  const DATE_FORMATS = [
    { value: 'Y-m-d',     label: 'YYYY-MM-DD (2025-06-06)' },
    { value: 'd/m/Y',     label: 'DD/MM/YYYY (06/06/2025)' },
    { value: 'm/d/Y',     label: 'MM/DD/YYYY (06/06/2025)' },
    { value: 'd-m-Y',     label: 'DD-MM-YYYY (06-06-2025)' },
    { value: 'd.m.Y',     label: 'DD.MM.YYYY (06.06.2025)' },
  ];

  const BUSINESS_TYPES = [
    { category: 'Retail & Trading', items: [
      'Retail Store', 'Grocery Store', 'Super Market', 'General Store',
      'Electronics Store', 'Mobile Shop', 'Garments Store', 'Shoes Store',
      'Cosmetics Store', 'Pharmacy / Medical Store', 'Book Store', 'Hardware Store',
    ]},
    { category: '📦 Wholesale & Distribution', items: [
      'Wholesale Business', 'Distributor', 'Importer', 'Exporter', 'Trading Company',
    ]},
    { category: '🏭 Manufacturing', items: [
      'Manufacturer', 'Factory', 'Food Production', 'Textile Manufacturing',
      'Furniture Manufacturing', 'Other Manufacturing',
    ]},
    { category: '🍔 Food & Hospitality', items: [
      'Restaurant', 'Fast Food', 'Cafe', 'Bakery', 'Catering Service', 'Hotel / Guest House',
    ]},
    { category: '🔧 Service Businesses', items: [
      'Service Provider', 'Repair Shop', 'Auto Workshop', 'Digital Agency',
      'Software House', 'IT Services', 'Marketing Agency', 'Consultancy', 'Accounting Firm',
    ]},
    { category: '🚚 Logistics', items: [
      'Transport Company', 'Courier Service', 'Logistics Company',
    ]},
    { category: '🏗️ Construction & Real Estate', items: [
      'Construction Company', 'Real Estate Agency', 'Property Dealer',
    ]},
    { category: '🌾 Agriculture & Livestock', items: [
      'Agriculture Business', 'Dairy Farm', 'Poultry Farm', 'Livestock Farm',
      'Seed & Fertilizer Business',
    ]},
    { category: '🏥 Healthcare', items: [
      'Clinic', 'Hospital', 'Medical Laboratory',
    ]},
    { category: '🎓 Education', items: [
      'School', 'College', 'Academy', 'Training Institute',
    ]},
    { category: '🕌 Non-Profit & Others', items: [
      'NGO / Non-Profit', 'Government Organization', 'Other',
    ]},
  ];


  // ── State ──────────────────────────────────────────────────
  let currentStep = 1;
  let formData = {};
  let validationState = {};
  let isSubmitting = false;
  let checkTimers = {};

  const totalSteps = 5; // 4 info steps + 1 review step

  // ── DOM Cache ──────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const qs = (sel, ctx) => (ctx || document).querySelector(sel);
  const qsa = (sel, ctx) => (ctx || document).querySelectorAll(sel);

  // ── Init ───────────────────────────────────────────────────
  function init() {
    if (!document.querySelector('.reg-screen')) return;
    setupTheme();
    populateStaticFields();
    showStep(1);
    bindEvents();
    bindPasswordStrength();
    bindFileUpload();
    bindCurrencySelect();
  }

  function setupTheme() {
    const saved = localStorage.getItem('bizbrain-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
  }

  function populateStaticFields() {
    // Currency dropdown — NOTE: IDs are prefixed with 's3_'
    const currSel = $('s3_currency');
    if (currSel) {
      Object.entries(CURRENCIES).forEach(([code, info]) => {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = `${code} — ${info.symbol} (${info.name})`;
        if (code === 'USD') opt.selected = true;
        currSel.appendChild(opt);
      });
    }

    // Timezone dropdown
    const tzSel = $('s3_timezone');
    if (tzSel) {
      const detected = Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || 'UTC';
      TIMEZONES.forEach((tz) => {
        const opt = document.createElement('option');
        opt.value = tz;
        opt.textContent = tz;
        if (tz === detected) opt.selected = true;
        tzSel.appendChild(opt);
      });
    }

    // Date format dropdown
    const dfSel = $('s3_date_format');
    if (dfSel) {
      DATE_FORMATS.forEach((df) => {
        const opt = document.createElement('option');
        opt.value = df.value;
        opt.textContent = df.label;
        if (df.value === 'Y-m-d') opt.selected = true;
        dfSel.appendChild(opt);
      });
    }

    // Business types — searchable custom dropdown built by attachSearchableSelect()
    attachSearchableSelect('s2_business_type_wrap', 's2_business_type', BUSINESS_TYPES);
  }

  // ── Step Navigation ────────────────────────────────────────
  function showStep(step) {
    // Hide all steps
    qsa('.reg-step').forEach((el) => (el.style.display = 'none'));

    const target = $(`step-${step}`);
    if (target) {
      target.style.display = 'block';
      target.style.animation = 'none';
      void target.offsetHeight;
      target.style.animation = 'fadeIn 0.35s ease';
    }

    // Update stepper
    qsa('.step-indicator').forEach((ind, i) => {
      const num = i + 1;
      ind.classList.remove('active', 'completed');
      const circle = ind.querySelector('.step-circle');
      if (num === step) {
        ind.classList.add('active');
        circle.innerHTML = `<span class="step-num">${num}</span>`;
      } else if (num < step) {
        ind.classList.add('completed');
        circle.innerHTML = '<i class="fa-solid fa-check step-icon"></i>';
      } else {
        circle.innerHTML = `<span class="step-num">${num}</span>`;
      }
    });

    // Update connectors
    qsa('.step-connector').forEach((conn, i) => {
      conn.classList.toggle('done', i + 1 < step);
    });

    // Update button text
    const nextBtn = $('btn-next');
    const prevBtn = $('btn-prev');
    const skipBtn = $('btn-skip');

    if (nextBtn) {
      if (step === totalSteps) {
        nextBtn.innerHTML = '<span>Create Business Account</span> <i class="fa-solid fa-rocket"></i>';
      } else if (step === 4) {
        nextBtn.innerHTML = '<span>Review Information</span> <i class="fa-solid fa-file-lines"></i>';
      } else {
        nextBtn.innerHTML = '<span>Continue</span> <i class="fa-solid fa-arrow-right"></i>';
      }
    }

    if (prevBtn) {
      prevBtn.style.display = step === 1 ? 'none' : 'inline-flex';
    }

    if (skipBtn) {
      skipBtn.style.display = step === 4 ? 'inline-block' : 'none';
    }

    // Restore field values from formData when navigating back
    restoreStepFields(step);

    currentStep = step;
  }

  function nextStep() {
    if (isSubmitting) return;

    if (currentStep === totalSteps) {
      submitRegistration();
      return;
    }

    if (currentStep === 4) {
      if (validateStep(currentStep)) {
        buildReview();
        showStep(5);
      }
      return;
    }

    if (validateStep(currentStep)) {
      collectStepData(currentStep);
      showStep(currentStep + 1);
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      collectStepData(currentStep);
      showStep(currentStep - 1);
    }
  }

  function skipStep() {
    if (currentStep === 4) {
      collectStepData(4);
      buildReview();
      showStep(5);
    }
  }

  // ── Data Collection ────────────────────────────────────────
  function collectStepData(step) {
    const prefix = step === 1 ? 's1' : step === 2 ? 's2' : step === 3 ? 's3' : 's4';
    const inputs = qsa(`#step-${step} [name^="${prefix}"]`);
    inputs.forEach((inp) => {
      const key = inp.name.replace(`${prefix}_`, '');
      if (inp.type === 'checkbox') {
        formData[key] = inp.checked;
      } else if (inp.type === 'file') {
        // File handled separately via preview
      } else {
        formData[key] = inp.value;
      }
    });
  }

  // ── Restore Step Fields from formData ──────────────────────
  function restoreStepFields(step) {
    const prefix = step === 1 ? 's1' : step === 2 ? 's2' : step === 3 ? 's3' : 's4';
    const inputs = qsa(`#step-${step} [name^="${prefix}"]`);
    inputs.forEach((inp) => {
      const key = inp.name.replace(`${prefix}_`, '');
      if (key in formData) {
        if (inp.type === 'checkbox') {
          inp.checked = formData[key];
        } else if (inp.type !== 'file') {
          inp.value = formData[key];
        }
      }
    });
  }

  // ── Validation ─────────────────────────────────────────────
  function validateStep(step) {
    let valid = true;
    const rules = getValidationRules(step);

    rules.forEach((rule) => {
      const el = $(rule.id);
      if (!el) return;

      const val = el.value.trim();
      const group = el.closest('.form-group');
      let error = '';

      // Required check
      if (rule.required && !val) {
        error = rule.requiredMsg || 'This field is required';
      } else if (val) {
        // Pattern check
        if (rule.pattern && !rule.pattern.test(val)) {
          error = rule.patternMsg || 'Invalid format';
        }
        // Custom validators
        if (rule.validate) {
          const result = rule.validate(val, el);
          if (result) error = result;
        }
      }

      // Show/hide error
      if (group) {
        const errEl = group.querySelector('.form-error-msg');
        if (error) {
          group.classList.add('has-error');
          if (errEl) errEl.textContent = error;
          valid = false;
        } else {
          group.classList.remove('has-error');
        }
      }
    });

    return valid;
  }

  function getValidationRules(step) {
    const rules = {
      1: [
        { id: 's1_username', required: true, requiredMsg: 'Username is required',
          pattern: /^[a-zA-Z0-9_]{3,}$/, patternMsg: 'Min 3 chars, letters, numbers, underscores only' },
        { id: 's1_email', required: true, requiredMsg: 'Email is required',
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMsg: 'Invalid email address' },
        { id: 's1_phone', required: false,
          pattern: /^[\+\d\s\-\(\)]{7,20}$/, patternMsg: 'Invalid phone number' },
        { id: 's1_password', required: true, requiredMsg: 'Password is required',
          validate: (v) => v.length < 6 ? 'Password must be at least 6 characters' : '' },
        { id: 's1_confirm_password', required: true, requiredMsg: 'Please confirm password',
          validate: (v) => v !== $('s1_password').value ? 'Passwords do not match' : '' },
        { id: 's1_pin', required: true, requiredMsg: 'PIN is required',
          pattern: /^\d{4}$/, patternMsg: 'PIN must be exactly 4 digits' },
        { id: 's1_confirm_pin', required: true, requiredMsg: 'Please confirm PIN',
          validate: (v) => v !== $('s1_pin').value ? 'PINs do not match' : '' },
      ],
      2: [
        { id: 's2_business_name', required: true, requiredMsg: 'Business name is required' },
        { id: 's2_business_type', required: true, requiredMsg: 'Please select a business type' },
        { id: 's2_owner_name', required: true, requiredMsg: 'Owner name is required' },
      ],
      3: [
        { id: 's3_country', required: true, requiredMsg: 'Country is required' },
        { id: 's3_state', required: true, requiredMsg: 'State is required' },
        { id: 's3_city', required: true, requiredMsg: 'City is required' },
        { id: 's3_address', required: true, requiredMsg: 'Address is required' },
        { id: 's3_currency', required: true, requiredMsg: 'Currency is required' },
        { id: 's3_timezone', required: true, requiredMsg: 'Timezone is required' },
      ],
      4: [
        { id: 's4_opening_date', required: true, requiredMsg: 'Opening date is required' },
        // All others optional
      ],
    };

    return rules[step] || [];
  }

  // ── Real-time Validation ───────────────────────────────────
  function bindRealtimeValidation(id, validator) {
    const el = $(id);
    if (!el) return;

    el.addEventListener('blur', () => {
      validateSingleField(id, validator);
    });

    el.addEventListener('input', () => {
      const group = el.closest('.form-group');
      if (group && group.classList.contains('has-error')) {
        validateSingleField(id, validator);
      }
    });
  }

  function validateSingleField(id, customValidator) {
    const el = $(id);
    if (!el) return true;
    const val = el.value.trim();
    const group = el.closest('.form-group');

    // Clear async check status
    const statusEl = group?.querySelector('.field-status');
    if (statusEl) {
      statusEl.className = 'field-status';
      statusEl.textContent = '';
    }

    let error = '';
    const rules = getAllRules().filter((r) => r.id === id);

    for (const rule of rules) {
      if (rule.required && !val) {
        error = rule.requiredMsg || 'Required';
        break;
      }
      if (val && rule.pattern && !rule.pattern.test(val)) {
        error = rule.patternMsg || 'Invalid';
        break;
      }
      if (val && rule.validate) {
        const r = rule.validate(val, el);
        if (r) { error = r; break; }
      }
    }

    // Custom validator
    if (!error && customValidator) {
      error = customValidator(val, el) || '';
    }

    if (group) {
      const errEl = group.querySelector('.form-error-msg');
      if (error) {
        group.classList.add('has-error');
        if (errEl) errEl.textContent = error;
        if (el.classList) { el.classList.remove('success'); el.classList.add('error'); }
      } else {
        group.classList.remove('has-error');
        if (el.classList) { el.classList.remove('error'); if (val) el.classList.add('success'); }
      }
    }

    return !error;
  }

  function getAllRules() {
    return [].concat(...[1,2,3,4].map((s) => getValidationRules(s)));
  }

  // ── Async Availability Checks ──────────────────────────────
  function checkUsernameAvailability() {
    const el = $('s1_username');
    if (!el) return;
    const val = el.value.trim();
    const group = el.closest('.form-group');
    const statusEl = group?.querySelector('.field-status');

    clearTimeout(checkTimers.username);

    if (val.length < 3) {
      if (statusEl) { statusEl.className = 'field-status'; statusEl.textContent = ''; }
      return;
    }

    checkTimers.username = setTimeout(async () => {
      if (statusEl) { statusEl.className = 'field-status checking'; statusEl.innerHTML = '<i class="fa-solid fa-spinner"></i>'; }
      try {
        const res = await fetch(`${API_BASE}/check-username.php`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username: val }),
        });
        const data = await res.json();
        if (statusEl) {
          if (data?.success && data?.data?.available) {
            statusEl.className = 'field-status valid';
            statusEl.innerHTML = '<i class="fa-solid fa-check-circle"></i>';
            el.classList.add('success');
          } else {
            statusEl.className = 'field-status invalid';
            statusEl.innerHTML = '<i class="fa-solid fa-times-circle"></i>';
            el.classList.remove('success');
          }
        }
      } catch {
        if (statusEl) { statusEl.className = 'field-status'; statusEl.textContent = ''; }
      }
    }, 600);
  }

  function checkEmailAvailability() {
    const el = $('s1_email');
    if (!el) return;
    const val = el.value.trim();
    const group = el.closest('.form-group');
    const statusEl = group?.querySelector('.field-status');

    clearTimeout(checkTimers.email);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      if (statusEl) { statusEl.className = 'field-status'; statusEl.textContent = ''; }
      return;
    }

    checkTimers.email = setTimeout(async () => {
      if (statusEl) { statusEl.className = 'field-status checking'; statusEl.innerHTML = '<i class="fa-solid fa-spinner"></i>'; }
      try {
        const res = await fetch(`${API_BASE}/check-email.php`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email: val }),
        });
        const data = await res.json();
        if (statusEl) {
          if (data?.success && data?.data?.available) {
            statusEl.className = 'field-status valid';
            statusEl.innerHTML = '<i class="fa-solid fa-check-circle"></i>';
            el.classList.add('success');
          } else {
            statusEl.className = 'field-status invalid';
            statusEl.innerHTML = '<i class="fa-solid fa-times-circle"></i>';
            el.classList.remove('success');
          }
        }
      } catch {
        if (statusEl) { statusEl.className = 'field-status'; statusEl.textContent = ''; }
      }
    }, 600);
  }

  // ── Password Strength ──────────────────────────────────────
  function bindPasswordStrength() {
    const pw = $('s1_password');
    if (!pw) return;

    pw.addEventListener('input', () => {
      const val = pw.value;
      const bars = qsa('.pw-strength-bar');
      const text = $('pw-strength-text');
      let score = 0;

      if (val.length >= 6) score++;
      if (val.length >= 10) score++;
      if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
      if (/\d/.test(val) && /[^a-zA-Z0-9]/.test(val)) score++;

      const labels = ['', 'Weak', 'Medium', 'Good', 'Strong'];
      const classes = ['', 'weak', 'medium', 'good', 'strong'];

      bars.forEach((bar, i) => {
        bar.className = 'pw-strength-bar' + (i < score ? ` fill-${score}` : '');
      });

      if (text) {
        text.textContent = score > 0 ? labels[score] : '';
        text.className = 'pw-strength-text' + (score > 0 ? ` ${classes[score]}` : '');
      }
    });
  }

  // ── File Upload ────────────────────────────────────────────
  function bindFileUpload() {
    const fileInput = $('s2_logo');
    if (!fileInput) return;

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      const preview = $('logo-preview');
      if (!preview) return;

      if (file) {
        // Validate size (2MB max)
        if (file.size > 2 * 1024 * 1024) {
          showAlert('Logo must be smaller than 2MB');
          fileInput.value = '';
          preview.style.display = 'none';
          return;
        }
        // Validate type
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          showAlert('Logo must be JPG, PNG, or WebP');
          fileInput.value = '';
          preview.style.display = 'none';
          return;
        }
        preview.style.display = 'flex';
        preview.querySelector('.file-name').textContent = file.name;
        // Store as data URL for now (will be sent as base64 or referenced)
        const reader = new FileReader();
        reader.onload = (ev) => { formData.logo_data = ev.target.result; };
        reader.readAsDataURL(file);
      } else {
        preview.style.display = 'none';
        delete formData.logo_data;
      }
    });
  }

  function removeLogo() {
    const fileInput = $('s2_logo');
    const preview = $('logo-preview');
    if (fileInput) fileInput.value = '';
    if (preview) preview.style.display = 'none';
    delete formData.logo_data;
  }

  // ── Currency Select (auto symbol) ──────────────────────────
  function bindCurrencySelect() {
    const sel = $('s3_currency');
    if (!sel) return;

    sel.addEventListener('change', () => {
      const code = sel.value;
      const info = CURRENCIES[code];
      const symbolField = $('s3_currency_symbol');
      if (symbolField && info) {
        symbolField.value = info.symbol;
      }
    });
  }


  // ── Review Builder ─────────────────────────────────────────
  function buildReview() {
    collectStepData(1);
    collectStepData(2);
    collectStepData(3);
    collectStepData(4);

    const sections = [
      {
        title: '<i class="fa-solid fa-user-shield"></i> Account & Security',
        items: [
          { label: 'Username', key: 'username' },
          { label: 'Email', key: 'email' },
          { label: 'Phone', key: 'phone', optional: true },
          { label: 'Password', key: '__password_placeholder__' },
          { label: 'PIN', key: '__pin_placeholder__' },
        ],
      },
      {
        title: '<i class="fa-solid fa-building"></i> Business Information',
        items: [
          { label: 'Business Name', key: 'business_name' },
          { label: 'Business Type', key: 'business_type' },
          { label: 'Owner Name', key: 'owner_name' },
          { label: 'Reg Number', key: 'reg_number', optional: true },
          { label: 'Tax Number', key: 'tax_number', optional: true },
          { label: 'Description', key: 'description', optional: true },
        ],
      },
      {
        title: '<i class="fa-solid fa-globe"></i> Location & Settings',
        items: [
          { label: 'Country', key: 'country' },
          { label: 'State', key: 'state' },
          { label: 'City', key: 'city' },
          { label: 'Address', key: 'address' },
          { label: 'Currency', key: 'currency' },
          { label: 'Timezone', key: 'timezone' },
          { label: 'Date Format', key: 'date_format' },
          { label: 'Tax System', key: 'tax_enabled' },
          { label: 'Tax %', key: 'tax_percent', optional: true },
        ],
      },
      {
        title: '<i class="fa-solid fa-chart-pie"></i> Financial Setup',
        items: [
          { label: 'Opening Date', key: 'opening_date' },
          { label: 'Cash in Hand', key: 'cash_in_hand', optional: true },
          { label: 'Bank Balance', key: 'bank_balance', optional: true },
          { label: 'Opening Capital', key: 'opening_capital', optional: true },
          { label: 'Avg Monthly Sales', key: 'avg_monthly_sales', optional: true },
          { label: 'Avg Monthly Expenses', key: 'avg_monthly_expenses', optional: true },
          { label: 'Assets Value', key: 'total_assets_value', optional: true },
          { label: 'Equipment Value', key: 'equipment_value', optional: true },
          { label: 'Inventory Value', key: 'inventory_value', optional: true },
        ],
      },
    ];

    const container = $('review-content');
    if (!container) return;
    container.innerHTML = '<div class="review-grid"></div>';
    const grid = container.querySelector('.review-grid');

    sections.forEach((section) => {
      const card = document.createElement('div');
      card.className = 'review-card review-card-full';

      const title = document.createElement('div');
      title.className = 'review-card-title';
      title.innerHTML = section.title;
      card.appendChild(title);

      section.items.forEach((item) => {
        let value = formData[item.key];

        if (item.key === '__password_placeholder__') {
          value = '••••••••';
        } else if (item.key === '__pin_placeholder__') {
          value = '••••';
        } else if (item.key === 'tax_enabled') {
          value = value ? 'Yes (Enabled)' : 'No (Disabled)';
        } else if (item.key === 'currency') {
          const info = CURRENCIES[value];
          if (info) value = `${value} (${info.symbol})`;
        }

        const displayVal = (value && value !== '') ? value : (item.optional ? '—' : '<span class="na">Not provided</span>');

        const row = document.createElement('div');
        row.className = 'review-item';
        row.innerHTML = `
          <span class="review-label">${item.label}</span>
          <span class="review-value ${!value || value === '' ? 'empty' : ''}">${displayVal}</span>
        `;
        card.appendChild(row);
      });

      grid.appendChild(card);
    });
  }

  // ── Submission ─────────────────────────────────────────────
  async function submitRegistration() {
    const termsAccepted = $('terms_accepted')?.checked;
    const privacyAccepted = $('privacy_accepted')?.checked;

    if (!termsAccepted || !privacyAccepted) {
      showAlert('Please accept the Terms & Conditions and Privacy Policy');
      return;
    }

    if (isSubmitting) return;
    isSubmitting = true;

    const btn = $('btn-next');
    if (btn) btn.classList.add('loading');

    hideAlert();

    // Build payload
    collectStepData(1);
    collectStepData(2);
    collectStepData(3);
    collectStepData(4);

    // Include logo data if uploaded
    const logoData = formData.logo_data || '';

    const payload = {
      username:         formData.username,
      email:            formData.email,
      phone:            formData.phone || '',
      password:         formData.password,
      pin:              formData.pin,
      logo_data:        logoData,
      owner_name:       formData.owner_name,
      business_name:    formData.business_name,
      business_type:    formData.business_type,
      reg_number:       formData.reg_number || '',
      tax_number:       formData.tax_number || '',
      description:      formData.description || '',
      country:          formData.country,
      state:            formData.state,
      city:             formData.city,
      address:          formData.address,
      currency:         formData.currency || 'USD',
      currency_symbol:  formData.currency_symbol || '$',
      timezone:         formData.timezone || 'UTC',
      date_format:      formData.date_format || 'Y-m-d',
      tax_enabled:      formData.tax_enabled || false,
      tax_percent:      parseFloat(formData.tax_percent) || 0,
      opening_date:     formData.opening_date || null,
      cash_in_hand:     parseFloat(formData.cash_in_hand) || 0,
      bank_balance:     parseFloat(formData.bank_balance) || 0,
      opening_capital:  parseFloat(formData.opening_capital) || 0,
      avg_monthly_sales:    parseFloat(formData.avg_monthly_sales) || 0,
      avg_monthly_expenses: parseFloat(formData.avg_monthly_expenses) || 0,
      total_assets_value:   parseFloat(formData.total_assets_value) || 0,
      equipment_value:      parseFloat(formData.equipment_value) || 0,
      furniture_value:      parseFloat(formData.furniture_value) || 0,
      vehicle_value:        parseFloat(formData.vehicle_value) || 0,
      product_count:        parseInt(formData.product_count) || 0,
      inventory_value:      parseFloat(formData.inventory_value) || 0,
    };

    try {
      const res = await fetch(`${API_BASE}/register.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        showSuccess(data);
      } else {
        showAlert(data.message || 'Registration failed. Please try again.');
        if (btn) btn.classList.remove('loading');
        isSubmitting = false;
      }
    } catch (err) {
      showAlert('Network error. Please check your connection and try again.');
      if (btn) btn.classList.remove('loading');
      isSubmitting = false;
    }
  }

  // ── Success ────────────────────────────────────────────────
  function showSuccess(data) {
    const overlay = $('reg-success');
    if (!overlay) return;
    overlay.classList.add('show');

    const nameEl = $('success-name');
    if (nameEl) nameEl.textContent = data?.data?.user?.name || formData.owner_name || 'User';

    const bizEl = $('success-business');
    if (bizEl) bizEl.textContent = data?.data?.business_name || formData.business_name;

    // Redirect after delay
    setTimeout(() => {
      window.location.href = '/BizBrain-Pro/';
    }, 3000);
  }

  // ── Alert ──────────────────────────────────────────────────
  function showAlert(msg) {
    const el = $('reg-alert');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show', 'error');
    el.classList.remove('success');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function hideAlert() {
    const el = $('reg-alert');
    if (!el) return;
    el.classList.remove('show');
  }

  // ── Events ─────────────────────────────────────────────────
  function bindEvents() {
    // Navigation
    const nextBtn = $('btn-next');
    const prevBtn = $('btn-prev');
    const skipBtn = $('btn-skip');

    if (nextBtn) nextBtn.addEventListener('click', nextStep);
    if (prevBtn) prevBtn.addEventListener('click', prevStep);
    if (skipBtn) skipBtn.addEventListener('click', skipStep);

    // Enter key to advance
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const active = document.activeElement;
        // Don't submit on textareas
        if (active?.tagName === 'TEXTAREA') return;
        e.preventDefault();
        nextStep();
      }
    });

    // Real-time validation on Step 1
    bindRealtimeValidation('s1_username');
    bindRealtimeValidation('s1_email');
    bindRealtimeValidation('s1_phone');
    bindRealtimeValidation('s1_password');
    bindRealtimeValidation('s1_confirm_password');
    bindRealtimeValidation('s1_pin');
    bindRealtimeValidation('s1_confirm_pin');

    // Username availability check
    const uname = $('s1_username');
    if (uname) {
      uname.addEventListener('blur', checkUsernameAvailability);
      uname.addEventListener('input', () => {
        const group = uname.closest('.form-group');
        const statusEl = group?.querySelector('.field-status');
        if (statusEl) { statusEl.className = 'field-status'; statusEl.textContent = ''; }
        // If user starts typing again, clear success
        uname.classList.remove('success');
      });
    }

    // Email availability check
    const email = $('s1_email');
    if (email) {
      email.addEventListener('blur', checkEmailAvailability);
      email.addEventListener('input', () => {
        const group = email.closest('.form-group');
        const statusEl = group?.querySelector('.field-status');
        if (statusEl) { statusEl.className = 'field-status'; statusEl.textContent = ''; }
        email.classList.remove('success');
      });
    }
  }

  // ── Searchable Select Builder ──────────────────────────────
  /**
   * Replaces a container element with a custom searchable dropdown.
   * @param {string} containerId - ID of the wrapper div
   * @param {string} hiddenInputId - ID of the hidden input storing the value
   * @param {Array} groups - Array of { category: string, items: string[] }
   */
  function attachSearchableSelect(containerId, hiddenInputId, groups) {
    const container = $(containerId);
    if (!container) return;

    // Clear container
    container.innerHTML = '';

    // Create the hidden input that holds the actual value
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.id = hiddenInputId;
    hidden.name = hiddenInputId;
    hidden.value = '';
    container.appendChild(hidden);

    // Trigger element (what user sees)
    const trigger = document.createElement('div');
    trigger.className = 'srch-trigger';
    trigger.tabIndex = 0;
    trigger.innerHTML = '<span class="srch-placeholder">Select business type...</span><i class="fa-solid fa-chevron-down srch-arrow"></i>';
    container.appendChild(trigger);

    // Search input
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'srch-input';
    searchInput.placeholder = 'Search business types...';
    container.appendChild(searchInput);

    // Dropdown list
    const dropdown = document.createElement('div');
    dropdown.className = 'srch-dropdown';
    container.appendChild(dropdown);

    // Build list items
    function renderItems(filter) {
      dropdown.innerHTML = '';
      const lower = (filter || '').toLowerCase();
      let hasVisible = false;

      groups.forEach((group) => {
        const filteredItems = group.items.filter((item) =>
          !lower || item.toLowerCase().includes(lower)
        );
        if (filteredItems.length === 0) return;
        hasVisible = true;

        // Group header
        const header = document.createElement('div');
        header.className = 'srch-group-header';
        header.textContent = group.category;
        dropdown.appendChild(header);

        filteredItems.forEach((item) => {
          const opt = document.createElement('div');
          opt.className = 'srch-option';
          opt.textContent = item;
          opt.dataset.value = item;

          // Highlight matching text
          if (lower) {
            const idx = item.toLowerCase().indexOf(lower);
            if (idx >= 0) {
              const before = item.slice(0, idx);
              const match = item.slice(idx, idx + lower.length);
              const after = item.slice(idx + lower.length);
              opt.innerHTML = `${before}<strong>${match}</strong>${after}`;
            }
          }

          opt.addEventListener('click', (e) => {
            e.stopPropagation();
            selectItem(item);
          });

          dropdown.appendChild(opt);
        });
      });

      if (!hasVisible) {
        const noRes = document.createElement('div');
        noRes.className = 'srch-no-result';
        noRes.textContent = 'No matching business types found';
        dropdown.appendChild(noRes);
      }
    }

    function selectItem(val) {
      hidden.value = val;
      trigger.querySelector('.srch-placeholder').textContent = val;
      trigger.querySelector('.srch-placeholder').classList.add('selected');
      closeDropdown();
      // Trigger change event for validation
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function openDropdown() {
      dropdown.classList.add('open');
      searchInput.style.display = 'block';
      searchInput.focus();
      searchInput.value = '';
      renderItems('');
      container.classList.add('open');
    }

    function closeDropdown() {
      dropdown.classList.remove('open');
      searchInput.style.display = 'none';
      container.classList.remove('open');
    }

    function toggleDropdown(e) {
      e.stopPropagation();
      if (dropdown.classList.contains('open')) {
        closeDropdown();
      } else {
        openDropdown();
      }
    }

    // Events
    trigger.addEventListener('click', toggleDropdown);
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleDropdown(e);
      }
      if (e.key === 'Escape') closeDropdown();
    });

    searchInput.addEventListener('input', () => renderItems(searchInput.value));
    searchInput.addEventListener('blur', () => setTimeout(closeDropdown, 200));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDropdown();
      if (e.key === 'Enter') {
        const first = qs('.srch-option', dropdown);
        if (first) selectItem(first.dataset.value);
      }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) closeDropdown();
    });

    // Initial render
    renderItems('');
  }

  // ── API ────────────────────────────────────────────────────
  return { init, removeLogo };

})();

// ── Auto-init ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => Registration.init());
