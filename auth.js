/**
 * COSMIX — AUTH MANAGER
 * Integrates Supabase Auth with a transparent localStorage fallback.
 */
import { createClient } from '@supabase/supabase-js';

let rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
let sanitizedUrl = rawUrl.trim();
if (sanitizedUrl.endsWith('/rest/v1/')) {
  sanitizedUrl = sanitizedUrl.slice(0, -9);
}
if (sanitizedUrl.endsWith('/')) {
  sanitizedUrl = sanitizedUrl.slice(0, -1);
}

const supabaseUrl = sanitizedUrl;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if Supabase keys are present and not mock placeholders
export const isSupabaseConfigured = !!(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('YOUR_SUPABASE')
);

// Initialize Supabase client
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const SESSION_KEY = 'cosmix_session';
const USERS_KEY = 'cosmix_users';

/**
 * Retrieve the active user session.
 * Supports async resolution for Supabase, sync for fallback.
 * @returns {Promise<Object|null>} User session or null
 */
export async function getUser() {
  if (isSupabaseConfigured) {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) return null;
      
      const user = session.user;
      return {
        name: user.user_metadata?.full_name || user.email.split('@')[0],
        email: user.email,
        initials: _initials(user.user_metadata?.full_name || user.email)
      };
    } catch (err) {
      console.error('Supabase session retrieval error:', err);
      return null;
    }
  }

  // Fallback to local session
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Log in a user.
 * @returns {Promise<{ success: boolean, user?: Object, error?: string }>}
 */
export async function loginUser(email, password) {
  if (!email || !password) {
    return { success: false, error: 'Please fill in all fields.' };
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const user = data.user;
      const sessionUser = {
        name: user.user_metadata?.full_name || user.email.split('@')[0],
        email: user.email,
        initials: _initials(user.user_metadata?.full_name || user.email)
      };
      
      return { success: true, user: sessionUser };
    } catch (err) {
      return { success: false, error: 'Connection error. Please try again.' };
    }
  }

  // Fallback mode
  const users = _getUsers();
  const match = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
  if (!match) {
    return { success: false, error: 'No account found with that email.' };
  }
  if (match.password !== _hash(password)) {
    return { success: false, error: 'Incorrect password.' };
  }

  const sessionUser = { name: match.name, email: match.email, initials: _initials(match.name) };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
  return { success: true, user: sessionUser };
}

/**
 * Register a new user.
 * @returns {Promise<{ success: boolean, user?: Object, error?: string }>}
 */
export async function registerUser(name, email, password, confirmPassword) {
  if (!name || !email || !password || !confirmPassword) {
    return { success: false, error: 'Please fill in all fields.' };
  }
  if (password !== confirmPassword) {
    return { success: false, error: 'Passwords do not match.' };
  }
  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim()
          }
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // If email verification is enabled, user session might be null initially
      const user = data.user;
      if (!user) {
        return { success: false, error: 'Registration failed. Please check your credentials.' };
      }

      const sessionUser = {
        name: user.user_metadata?.full_name || user.email.split('@')[0],
        email: user.email,
        initials: _initials(user.user_metadata?.full_name || user.email)
      };

      return { success: true, user: sessionUser };
    } catch (err) {
      return { success: false, error: 'Connection error during registration.' };
    }
  }

  // Fallback mode
  const users = _getUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase().trim())) {
    return { success: false, error: 'An account with this email already exists.' };
  }

  const newUser = {
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: _hash(password),
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  const sessionUser = { name: newUser.name, email: newUser.email, initials: _initials(newUser.name) };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
  return { success: true, user: sessionUser };
}

/**
 * Log out user session.
 * @returns {Promise<void>}
 */
export async function logoutUser() {
  if (isSupabaseConfigured) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Supabase sign out error:', err);
    }
  }
  sessionStorage.removeItem(SESSION_KEY);
}

// ── Private helpers ──────────────────────────────────────────────────────────

function _getUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  } catch {
    return [];
  }
}

function _hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

function _initials(name) {
  if (!name) return 'CX';
  return name
    .split(' ')
    .map(p => p[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'CX';
}
