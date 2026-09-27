/**
 * BizBrain — auth.js
 * Authentication: online (PHP/MySQL) + offline (cached session).
 */

const Auth = (() => {
  let _currentUser = null;

  // ── Initialize ───────────────────────────────────────────
  async function init() {
    // Try restoring session from IndexedDB
    const session = await DB.getSession();
    if (session && session.user) {
      _currentUser = session.user;
      if (session.csrf) API.setCsrf(session.csrf);

      // When online, verify the PHP session is still valid
      // so we don't show the app but get 401s on every API call
      if (navigator.onLine) {
        try {
          const res = await API.auth.check();
          if (res.success && res.authenticated) {
            // Session is valid on server — refresh user data
            _currentUser = res.user;
            if (res.csrf_token) API.setCsrf(res.csrf_token);
            return true;
          }
          // Session expired or invalid on server — clear cache
          console.warn('[Auth] Server session expired — clearing cached session');
          _currentUser = null;
          API.setCsrf('');
          await DB.clearSession();
          return false;
        } catch (err) {
          // Network error — trust cached session (offline fallback)
          console.warn('[Auth] Could not verify session online, using cache:', err.message);
          return true;
        }
      }

      return true;
    }
    return false;
  }

  // ── Login ────────────────────────────────────────────────
  async function login(email, password, remember) {
    // Try online authentication first
    if (navigator.onLine) {
      try {
        const res = await API.auth.login(email, password, remember);

        if (res.success) {
          _currentUser = res.user;
          API.setCsrf(res.csrf_token);

          // Cache session in IndexedDB for offline use
          await DB.setSession({
            user:       res.user,
            csrf:       res.csrf_token,
            remember:   remember,
            expires_at: res.expires_at || null,
            cached_at:  new Date().toISOString(),
          });

          // Cache user in users store
          await DB.put('users', { ...res.user, synced: 1 });

          return { success: true, user: res.user };
        }
        return { success: false, message: res.message || 'Invalid credentials' };

      } catch (err) {
        if (err.offline) {
          // Fall through to offline check
          return await offlineLogin(email, password);
        }
        return { success: false, message: err.message || 'Login failed' };
      }
    }

    // Offline login
    return await offlineLogin(email, password);
  }

  // ── Offline Login ────────────────────────────────────────
  async function offlineLogin(email, password) {
    const session = await DB.getSession();

    if (session && session.user && session.user.email === email) {
      // We trust the cached session (password was verified online previously)
      // In production you'd store a hashed password for offline verification
      _currentUser = session.user;
      if (session.csrf) API.setCsrf(session.csrf);
      return { success: true, user: session.user, offline: true };
    }

    // Check demo user for development
    if (email === 'admin@bizbrain.com' && password === 'password') {
      const demoUser = { id: 1, name: 'Admin User', email, role: 'admin', avatar: 'A' };
      _currentUser = demoUser;
      await DB.setSession({ user: demoUser, cached_at: new Date().toISOString() });

      // Try to fetch a CSRF token when online (even in demo mode, for API calls)
      if (navigator.onLine) {
        try {
          const res = await API.auth.check();
          if (res.success && res.csrf_token) {
            API.setCsrf(res.csrf_token);
            await DB.setSession({ user: demoUser, csrf: res.csrf_token, cached_at: new Date().toISOString() });
          }
        } catch (_) {
          // Non-fatal — CSRF will be bootstrapped on the first write request
        }
      }

      return { success: true, user: demoUser, offline: true, demo: true };
    }

    return { success: false, message: 'No cached session. Please connect to the internet to log in.' };
  }

  // ── Logout ───────────────────────────────────────────────
  async function logout() {
    if (navigator.onLine) {
      try { await API.auth.logout(); } catch (_) {}
    }
    _currentUser = null;
    API.setCsrf('');
    await DB.clearSession();
  }

  // ── Check auth ───────────────────────────────────────────
  function isAuthenticated() {
    return !!_currentUser;
  }

  function getUser() {
    return _currentUser;
  }

  // ── Verify token with server ─────────────────────────────
  async function verify() {
    if (!navigator.onLine) return !!_currentUser;
    try {
      const res = await API.auth.check();
      if (res.authenticated) {
        _currentUser = res.user;
        await DB.put('users', { ...res.user, synced: 1 });
        return true;
      }
      return false;
    } catch (_) {
      // offline or error — trust cached session
      return !!_currentUser;
    }
  }

  return { init, login, logout, isAuthenticated, getUser, verify };
})();

// ── UI Handlers ──────────────────────────────────────────────

async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const remember = document.getElementById('remember-me').checked;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('login-btn');

  errEl.style.display = 'none';

  if (!email || !password) {
    showLoginError('Please enter your email and password.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span>Signing in…</span><div class="spinner" style="width:16px;height:16px;border-width:2px"></div>';

  const result = await Auth.login(email, password, remember);

  btn.disabled = false;
  btn.innerHTML = '<span>Sign In</span><i class="fa-solid fa-arrow-right"></i>';

  if (result.success) {
    if (result.offline) showToast('Signed in offline — changes will sync when connected', 'warning');
    showApp(result.user);
  } else {
    showLoginError(result.message || 'Login failed.');
  }
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = 'block';
}

async function handleLogout() {
  if (!confirm('Sign out of BizBrain?')) return;
  await Auth.logout();
  document.getElementById('app-shell').style.display  = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-password').value = '';
}

function togglePassword() {
  const input = document.getElementById('login-password');
  const icon  = document.querySelector('.toggle-pw i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fa-solid fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fa-solid fa-eye';
  }
}
