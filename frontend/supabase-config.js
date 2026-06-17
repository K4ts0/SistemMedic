// supabase-config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://zqwuzytzeytpypbpiads.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxd3V6eXR6ZXl0cHlwYnBpYWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NDYxNTAsImV4cCI6MjA5NzIyMjE1MH0.51RDmGcO2b_Dvq-iW98OX3GKv6xeO9vlgwQHuRW3omA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Funções de autenticação
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

// Funções CRUD para notas
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
  const { data, error } = await supabase
    .from('notes')
    .insert([{ title, content }])
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