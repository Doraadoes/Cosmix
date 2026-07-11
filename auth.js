/**
 * COSMIX — AUTH MANAGER (localStorage-based)
 */

const USERS_KEY   = 'cosmix_users';
const SESSION_KEY = 'cosmix_session';

export function getUser() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function loginUser(email, password) {
  if (!email || !password) return { success: false, error: 'Please fill in all fields.' };
  const users = _getUsers();
  const match = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
  if (!match) return { success: false, error: 'No account found with that email.' };
  if (match.password !== _hash(password)) return { success: false, error: 'Incorrect password.' };
  const sessionUser = { name: match.name, email: match.email, initials: _initials(match.name) };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
  return { success: true, user: sessionUser };
}

export function registerUser(name, email, password, confirmPassword) {
  if (!name || !email || !password || !confirmPassword) return { success: false, error: 'Please fill in all fields.' };
  if (password !== confirmPassword) return { success: false, error: 'Passwords do not match.' };
  if (password.length < 6) return { success: false, error: 'Password must be at least 6 characters.' };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) return { success: false, error: 'Please enter a valid email address.' };
  const users = _getUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase().trim())) return { success: false, error: 'An account with this email already exists.' };
  const newUser = { name: name.trim(), email: email.toLowerCase().trim(), password: _hash(password), createdAt: new Date().toISOString() };
  users.push(newUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  const sessionUser = { name: newUser.name, email: newUser.email, initials: _initials(newUser.name) };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
  return { success: true, user: sessionUser };
}

export function logoutUser() {
  sessionStorage.removeItem(SESSION_KEY);
}

function _getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch { return []; }
}

function _hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) { hash = ((hash << 5) + hash) + str.charCodeAt(i); hash |= 0; }
  return hash.toString(36);
}

function _initials(name) {
  return name.split(' ').map(p => p[0] || '').join('').toUpperCase().slice(0, 2) || 'CX';
}
