// supabase-config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { getCurrentUser, signOut, getNotes, deleteNote, toggleFavorite } from './supabase-config.js';

const SUPABASE_URL = 'https://zqwuzytzeytpypbpiads.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxd3V6eXR6ZXl0cHlwYnBpYWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NDYxNTAsImV4cCI6MjA5NzIyMjE1MH0.51RDmGcO2b_Dvq-iW98OX3GKv6xeO9vlgwQHuRW3omA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== AUTENTICAÇÃO =====
export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } }
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ===== CRUD NOTAS =====
export async function getNotes() {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getNote(id) {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createNote(title, content) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('notes')
    .insert([{ 
      title, 
      content, 
      user_id: user.id
    }])
    .select();

  if (error) throw error;
  return data[0];
}

export async function updateNote(id, title, content) {
  const { data, error } = await supabase
    .from('notes')
    .update({ title, content })
    .eq('id', id)
    .select();
  if (error) throw error;
  return data[0];
}

export async function deleteNote(id) {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ===== FAVORITOS =====
export async function toggleFavorite(id, currentState) {
  const { data, error } = await supabase
    .from('notes')
    .update({ is_favorite: !currentState })
    .eq('id', id)
    .select();
  if (error) throw error;
  return data[0];
}

// ===== SESSÃO ÚNICA =====
function generateSessionId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export async function registerSession() {
  const sessionId = generateSessionId();
  const { data, error } = await supabase.auth.updateUser({
    data: { session_id: sessionId }
  });
  if (error) throw error;
  localStorage.setItem('session_id', sessionId);
  return sessionId;
}

export async function validateSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const storedSession = localStorage.getItem('session_id');
  const currentSession = user.user_metadata?.session_id;
  return storedSession && currentSession && storedSession === currentSession;
}

export async function ensureValidSession() {
  const isValid = await validateSession();
  if (!isValid) {
    await signOut();
    localStorage.removeItem('session_id');
    window.location.href = 'index.html';
    return false;
  }
  return true;

  // Gera um identificador de sessão único
function generateSessionId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Salva o session_id no metadata do usuário
export async function registerSession() {
  const sessionId = generateSessionId();
  const { data, error } = await supabase.auth.updateUser({
    data: { session_id: sessionId }
  });
  if (error) throw error;
  localStorage.setItem('session_id', sessionId);
  return sessionId;
}

// Verifica se a sessão atual é válida
export async function validateSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const storedSession = localStorage.getItem('session_id');
  const currentSession = user.user_metadata?.session_id;
  return storedSession && currentSession && storedSession === currentSession;
}

// Força logout se a sessão for inválida
export async function ensureValidSession() {
  const isValid = await validateSession();
  if (!isValid) {
    await signOut();
    localStorage.removeItem('session_id');
    window.location.href = 'index.html';
    return false;
  }
  return true;
}
}
