// supabase-config.js
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
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ===== CRUD NOTAS =====
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

// ===== SESSÃO ÚNICA - 1 LOGIN POR USUÁRIO =====

function generateSessionId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Registra uma nova sessão para o usuário.
 * Se houver outra sessão ativa em outro dispositivo, ela será invalidada.
 */
export async function registerSession() {
  const sessionId = generateSessionId();
  
  // Atualiza os metadados do usuário com o novo session_id
  const { data, error } = await supabase.auth.updateUser({
    data: { session_id: sessionId }
  });
  
  if (error) throw error;
  
  // Salva o session_id localmente
  localStorage.setItem('session_id', sessionId);
  
  // Força atualização do token
  await supabase.auth.refreshSession();
  
  return sessionId;
}

/**
 * Valida se a sessão atual ainda é válida.
 * Retorna false se:
 * - Não houver sessão local
 * - O session_id local for diferente do session_id nos metadados do usuário (outro dispositivo fez login)
 */
export async function validateSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  
  const storedSession = localStorage.getItem('session_id');
  const currentSession = user.user_metadata?.session_id;
  
  // Se não há sessão local ou não há sessão no servidor = inválido
  if (!storedSession || !currentSession) return false;
  
  // Se as sessões não batem = outro dispositivo fez login
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
 * Verifica se há uma sessão ativa em outro dispositivo
 * e força o logout se detectar conflito.
 * Usado nas páginas protegidas para detectar login em outro dispositivo.
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
    alert('Sua sessão foi encerrada porque você fez login em outro dispositivo.');
    window.location.href = 'index.html';
    return false;
  }
  
  return true;
}
