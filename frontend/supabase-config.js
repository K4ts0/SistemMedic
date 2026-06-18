// supabase-config.js — NoteMed for Unisystem
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

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
  // Limpa o session_id ao fazer logout
  try {
    await supabase.auth.updateUser({ data: { session_id: null } });
  } catch (e) {}
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ===== CRUD NOTAS (com filtro por usuário) =====
export async function getNotes() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getNote(id) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  if (error) throw error;
  return data;
}

export async function createNote(title, content) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('notes')
    .insert([{ title, content, user_id: user.id }])
    .select();

  if (error) throw error;
  return data[0];
}

export async function updateNote(id, title, content) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('notes')
    .update({ title, content })
    .eq('id', id)
    .eq('user_id', user.id)
    .select();
  if (error) throw error;
  return data[0];
}

export async function deleteNote(id) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) throw error;
}

// ===== FAVORITOS =====
export async function toggleFavorite(id, currentState) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('notes')
    .update({ is_favorite: !currentState })
    .eq('id', id)
    .eq('user_id', user.id)
    .select();
  if (error) throw error;
  return data[0];
}

// ===== SESSÃO ÚNICA — 1 LOGIN POR USUÁRIO =====

function generateSessionId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Registra uma nova sessão para o usuário.
 * Ao fazer login, gera um novo session_id e salva nos metadados.
 * Isso invalida qualquer sessão anterior em outros dispositivos.
 */
export async function registerSession() {
  const sessionId = generateSessionId();

  const { data, error } = await supabase.auth.updateUser({
    data: { session_id: sessionId }
  });

  if (error) throw error;

  localStorage.setItem('session_id', sessionId);
  await supabase.auth.refreshSession();

  return sessionId;
}

/**
 * Valida se a sessão atual ainda é válida.
 * Compara o session_id local com o session_id nos metadados do usuário no Supabase.
 */
export async function validateSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const storedSession = localStorage.getItem('session_id');
  const currentSession = user.user_metadata?.session_id;

  if (!storedSession || !currentSession) return false;

  return storedSession === currentSession;
}

/**
 * Garante que a sessão é válida.
 * Se inválida, desloga o usuário e redireciona para login.
 */
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

/**
 * Verifica se há uma sessão ativa em outro dispositivo.
 * Se detectar que outro dispositivo fez login (session_id diferente),
 * força o logout com alerta informando o usuário.
 */
export async function checkSingleSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const storedSession = localStorage.getItem('session_id');
  const serverSession = user.user_metadata?.session_id;

  // Se o servidor tem um session_id diferente do local,
  // significa que outro dispositivo fez login
  if (serverSession && storedSession && serverSession !== storedSession) {
    // Sessão foi sobrescrita por outro dispositivo
    await signOut();
    localStorage.removeItem('session_id');
    alert('⚠️ Sua sessão foi encerrada porque você fez login em outro dispositivo.');
    window.location.href = 'index.html';
    return false;
  }

  return true;
}
