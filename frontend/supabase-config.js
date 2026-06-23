// supabase-config.js — Way For System v2.4 (CORRIGIDO - logAccess robusto)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://zqwuzytzeytpypbpiads.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxd3V6eXR6ZXl0cHlwYnBpYWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NDYxNTAsImV4cCI6MjA5NzIyMjE1MH0.51RDmGcO2b_Dvq-iW98OX3GKv6xeO9vlgwQHuRW3omA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== AUTENTICACAO =====

export async function checkEmailExists(email) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();
  if (error) { console.error('Erro ao verificar email:', error.message); return false; }
  return !!data;
}

export async function checkCRMExists(crm) {
  if (!crm || crm.trim() === '') return false;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, crm')
    .eq('crm', crm.trim())
    .maybeSingle();
  if (error) { console.error('Erro ao verificar CRM:', error.message); return false; }
  return !!data;
}

export async function signUp(email, password, name, specialty = '', crm = '') {
  if (crm && crm.trim() !== '') {
    const crmExists = await checkCRMExists(crm);
    if (crmExists) throw new Error('CRM ja cadastrado. Use outro numero ou faca login.');
  }
  const emailExists = await checkEmailExists(email);
  if (emailExists) throw new Error('Email ja cadastrado. Faca login ou use outro email.');

  const redirectUrl = typeof window !== 'undefined' 
    ? window.location.origin + '/auth-confirm.html' 
    : 'http://localhost:3000/auth-confirm.html';

  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: {
      data: { name, specialty, crm, avatar_url: null, phone: '', bio: '' },
      emailRedirectTo: redirectUrl
    }
  });

  if (data && data.user) {
    if (!data.user.identities || data.user.identities.length === 0) {
      throw new Error('Email ja cadastrado. Faca login ou use outro email.');
    }
    if (data.user.email_confirmed_at) {
      throw new Error('Email ja cadastrado e confirmado. Faca login ou use outro email.');
    }
  }

  if (error) {
    const errMsg = error.message.toLowerCase();
    if (errMsg.includes('user already registered') || errMsg.includes('already registered') || 
        errMsg.includes('duplicate') || errMsg.includes('email already')) {
      throw new Error('Email ja cadastrado. Faca login ou use outro email.');
    }
    throw error;
  }
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  try { await supabase.auth.updateUser({ data: { session_id: null } }); } catch (e) {}
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ===== PERFIL =====
export async function getUserProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  return {
    id: user.id, email: user.email,
    name: user.user_metadata?.name || '',
    avatar_url: user.user_metadata?.avatar_url || null,
    specialty: user.user_metadata?.specialty || '',
    crm: user.user_metadata?.crm || '',
    phone: user.user_metadata?.phone || '',
    bio: user.user_metadata?.bio || ''
  };
}

export async function updateUserProfile(profile) {
  const { data, error } = await supabase.auth.updateUser({
    data: {
      name: profile.name, avatar_url: profile.avatar_url,
      specialty: profile.specialty, crm: profile.crm,
      phone: profile.phone, bio: profile.bio
    }
  });
  if (error) throw error;
  return data;
}

export async function uploadAvatar(file) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  const fileExt = file.name.split('.').pop();
  const fileName = `${user.id}-${Date.now()}.${fileExt}`;
  const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
  await updateUserProfile({ avatar_url: publicUrl });
  return publicUrl;
}

// ===== NOTAS =====
export async function getNotes() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  const { data, error } = await supabase.from('notes').select('*').eq('user_id', user.id).order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getNote(id) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  const { data, error } = await supabase.from('notes').select('*').eq('id', id).eq('user_id', user.id).single();
  if (error) throw error;
  return data;
}

export async function createNote(title, content) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  const { data, error } = await supabase.from('notes').insert([{ title, content, user_id: user.id }]).select();
  if (error) throw error;
  return data[0];
}

export async function updateNote(id, title, content) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  const { data, error } = await supabase.from('notes').update({ title, content }).eq('id', id).eq('user_id', user.id).select();
  if (error) throw error;
  return data[0];
}

export async function deleteNote(id) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  const { error } = await supabase.from('notes').delete().eq('id', id).eq('user_id', user.id);
  if (error) throw error;
}

export async function toggleFavorite(id, currentState) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  const { data, error } = await supabase.from('notes').update({ is_favorite: !currentState }).eq('id', id).eq('user_id', user.id).select();
  if (error) throw error;
  return data[0];
}

// ===== CHAT =====
export async function getChatUsers() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  const { data, error } = await supabase.from('profiles').select('id, name, email, avatar_url, specialty, crm').neq('id', user.id);
  if (error) throw error;
  return data || [];
}

export async function findUserById(userId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { console.error('Usuario nao autenticado'); throw new Error('Voce precisa estar logado'); }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) return null;
  const { data, error } = await supabase.from('profiles').select('id, name, email, avatar_url, specialty, crm').eq('id', userId).single();
  if (error) { console.error('Erro ao buscar usuario:', error.message); return null; }
  return data;
}

export async function searchUserByPartialId(partialId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { console.error('Usuario nao autenticado'); throw new Error('Voce precisa estar logado'); }
  const { data, error } = await supabase.from('profiles').select('id, name, email, avatar_url, specialty, crm').or(`name.ilike.%${partialId}%,email.ilike.%${partialId}%`).limit(10);
  if (error) { console.error('Erro na busca:', error.message); throw error; }
  return data || [];
}

export async function searchUserByCRM(crm) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { console.error('Usuario nao autenticado'); throw new Error('Voce precisa estar logado'); }
  const { data, error } = await supabase.from('profiles').select('id, name, email, avatar_url, specialty, crm').eq('crm', crm).single();
  if (error) {
    const { data: partialData, error: partialError } = await supabase.from('profiles').select('id, name, email, avatar_url, specialty, crm').ilike('crm', `%${crm}%`).limit(1);
    if (partialError || !partialData || partialData.length === 0) return null;
    return partialData[0];
  }
  return data;
}

export async function getDoctorsCount() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count, error } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).not('crm', 'is', null).neq('id', user.id);
  if (error) { console.error('Erro ao contar medicos:', error.message); return 0; }
  return count || 0;
}

export async function getConversations() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: messages, error } = await supabase.from('messages').select('id, sender_id, receiver_id, content, created_at, read').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).order('created_at', { ascending: false });
  if (error || !messages || messages.length === 0) return [];
  const conversationsMap = new Map();
  messages.forEach(msg => {
    const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
    if (!conversationsMap.has(otherId)) {
      conversationsMap.set(otherId, { other_user_id: otherId, last_message: msg, unread_count: 0 });
    }
    if (msg.receiver_id === user.id && msg.read === false) conversationsMap.get(otherId).unread_count++;
  });
  const userIds = Array.from(conversationsMap.keys());
  const { data: profiles, error: profileError } = await supabase.from('profiles').select('id, name, email, avatar_url, specialty, crm').in('id', userIds);
  if (profileError) console.error('Erro ao buscar profiles:', profileError.message);
  const profilesMap = new Map((profiles || []).map(p => [p.id, p]));
  return Array.from(conversationsMap.values()).map(conv => ({
    ...conv,
    other_user: profilesMap.get(conv.other_user_id) || { id: conv.other_user_id, name: 'Usuario', email: '', avatar_url: null, specialty: '', crm: '' }
  }));
}

export async function sendMessage(receiverId, content) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  const { data, error } = await supabase.from('messages').insert([{ sender_id: user.id, receiver_id: receiverId, content }]).select();
  if (error) throw error;
  return data[0];
}

export async function getMessages(otherUserId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  const { data: messages, error } = await supabase.from('messages').select('*').or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`).order('created_at', { ascending: true });
  if (error) throw error;
  if (!messages || messages.length === 0) return [];
  const senderIds = [...new Set(messages.map(m => m.sender_id).filter(Boolean))];
  let profilesMap = new Map();
  if (senderIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase.from('profiles').select('id, name, email, avatar_url').in('id', senderIds);
    if (!profileError && profiles) profiles.forEach(p => profilesMap.set(p.id, p));
  }
  return messages.map(msg => ({ ...msg, sender: profilesMap.get(msg.sender_id) || { name: '', email: '', avatar_url: null } }));
}

export function subscribeToMessages(otherUserId, callback) {
  const channel = supabase.channel('messages').on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'messages'
  }, (payload) => {
    const msg = payload.new;
    if ((msg.sender_id === otherUserId && msg.receiver_id === getCurrentUserId()) ||
        (msg.sender_id === getCurrentUserId() && msg.receiver_id === otherUserId)) {
      callback(msg);
    }
  }).subscribe();
  return channel;
}

function getCurrentUserId() {
  return supabase.auth.getUser().then(({ data }) => data.user?.id);
}

// ===== CID DATABASE =====
export const CID_DATABASE = {
  'A00': { name: 'Colera', desc: 'Doenca diarreica aguda causada por Vibrio cholerae. Caracterizada por diarreia aquosa profusa, vomitos e desidratacao rapida.', symptoms: ['diarreia aquosa', 'vomitos', 'desidratacao', 'caibras', 'fraqueza extrema'], keywords: ['colera', 'diarreia profusa', 'desidratacao', 'vibrio'], prescriptions: ['Reidratacao oral (ORS) — 1 sache em 1L de agua', 'Azitromicina 1g dose unica', 'Zinco 20mg/dia (criancas)'] },
  'A01': { name: 'Febre Tifoide', desc: 'Infeccao sistemica causada por Salmonella typhi. Febre prolongada, dor abdominal, rose spots.', symptoms: ['febre alta prolongada', 'dor abdominal', 'rose spots', 'bradicardia relativa'], keywords: ['tifo', 'febre tifoide', 'salmonella', 'rose spots'], prescriptions: ['Azitromicina 500mg 1x/dia x 7 dias', 'Ciprofloxacino 500mg 2x/dia x 10 dias', 'Ceftriaxona 2g IV 1x/dia (grave)'] },
  'A09': { name: 'Gastroenterite e colite de origem infecciosa', desc: 'Diarreia infecciosa aguda. Pode ser viral, bacteriana ou parasitaria.', symptoms: ['diarreia', 'nauseas', 'vomitos', 'colicas', 'febre', 'dores abdominais'], keywords: ['gastroenterite', 'diarreia', 'vomito', 'colite', 'gripe intestinal', 'intoxicacao alimentar', 'dor de barriga', 'nausea'], prescriptions: ['ORS — Soro caseiro', 'Loperamida 2mg (adultos, sem sangue)', 'Probioticos (Saccharomyces boulardii)', 'Zinco 20mg/dia (criancas)'] },
  'B01': { name: 'Varicela', desc: 'Infeccao por virus varicela-zoster (VZV). Exantema vesicular pruriginoso.', symptoms: ['vesiculas pruriginosas', 'febre', 'mal-estar', 'exantema', 'prurido intenso'], keywords: ['varicela', 'catapora', 'vesiculas', 'virus varicela'], prescriptions: ['Aciclovir 800mg 5x/dia x 7 dias (adultos)', 'Calamina topica 3-4x/dia', 'Dipirona 1g para febre'] },
  'B02': { name: 'Herpes Zoster', desc: 'Reativacao do VZV (cobreiro). Dor neuropatica unilateral seguida de vesiculas em dermatoma.', symptoms: ['dor neuropatica unilateral', 'vesiculas em dermatoma', 'ardor', 'hiperestesia'], keywords: ['herpes zoster', 'cobreiro', 'neuralgia pos-herpetica', 'zoster'], prescriptions: ['Aciclovir 800mg 5x/dia x 7-10 dias', 'Amitriptilina 25mg 1x/noite', 'Pregabalina 75mg 2x/dia'] },
  'B35': { name: 'Dermatofitose', desc: 'Micose superficial (tinea) causada por fungos dermatofitos.', symptoms: ['lesoes circinadas', 'descamacao', 'prurido', 'eritema', 'bordas elevadas'], keywords: ['micose', 'tinea', 'pe de atleta', 'tinha', 'dermatofitose'], prescriptions: ['Terbinafina 250mg 1x/dia x 2-4 semanas', 'Cetoconazol creme 2x/dia x 4 semanas', 'Miconazol topico 2x/dia'] },
  'E10': { name: 'Diabetes Mellitus tipo 1', desc: 'Deficiencia absoluta de insulina. Inicio juvenil.', symptoms: ['poliuria', 'polidipsia', 'polifagia', 'perda de peso', 'cetonuria'], keywords: ['diabetes tipo 1', 'DM1', 'insulina dependente', 'juvenil'], prescriptions: ['Insulina NPH (basal) + Regular (bolus)', 'Monitorizacao glicemica 4x/dia', 'Metformina 500mg 2x/dia (adjuvante)'] },
  'E11': { name: 'Diabetes Mellitus tipo 2', desc: 'Resistencia a insulina com defeito secretor.', symptoms: ['fadiga', 'poliuria', 'visao turva', 'feridas que nao cicatrizam', 'infeccoes recorrentes'], keywords: ['diabetes tipo 2', 'DM2', 'glicemia elevada', 'acucar no sangue', 'hiperglicemia'], prescriptions: ['Metformina 850mg 2x/dia', 'Glibenclamida 5mg 1x/dia', 'Sinvastatina 20mg 1x/noite', 'AAS 100mg 1x/dia'] },
  'E66': { name: 'Obesidade', desc: 'IMC >= 30 kg/m2. Doenca cronica multifatorial.', symptoms: ['excesso de peso', 'dispneia aos esforcos', 'apneia do sono', 'hipertensao'], keywords: ['obesidade', 'sobrepeso', 'IMC alto', 'sindrome metabolica'], prescriptions: ['Orlistate 120mg 3x/dia', 'Dieta hipocalorica', 'Exercicio fisico 150min/semana'] },
  'F32': { name: 'Episodio depressivo', desc: 'Transtorno depressivo maior. Humor deprimido persistente.', symptoms: ['humor deprimido', 'perda de interesse', 'insonia ou hipersonia', 'fadiga', 'culpa'], keywords: ['depressao', 'tristeza', 'humor baixo', 'ansiedade', 'insonia', 'melancolia'], prescriptions: ['Sertralina 50mg 1x/dia', 'Fluoxetina 20mg 1x/dia', 'Escitalopram 10mg 1x/dia', 'Psicoterapia (TCC)'] },
  'F41': { name: 'Transtorno de ansiedade generalizada', desc: 'TAG — ansiedade excessiva persistente por >= 6 meses.', symptoms: ['ansiedade excessiva', 'preocupacao constante', 'irritabilidade', 'tensao muscular', 'insonia'], keywords: ['ansiedade', 'TAG', 'nervosismo', 'preocupacao excessiva', 'stress', 'estresse'], prescriptions: ['Sertralina 50mg 1x/dia', 'Escitalopram 10mg 1x/dia', 'Clonazepam 0,5mg 2x/dia (curto prazo)', 'Terapia cognitivo-comportamental'] },
  'G40': { name: 'Epilepsia', desc: 'Disturbio neurologico cronico com crises recorrentes.', symptoms: ['crises convulsivas', 'perda consciencia', 'aura', 'movimentos tonico-clonicos'], keywords: ['epilepsia', 'convulsao', 'crise convulsiva', 'tonico clonica'], prescriptions: ['Carbamazepina 200mg 2x/dia', 'Fenitoina 100mg 3x/dia', 'Acido valproico 500mg 2x/dia'] },
  'G43': { name: 'Enxaqueca', desc: 'Cefaleia primaria pulsatil, unilateral, moderada a grave.', symptoms: ['dor de cabeca pulsatil', 'nauseas', 'fotofobia', 'fonofobia', 'aura visual'], keywords: ['enxaqueca', 'migranea', 'dor de cabeca', 'cefaleia'], prescriptions: ['Sumatriptano 50mg (crise)', 'Paracetamol 1g + Cafeina 65mg', 'Metoclopramida 10mg (nausea)', 'Propranolol 40mg 2x/dia (profilaxia)'] },
  'G44': { name: 'Outras sindromes de cefaleia', desc: 'Cefaleia tensional, cluster e outras formas.', symptoms: ['dor de cabeca em faixa', 'pressao occipital', 'lacrimejo', 'congestao nasal'], keywords: ['cefaleia', 'dor de cabeca', 'tensional', 'cluster'], prescriptions: ['Paracetamol 750mg 3x/dia', 'Ibuprofeno 400mg 3x/dia', 'Amitriptilina 25mg/noite (tensional cronica)'] },
  'H10': { name: 'Conjuntivite', desc: 'Inflamacao da conjuntiva ocular. Viral, bacteriana ou alergica.', symptoms: ['olho vermelho', 'secrecao', 'prurido', 'ardor', 'lacrimejo'], keywords: ['conjuntivite', 'olho vermelho', 'olho irritado', 'secrecao ocular'], prescriptions: ['Tobramicina colirio 3-4x/dia', 'Ciprofloxacino colirio 4x/dia', 'Lubrificante ocular'] },
  'H25': { name: 'Catarata senil', desc: 'Opacificacao do cristalino relacionada a idade.', symptoms: ['visao embacada', 'ofuscamento', 'dificuldade noturna', 'halos'], keywords: ['catarata', 'visao turva', 'cristalino', 'olho embacado'], prescriptions: ['Cirurgia de facoemulsificacao', 'Colirio lubrificante', 'Oculos de sol UV'] },
  'H52': { name: 'Erros de refracao', desc: 'Miopia, hipermetropia, astigmatismo e presbiopia.', symptoms: ['visao embacada', 'dor de cabeca', 'astenopia', 'dificuldade leitura'], keywords: ['miopia', 'hipermetropia', 'astigmatismo', 'presbiopia', 'oculos'], prescriptions: ['Prescricao de oculos corretivos', 'Lentes de contato', 'Cirurgia refrativa (LASIK)'] },
  'I10': { name: 'Hipertensao Essencial', desc: 'Pressao arterial elevada sem causa secundaria.', symptoms: ['assintomatica', 'cefaleia occipital', 'tontura', 'epistaxe', 'dispneia'], keywords: ['hipertensao', 'pressao alta', 'PA elevada', 'HAS', 'tensao alta'], prescriptions: ['Losartana 50mg 1x/dia', 'Amlodipino 5mg 1x/dia', 'Hidroclorotiazida 25mg 1x/dia', 'Restricao de sodio'] },
  'I20': { name: 'Angina Pectoris', desc: 'Dor toracica por isquemia miocardica transitoria.', symptoms: ['dor toracica em aperto', 'irradiacao braco esquerdo', 'dispneia aos esforcos', 'suor frio'], keywords: ['angina', 'dor no peito', 'isquemia', 'coronaria', 'dor cardiaca'], prescriptions: ['Nitroglicerina SL 0,5mg (crise)', 'AAS 100mg 1x/dia', 'Atorvastatina 40mg 1x/noite', 'Metoprolol 50mg 2x/dia'] },
  'I21': { name: 'Infarto agudo do miocardio', desc: 'Necrose miocardica por oclusao coronaria aguda. Emergencia.', symptoms: ['dor toracica intensa', 'suor frio', 'nauseas', 'vomitos', 'dispneia'], keywords: ['infarto', 'IAM', 'ataque cardiaco', 'emergencia cardiaca'], prescriptions: ['AAS 300mg (mastigar)', 'Clopidogrel 600mg', 'Nitroglicerina SL', 'ENCAMINHAR EMERGENCIA'] },
  'I50': { name: 'Insuficiencia Cardiaca', desc: 'Incapacidade do coracao de bombear adequadamente.', symptoms: ['dispneia aos esforcos', 'ortopneia', 'edema de MMII', 'fadiga'], keywords: ['insuficiencia cardiaca', 'IC', 'edema', 'falta ar', 'coracao fraco'], prescriptions: ['Enalapril 10mg 2x/dia', 'Furosemida 40mg 1x/dia', 'Espironolactona 25mg 1x/dia', 'Carvedilol 12,5mg 2x/dia'] },
  'I48': { name: 'Fibrilacao atrial', desc: 'Arritmia supraventricular mais comum. Ritmo irregular.', symptoms: ['palpitacoes', 'fadiga', 'dispneia', 'tontura', 'sincope'], keywords: ['fibrilacao', 'arritmia', 'palpitacao', 'batimento irregular', 'FA'], prescriptions: ['Amiodarona 200mg 3x/dia', 'Warfarina 5mg (INR 2-3)', 'Metoprolol 50mg 2x/dia'] },
  'J06': { name: 'Infeccoes agudas das vias aereas superiores', desc: 'Resfriado comum, faringite, amigdalite. Causada por virus.', symptoms: ['coriza', 'espirros', 'dor de garganta', 'tosse', 'febre baixa'], keywords: ['resfriado', 'gripe', 'faringite', 'coriza', 'nariz entupido', 'dor garganta', 'tosse seca'], prescriptions: ['Dipirona 1g', 'Paracetamol 750mg 3x/dia', 'Loratadina 10mg 1x/dia', 'Repouso e hidratacao'] },
  'J18': { name: 'Pneumonia', desc: 'Infeccao dos pulmoes. Tosse produtiva, febre alta.', symptoms: ['tosse produtiva', 'febre alta', 'dispneia', 'dor toracica pleuritica', 'estertores'], keywords: ['pneumonia', 'pulmao infectado', 'tosse com catarro', 'febre alta', 'infeccao pulmonar'], prescriptions: ['Azitromicina 500mg 1x/dia x 5 dias', 'Amoxicilina 1g 3x/dia x 7 dias', 'Ambroxol xarope 3x/dia', 'Oxigenio (se SpO2 < 92%)'] },
  'J45': { name: 'Asma', desc: 'Doenca inflamatoria cronica das vias aereas.', symptoms: ['dispneia', 'sibilos', 'tosse noturna', 'opressao toracica'], keywords: ['asma', 'falta de ar', 'sibilos', 'bronquite', 'crise asmatica'], prescriptions: ['Salbutamol inalador 100mcg 2 jatos (resgate)', 'Budesonide inalador 200mcg 2x/dia', 'Montelucaste 10mg 1x/noite', 'Prednisona 40mg (exacerbacao)'] },
  'J44': { name: 'Doenca pulmonar obstrutiva cronica', desc: 'DPOC — doenca progressiva. Fumantes > 40 anos.', symptoms: ['dispneia progressiva', 'tosse cronica', 'expectoracao', 'sibilos'], keywords: ['DPOC', 'enfisema', 'bronquite cronica', 'fumante', 'falta ar progressiva'], prescriptions: ['Tiotropio 18mcg inalador 1x/dia', 'Salbutamol inalador (resgate)', 'Budesonide/Formoterol', 'Oxigenio domiciliar', 'Cessacao tabagica'] },
  'K29': { name: 'Gastrite e duodenite', desc: 'Inflamacao da mucosa gastrica/duodenal.', symptoms: ['dor epigastrica', 'pirose', 'nauseas', 'vomitos', 'saciedade precoce'], keywords: ['gastrite', 'azia', 'dor estomago', 'pirose', 'refluxo', 'ma digestao'], prescriptions: ['Omeprazol 20mg 1x/dia', 'Ranitidina 150mg 2x/dia', 'Sucralfato 1g 4x/dia', 'Teste de H. pylori'] },
  'K30': { name: 'Dispepsia', desc: 'Ma digestao funcional.', symptoms: ['ma digestao', 'saciedade precoce', 'distensao abdominal', 'eructacao'], keywords: ['dispepsia', 'ma digestao', 'estomago pesado', 'gases'], prescriptions: ['Omeprazol 20mg 1x/dia', 'Dimeticona 40mg 4x/dia', 'Metoclopramida 10mg 3x/dia'] },
  'K59': { name: 'Constipacao', desc: 'Evacuacoes infrequentes ou dificuldade na defecacao.', symptoms: ['evacuacao dificultosa', 'fezes endurecidas', 'distensao abdominal'], keywords: ['prisao de ventre', 'constipacao', 'evacuar dificil', 'fezes duras'], prescriptions: ['Polietilenoglicol 3350 17g/dia', 'Lactulose 15ml 2x/dia', 'Senna 15mg (noturno)', 'Fibra alimentar 25-30g/dia'] },
  'K70': { name: 'Doenca alcoolica do figado', desc: 'Esteatose, esteato-hepatite, cirrose.', symptoms: ['hepatomegalia', 'ictericia', 'ascite', 'encefalopatia'], keywords: ['cirrose', 'figado gorduroso', 'hepatite alcoolica', 'alcool'], prescriptions: ['Abstinencia alcoolica total', 'Prednisona 40mg/dia (grave)', 'Pentoxifilina 400mg 3x/dia'] },
  'L20': { name: 'Dermatite atopica', desc: 'Eczema cronico com prurido.', symptoms: ['prurido intenso', 'lesoes eritematosas', 'lichenificacao', 'xerose'], keywords: ['eczema', 'dermatite', 'coceira', 'pele seca', 'atopia'], prescriptions: ['Hidrocortisona creme 1% 2x/dia', 'Betametasona creme (cronica)', 'Cetirizina 10mg 1x/dia', 'Emolientes'] },
  'L50': { name: 'Urticaria', desc: 'Edema dermico transitorio com prurido.', symptoms: ['lesoes eritematosas edemaciadas', 'prurido intenso', 'angioedema'], keywords: ['urticaria', 'alergia pele', 'coceira', 'bolhas pele', 'angioedema'], prescriptions: ['Cetirizina 10mg 1x/dia', 'Loratadina 10mg 1x/dia', 'Dexametasona 4mg IM (grave)', 'Epinefrina 0,3mg IM (anafilaxia)'] },
  'L70': { name: 'Acne vulgar', desc: 'Doenca dos foliculos pilosebaceos.', symptoms: ['comedoes', 'papulas', 'pustulas', 'nodulos', 'cicatrizes'], keywords: ['acne', 'espinhas', 'cravos', 'pele oleosa'], prescriptions: ['Adapaleno 0,1% gel (noturno)', 'Peroxido de benzoila 5% gel', 'Minociclina 100mg 1x/dia', 'Isotretinoína 0,5mg/kg/dia (grave)'] },
  'M06': { name: 'Artrite reumatoide', desc: 'Doenca autoimune das articulacoes.', symptoms: ['poliartrite simetrica', 'rigidez matinal > 1h', 'edema articular'], keywords: ['artrite', 'reumatismo', 'dor articular', 'inchaco articulacoes'], prescriptions: ['Metotrexato 15mg/semana', 'Prednisona 5-10mg 1x/dia', 'AAS 100mg 1x/dia', 'Hidroxicloroquina 400mg/dia'] },
  'M15': { name: 'Artrose policentrica', desc: 'Doenca degenerativa articular.', symptoms: ['dor articular mecanica', 'rigidez matinal curta', 'crepitacao'], keywords: ['artrose', 'osteoartrite', 'desgaste cartilagem', 'dor joelho'], prescriptions: ['Paracetamol 750mg 3x/dia', 'Ibuprofeno 400mg 3x/dia', 'Condroitina + Glucosamina', 'Acido hialuronico intra-articular'] },
  'M54': { name: 'Dorsalgia / Lombalgia', desc: 'Dor na coluna lombar ou toracica.', symptoms: ['dor lombar', 'rigidez', 'ciatica', 'dor irradiada perna'], keywords: ['lombalgia', 'dor nas costas', 'ciatica', 'hernia disco', 'coluna'], prescriptions: ['Paracetamol 750mg 3x/dia', 'Diclofenaco 50mg 2x/dia (aguda)', 'Tizanidina 2mg 2x/dia', 'Fisioterapia'] },
  'M79': { name: 'Outras afecoes dos tecidos moles', desc: 'Dores musculares, fibromialgia.', symptoms: ['dor muscular difusa', 'pontos gatilho', 'fadiga', 'disturbio sono'], keywords: ['fibromialgia', 'dor muscular', 'mialgia', 'dor corpo'], prescriptions: ['Paracetamol 750mg 3x/dia', 'Ciclobenzaprina 10mg 1x/noite', 'Pregabalina 75mg 2x/dia', 'Amitriptilina 25mg/noite'] },
  'N18': { name: 'Doenca renal cronica', desc: 'Reducao progressiva da funcao renal.', symptoms: ['edema', 'hipertensao', 'anemia', 'prurido', 'nauseas'], keywords: ['insuficiencia renal', 'rim', 'creatinina alta', 'ureia alta', 'DRC'], prescriptions: ['Losartana 50mg', 'Furosemida 40mg', 'Eritropoetina', 'Restricao de proteinas'] },
  'N39': { name: 'Outras afecoes do trato urinario', desc: 'Infeccao urinaria, cistite.', symptoms: ['disuria', 'polaciuria', 'dor suprapubica', 'urgencia miccional'], keywords: ['cistite', 'infeccao urinaria', 'ardor urinar', 'urina frequente', 'ITU'], prescriptions: ['Nitrofurantoína 100mg 2x/dia x 7 dias', 'Ciprofloxacino 500mg 2x/dia x 3 dias', 'Fosfomicina trometamol 3g dose unica'] },
  'N20': { name: 'Calculo renal', desc: 'Nefrolitiase.', symptoms: ['colica nefretica', 'dor lombar intensa', 'hematuria', 'nauseas'], keywords: ['pedra no rim', 'calculo renal', 'colica', 'hematuria'], prescriptions: ['Diclofenaco 75mg IM (dor aguda)', 'Hidratacao abundante', 'Tansulosina 0,4mg 1x/dia'] },
  'O80': { name: 'Parto unico espontaneo', desc: 'Parto vaginal normal.', symptoms: ['contractions uterinas regulares', 'dilatacao cervical'], keywords: ['parto', 'gestacao', 'gravida'], prescriptions: ['Oxitocina 10UI em 1L SG 5%', 'Analgesia peridural'] },
  'N94': { name: 'Dismenorreia', desc: 'Dor menstrual.', symptoms: ['dor menstrual', 'colica', 'nauseas', 'dor lombar'], keywords: ['colica menstrual', 'dor menstruacao', 'TPM'], prescriptions: ['Ibuprofeno 400mg 3x/dia', 'Mefenamico 500mg 3x/dia', 'Anticoncepcional oral'] },
  'R50': { name: 'Febre de origem desconhecida', desc: 'Febre persistente sem diagnostico.', symptoms: ['febre persistente', 'calafrios', 'sudorese', 'perda de peso'], keywords: ['febre', 'febre alta', 'calafrio', 'temperatura alta'], prescriptions: ['Dipirona 1g', 'Paracetamol 750mg 3x/dia', 'Investigacao diagnostica completa'] },
  'R51': { name: 'Cefaleia', desc: 'Dor de cabeca nao especificada.', symptoms: ['dor de cabeca', 'pressao craniana', 'tontura'], keywords: ['dor de cabeca', 'cefaleia', 'enxaqueca', 'tensao'], prescriptions: ['Paracetamol 750mg 3x/dia', 'Ibuprofeno 400mg 3x/dia', 'Dipirona 1g'] },
  'R52': { name: 'Dor nao especificada', desc: 'Dor aguda ou cronica sem causa.', symptoms: ['dor generalizada', 'dor localizada', 'dor cronica'], keywords: ['dor', 'dores', 'muita dor', 'dor intensa'], prescriptions: ['Paracetamol 750mg 3x/dia', 'Dipirona 1g 4x/dia', 'Tramadol 50mg (moderada-grave)'] },
  'S72': { name: 'Fratura do femur', desc: 'Fratura do osso da coxa. Emergencia.', symptoms: ['dor intensa coxa', 'deformidade', 'encurtamento'], keywords: ['fratura', 'femur', 'quadril', 'queda'], prescriptions: ['Morfina 5mg IV (dor)', 'Imobilizacao', 'Cirurgia ortopedica'] },
  'S82': { name: 'Fratura da tibia ou peronio', desc: 'Fratura da perna.', symptoms: ['dor perna', 'deformidade', 'edema'], keywords: ['fratura perna', 'tibia', 'peronio'], prescriptions: ['Imobilizacao gessada', 'Analgesicos', 'Elevacao do membro'] },
  'Z00': { name: 'Exame geral de saude', desc: 'Consulta de rotina/check-up.', symptoms: ['assintomatico'], keywords: ['check-up', 'exame rotina', 'avaliacao saude', 'prevencao'], prescriptions: ['Exames laboratoriais completos', 'Avaliacao clinica', 'Vacinas em dia'] },
  'Z51': { name: 'Cuidados medicos por radioterapia/quimioterapia', desc: 'Tratamento oncologico.', symptoms: ['nauseas', 'vomitos', 'mielossupressao', 'alopecia'], keywords: ['quimioterapia', 'radioterapia', 'cancer', 'onco'], prescriptions: ['Protocolo oncologico especifico', 'Ondansetrona 8mg', 'Filgrastim'] },
  'Z72': { name: 'Problemas relacionados ao estilo de vida', desc: 'Tabagismo, sedentarismo.', symptoms: ['tabagismo', 'sedentarismo'], keywords: ['tabagismo', 'fumar', 'sedentarismo', 'alcool'], prescriptions: ['Bupropiona 150mg + adesivo nicotina', 'Exercicio fisico', 'Dieta mediterranea'] }
};

export function searchCID(query) {
  query = query.toUpperCase().trim();
  if (!query || query.length < 2) return [];
  const results = [];
  const queryTerms = query.split(/\s+/);
  for (const [code, data] of Object.entries(CID_DATABASE)) {
    let score = 0;
    const searchableText = [code, data.name, ...(data.keywords || []), ...(data.symptoms || []), data.desc].join(' ').toUpperCase();
    if (code === query) score += 100;
    else if (code.startsWith(query)) score += 50;
    if (data.name.toUpperCase() === query) score += 80;
    for (const term of queryTerms) {
      if (term.length < 2) continue;
      if (data.keywords && data.keywords.some(k => k.toUpperCase() === term)) score += 30;
      else if (data.keywords && data.keywords.some(k => k.toUpperCase().includes(term))) score += 15;
      if (data.symptoms && data.symptoms.some(s => s.toUpperCase() === term)) score += 25;
      else if (data.symptoms && data.symptoms.some(s => s.toUpperCase().includes(term))) score += 10;
      if (data.name.toUpperCase().includes(term)) score += 12;
      if (data.desc.toUpperCase().includes(term)) score += 8;
    }
    if (score > 0) results.push({ code, score, ...data });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 15);
}

export function getCID(code) {
  const data = CID_DATABASE[code.toUpperCase()];
  return data ? { code: code.toUpperCase(), ...data } : null;
}

// ===== ADMIN FUNCTIONS =====

export async function getAdminSummary() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  try {
    const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: totalNotes } = await supabase.from('notes').select('*', { count: 'exact', head: true });
    const { count: totalMessages } = await supabase.from('messages').select('*', { count: 'exact', head: true });
    let onlineNow = 0, todayAccess = 0, peakHourToday = null;
    try {
      const today = new Date(); today.setHours(0,0,0,0);
      const todayISO = today.toISOString();
      const { count } = await supabase.from('access_logs').select('*', { count: 'exact', head: true }).gte('accessed_at', todayISO);
      todayAccess = count || 0;
      const { data: hourlyData } = await supabase.from('access_logs').select('accessed_at').gte('accessed_at', todayISO);
      if (hourlyData && hourlyData.length > 0) {
        const hourCounts = {};
        hourlyData.forEach(log => { const hour = new Date(log.accessed_at).getHours(); hourCounts[hour] = (hourCounts[hour] || 0) + 1; });
        let maxCount = 0;
        for (const [hour, count] of Object.entries(hourCounts)) { if (count > maxCount) { maxCount = count; peakHourToday = parseInt(hour); } }
      }
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: recentLogs } = await supabase.from('access_logs').select('user_id').gte('accessed_at', fifteenMinutesAgo).not('user_id', 'is', null);
      if (recentLogs) onlineNow = new Set(recentLogs.map(l => l.user_id)).size;
    } catch (e) {
      try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('updated_at', fiveMinutesAgo);
        onlineNow = count || 0;
      } catch (e2) { onlineNow = 0; }
    }
    return { total_users: totalUsers || 0, total_notes: totalNotes || 0, total_messages: totalMessages || 0, online_now: onlineNow, today_access: todayAccess, peak_hour_today: peakHourToday };
  } catch (err) {
    console.warn('Erro em getAdminSummary:', err.message);
    return { total_users: 0, total_notes: 0, total_messages: 0, online_now: 0, today_access: 0, peak_hour_today: null };
  }
}

export async function getAllUsers() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  const { data, error } = await supabase.from('profiles').select('id, name, email, avatar_url, specialty, crm, phone, bio, created_at').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getAllNotes() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  const { data, error } = await supabase.from('notes').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  const userIds = [...new Set((data || []).map(note => note.user_id).filter(Boolean))];
  let profilesMap = new Map();
  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase.from('profiles').select('id, name, email').in('id', userIds);
    if (!profileError && profiles) profiles.forEach(p => profilesMap.set(p.id, p));
  }
  return (data || []).map(note => ({ ...note, user: profilesMap.get(note.user_id) || { name: 'Usuario', email: '' } }));
}

export async function getUserGrowthStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from('profiles').select('created_at').gte('created_at', sevenDaysAgo).order('created_at', { ascending: true });
  if (error) { console.error('Erro:', error.message); return []; }
  const dailyStats = {};
  for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); dailyStats[d.toISOString().split('T')[0]] = 0; }
  (data || []).forEach(profile => { const date = new Date(profile.created_at).toISOString().split('T')[0]; dailyStats[date] = (dailyStats[date] || 0) + 1; });
  return Object.entries(dailyStats).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getRecentActivity(limit = 20) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  try {
    const { data, error } = await supabase.from('access_logs').select('id, user_id, page, accessed_at').order('accessed_at', { ascending: false }).limit(limit);
    if (error) { if (error.message.includes('does not exist') || error.code === '42P01') return []; throw error; }
    const userIds = [...new Set((data || []).map(log => log.user_id).filter(Boolean))];
    let profilesMap = new Map();
    if (userIds.length > 0) { const { data: profiles } = await supabase.from('profiles').select('id, name, email, avatar_url').in('id', userIds); if (profiles) profiles.forEach(p => profilesMap.set(p.id, p)); }
    return (data || []).map(log => ({ ...log, user: profilesMap.get(log.user_id) || { name: 'Usuario', email: '', avatar_url: null } }));
  } catch (err) { console.warn('Erro:', err.message); return []; }
}

export async function getNotesStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  const [{ count: total }, { count: favorites }, { count: thisWeek }] = await Promise.all([
    supabase.from('notes').select('*', { count: 'exact', head: true }),
    supabase.from('notes').select('*', { count: 'exact', head: true }).eq('is_favorite', true),
    supabase.from('notes').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  ]);
  return { total: total || 0, favorites: favorites || 0, thisWeek: thisWeek || 0 };
}

export async function getOnlineUsers() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    try {
      const { data: logs, error: logsError } = await supabase.from('access_logs').select('user_id, accessed_at').gte('accessed_at', fifteenMinutesAgo).not('user_id', 'is', null).order('accessed_at', { ascending: false });
      if (!logsError && logs && logs.length > 0) {
        const latestByUser = {};
        logs.forEach(log => { if (!latestByUser[log.user_id] || new Date(log.accessed_at) > new Date(latestByUser[log.user_id].accessed_at)) latestByUser[log.user_id] = log; });
        const uniqueUserIds = Object.keys(latestByUser);
        if (uniqueUserIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, name, email, avatar_url, specialty, crm, updated_at').in('id', uniqueUserIds);
          const profilesMap = new Map((profiles || []).map(p => [p.id, p]));
          return uniqueUserIds.map(id => { const p = profilesMap.get(id); const lastLog = latestByUser[id]; return p ? { ...p, last_activity: lastLog?.accessed_at || p.updated_at } : { id, name: 'Usuario', email: '', avatar_url: null, specialty: '', crm: '', last_activity: lastLog?.accessed_at || new Date().toISOString() }; }).sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity));
        }
      }
    } catch (e) { console.log('access_logs nao disponivel, usando fallback'); }
    const { data: profiles, error: profileError } = await supabase.from('profiles').select('id, name, email, avatar_url, specialty, crm, updated_at').gte('updated_at', fifteenMinutesAgo).order('updated_at', { ascending: false });
    if (profileError) { console.error('Erro:', profileError.message); return []; }
    return (profiles || []).map(p => ({ ...p, last_activity: p.updated_at }));
  } catch (err) { console.warn('Erro:', err.message); return []; }
}

export async function getBannedUsers() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  const { data, error } = await supabase.from('profiles').select('id, name, email, avatar_url, specialty, crm, banned_at, ban_reason').not('banned_at', 'is', null).order('banned_at', { ascending: false });
  if (error) { console.error('Erro:', error.message); return []; }
  return data || [];
}

export async function banUser(userId, reason = '') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  const { error } = await supabase.from('profiles').update({ banned_at: new Date().toISOString(), ban_reason: reason, banned_by: user.id }).eq('id', userId);
  if (error) throw error;
  return true;
}

export async function unbanUser(userId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  const { error } = await supabase.from('profiles').update({ banned_at: null, ban_reason: null, banned_by: null }).eq('id', userId);
  if (error) throw error;
  return true;
}

export async function deleteUser(userId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  await supabase.from('notes').delete().eq('user_id', userId);
  await supabase.from('messages').delete().eq('sender_id', userId);
  await supabase.from('messages').delete().eq('receiver_id', userId);
  await supabase.from('access_logs').delete().eq('user_id', userId);
  const { error: profileError } = await supabase.from('profiles').delete().eq('id', userId);
  if (profileError) throw profileError;
  return true;
}

export async function getSystemStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: totalNotes } = await supabase.from('notes').select('*', { count: 'exact', head: true });
    const { count: totalMessages } = await supabase.from('messages').select('*', { count: 'exact', head: true });
    let totalAccess = 0, todayAccess = 0, weekAccess = 0, monthAccess = 0;
    try {
      const r1 = await supabase.from('access_logs').select('*', { count: 'exact', head: true }); totalAccess = r1.count || 0;
      const r2 = await supabase.from('access_logs').select('*', { count: 'exact', head: true }).gte('accessed_at', today.toISOString()); todayAccess = r2.count || 0;
      const r3 = await supabase.from('access_logs').select('*', { count: 'exact', head: true }).gte('accessed_at', weekAgo.toISOString()); weekAccess = r3.count || 0;
      const r4 = await supabase.from('access_logs').select('*', { count: 'exact', head: true }).gte('accessed_at', monthAgo.toISOString()); monthAccess = r4.count || 0;
    } catch (e) {}
    const { count: newUsersToday } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString());
    const { count: newUsersWeek } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString());
    const { count: newUsersMonth } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', monthAgo.toISOString());
    return { totalUsers: totalUsers || 0, totalNotes: totalNotes || 0, totalMessages: totalMessages || 0, totalAccess, todayAccess, weekAccess, monthAccess, newUsersToday: newUsersToday || 0, newUsersWeek: newUsersWeek || 0, newUsersMonth: newUsersMonth || 0 };
  } catch (err) { return { totalUsers: 0, totalNotes: 0, totalMessages: 0, totalAccess: 0, todayAccess: 0, weekAccess: 0, monthAccess: 0, newUsersToday: 0, newUsersWeek: 0, newUsersMonth: 0 }; }
}

export async function getActiveSessions() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from('access_logs').select('user_id, page, accessed_at').gte('accessed_at', thirtyMinutesAgo).not('user_id', 'is', null).order('accessed_at', { ascending: false });
    if (error) { if (error.message.includes('does not exist') || error.code === '42P01') return []; throw error; }
    const sessions = []; const seen = new Set();
    (data || []).forEach(log => { if (log.user_id && !seen.has(log.user_id)) { seen.add(log.user_id); sessions.push({ user_id: log.user_id, page: log.page, last_access: log.accessed_at }); } });
    if (sessions.length > 0) {
      const userIds = sessions.map(s => s.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, name, email, avatar_url').in('id', userIds);
      const profilesMap = new Map((profiles || []).map(p => [p.id, p]));
      sessions.forEach(s => { s.user = profilesMap.get(s.user_id) || { name: 'Usuario', email: '', avatar_url: null }; });
    }
    return sessions;
  } catch (err) { console.warn('Erro:', err.message); return []; }
}

export async function getUserActivity(userId, limit = 50) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  try {
    const { data, error } = await supabase.from('access_logs').select('*').eq('user_id', userId).order('accessed_at', { ascending: false }).limit(limit);
    if (error) { if (error.message.includes('does not exist') || error.code === '42P01') return []; throw error; }
    return data || [];
  } catch (err) { console.warn('Erro:', err.message); return []; }
}

export async function getPageViews(days = 7) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  try {
    const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from('access_logs').select('page, accessed_at').gte('accessed_at', daysAgo);
    if (error) { if (error.message.includes('does not exist') || error.code === '42P01') return []; throw error; }
    const pageViews = {}; (data || []).forEach(log => { pageViews[log.page] = (pageViews[log.page] || 0) + 1; });
    return Object.entries(pageViews).map(([page, views]) => ({ page, views })).sort((a, b) => b.views - a.views);
  } catch (err) { console.warn('Erro:', err.message); return []; }
}

export async function getErrorLogs(limit = 50) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  const { data, error } = await supabase.from('error_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) { if (error.message.includes('does not exist')) return []; console.error('Erro:', error.message); return []; }
  return data || [];
}

export async function isAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (error || !data) return false;
  return data.role === 'admin' || data.role === 'superadmin';
}

export async function getAccessStatsByHour() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from('access_logs').select('accessed_at').gte('accessed_at', twentyFourHoursAgo).order('accessed_at', { ascending: true });
    if (error) { if (error.message.includes('does not exist') || error.code === '42P01') return Array.from({length:24}, (_,i)=>({hour_of_day:i,access_count:0})); throw error; }
    const hourlyStats = {}; for (let i=0;i<24;i++) hourlyStats[i]=0;
    (data || []).forEach(log => { const hour = new Date(log.accessed_at).getHours(); hourlyStats[hour] = (hourlyStats[hour] || 0) + 1; });
    return Object.entries(hourlyStats).map(([hour, count]) => ({ hour_of_day: parseInt(hour), access_count: count }));
  } catch (err) { console.warn('Erro:', err.message); return Array.from({length:24}, (_,i)=>({hour_of_day:i,access_count:0})); }
}

export async function getTodayStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const { data, error } = await supabase.from('access_logs').select('*', { count: 'exact' }).gte('accessed_at', today.toISOString());
    if (error) { if (error.message.includes('does not exist') || error.code === '42P01') return { total: 0, uniqueUsers: 0 }; throw error; }
    const uniqueUsers = new Set((data || []).map(log => log.user_id)).size;
    return { total: data?.length || 0, uniqueUsers };
  } catch (err) { console.warn('Erro:', err.message); return { total: 0, uniqueUsers: 0 }; }
}

export async function getAccessStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [{ count: totalCount }, { count: todayCount }, { count: weekCount }, { count: monthCount }] = await Promise.all([
      supabase.from('access_logs').select('*', { count: 'exact', head: true }),
      supabase.from('access_logs').select('*', { count: 'exact', head: true }).gte('accessed_at', today.toISOString()),
      supabase.from('access_logs').select('*', { count: 'exact', head: true }).gte('accessed_at', weekAgo.toISOString()),
      supabase.from('access_logs').select('*', { count: 'exact', head: true }).gte('accessed_at', monthAgo.toISOString())
    ]);
    return { total: totalCount || 0, today: todayCount || 0, week: weekCount || 0, month: monthCount || 0 };
  } catch (err) { console.warn('Erro:', err.message); return { total: 0, today: 0, week: 0, month: 0 }; }
}

export async function getDailyStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from('access_logs').select('accessed_at').gte('accessed_at', sevenDaysAgo).order('accessed_at', { ascending: true });
    if (error) { if (error.message.includes('does not exist') || error.code === '42P01') return Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return{date:d.toISOString().split('T')[0],count:0}}); throw error; }
    const dailyStats = {}; for(let i=0;i<7;i++){const d=new Date();d.setDate(d.getDate()-i);dailyStats[d.toISOString().split('T')[0]]=0;}
    (data || []).forEach(log => { const date = new Date(log.accessed_at).toISOString().split('T')[0]; dailyStats[date] = (dailyStats[date] || 0) + 1; });
    return Object.entries(dailyStats).map(([date,count])=>({date,count})).sort((a,b)=>a.date.localeCompare(b.date));
  } catch (err) { console.warn('Erro:', err.message); return []; }
}

export async function getWeeklyStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  try {
    const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from('access_logs').select('accessed_at').gte('accessed_at', fourWeeksAgo);
    if (error) { if (error.message.includes('does not exist') || error.code === '42P01') return []; throw error; }
    const weeklyStats = {}; (data || []).forEach(log => { const date = new Date(log.accessed_at); const weekStart = new Date(date); weekStart.setDate(date.getDate() - date.getDay()); weeklyStats[weekStart.toISOString().split('T')[0]] = (weeklyStats[weekStart.toISOString().split('T')[0]] || 0) + 1; });
    return Object.entries(weeklyStats).map(([week,count])=>({week,count})).sort((a,b)=>a.week.localeCompare(b.week));
  } catch (err) { console.warn('Erro:', err.message); return []; }
}

export async function getMonthlyStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  try {
    const twelveMonthsAgo = new Date(); twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const { data, error } = await supabase.from('access_logs').select('accessed_at').gte('accessed_at', twelveMonthsAgo.toISOString());
    if (error) { if (error.message.includes('does not exist') || error.code === '42P01') return []; throw error; }
    const monthlyStats = {}; (data || []).forEach(log => { const date = new Date(log.accessed_at); const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`; monthlyStats[key] = (monthlyStats[key] || 0) + 1; });
    return Object.entries(monthlyStats).map(([month,count])=>({month,count})).sort((a,b)=>a.month.localeCompare(b.month));
  } catch (err) { console.warn('Erro:', err.message); return []; }
}

export async function getUserStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  const [{ count: totalUsers }, { count: activeToday }, { count: newThisWeek }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('access_logs').select('*', { count: 'exact', head: true }).gte('accessed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  ]);
  return { totalUsers: totalUsers || 0, activeToday: activeToday || 0, newThisWeek: newThisWeek || 0 };
}

export async function getLoginStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase.from('access_logs').select('accessed_at, page').gte('accessed_at', sevenDaysAgo).eq('page', 'login');
    if (error) { if (error.message.includes('does not exist') || error.code === '42P01') return []; throw error; }
    const loginStats = {}; for(let i=0;i<7;i++){const d=new Date();d.setDate(d.getDate()-i);loginStats[d.toISOString().split('T')[0]]=0;}
    (data || []).forEach(log => { const date = new Date(log.accessed_at).toISOString().split('T')[0]; loginStats[date] = (loginStats[date] || 0) + 1; });
    return Object.entries(loginStats).map(([date,count])=>({date,count})).sort((a,b)=>a.date.localeCompare(b.date));
  } catch (err) { console.warn('Erro:', err.message); return []; }
}

export async function getTopPages(limit = 10) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  try {
    const { data, error } = await supabase.from('access_logs').select('page');
    if (error) { if (error.message.includes('does not exist') || error.code === '42P01') return []; throw error; }
    const pageCounts = {}; (data || []).forEach(log => { pageCounts[log.page] = (pageCounts[log.page] || 0) + 1; });
    return Object.entries(pageCounts).map(([page,count])=>({page,count})).sort((a,b)=>b.count-a.count).slice(0,limit);
  } catch (err) { console.warn('Erro:', err.message); return []; }
}

// ============================================================
// ===== LOG ACCESS - VERSAO CORRIGIDA E ROBUSTA v2.4 =====
// ============================================================

/**
 * Registra um acesso na tabela access_logs
 * VERSAO CORRIGIDA: Nunca quebra o fluxo da aplicacao
 * - Verifica se usuario esta logado antes de tentar inserir
 * - Silencia erros 42P01 (tabela nao existe)
 * - Silencia erros de permissao (RLS)
 * - Sempre retorna sem throw
 */
export async function logAccess(page) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return { success: false, reason: 'no_user' };
    }
    const { error } = await supabase.from('access_logs').insert([{
      user_id: user.id,
      page: page || 'page_view',
      accessed_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }]);
    if (error) {
      if (error.code === '42P01' || (error.message && error.message.includes('does not exist'))) {
        console.warn('[logAccess] Tabela access_logs nao existe. Crie no Supabase: CREATE TABLE access_logs (id uuid DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id), page text, accessed_at timestamptz, created_at timestamptz);');
        return { success: false, reason: 'table_not_found' };
      }
      if (error.code === '42501' || (error.message && error.message.includes('permission denied'))) {
        console.warn('[logAccess] Permissao negada (RLS). Adicione policy para access_logs.');
        return { success: false, reason: 'permission_denied' };
      }
      console.warn('[logAccess] Erro ao registrar acesso:', error.message || error);
      return { success: false, reason: 'error', error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.warn('[logAccess] Erro inesperado:', err?.message || err);
    return { success: false, reason: 'exception', error: err?.message };
  }
}

// ===== SESSAO UNICA =====
function generateSessionId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export async function registerSession() {
  const sessionId = generateSessionId();
  const { data, error } = await supabase.auth.updateUser({ data: { session_id: sessionId } });
  if (error) throw error;
  localStorage.setItem('session_id', sessionId);
  await supabase.auth.refreshSession();
  return sessionId;
}

export async function validateSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const storedSession = localStorage.getItem('session_id');
  const currentSession = user.user_metadata?.session_id;
  if (!storedSession || !currentSession) return false;
  return storedSession === currentSession;
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
}

// ===== NOTIFICACOES =====
export async function getUnreadMessages() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: messages, error } = await supabase.from('messages').select('*').eq('receiver_id', user.id).eq('read', false).order('created_at', { ascending: false });
  if (error) throw error;
  if (!messages || messages.length === 0) return [];
  const senderIds = [...new Set(messages.map(m => m.sender_id).filter(Boolean))];
  let profilesMap = new Map();
  if (senderIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase.from('profiles').select('id, name, email, avatar_url').in('id', senderIds);
    if (!profileError && profiles) profiles.forEach(p => profilesMap.set(p.id, p));
  }
  return messages.map(msg => ({ ...msg, sender: profilesMap.get(msg.sender_id) || { name: '', email: '', avatar_url: null } }));
}

export async function markMessageAsRead(messageId) {
  const { error } = await supabase.from('messages').update({ read: true }).eq('id', messageId);
  if (error) throw error;
}

export async function markAllMessagesAsRead() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('messages').update({ read: true }).eq('receiver_id', user.id).eq('read', false);
  if (error) throw error;
}

export async function getUnreadCount() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count, error } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('receiver_id', user.id).eq('read', false);
  if (error) throw error;
  return count || 0;
}

export async function checkSingleSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const storedSession = localStorage.getItem('session_id');
  const serverSession = user.user_metadata?.session_id;
  if (serverSession && storedSession && serverSession !== storedSession) {
    await signOut();
    localStorage.removeItem('session_id');
    alert('⚠️ Sua sessao foi encerrada porque voce fez login em outro dispositivo.');
    window.location.href = 'index.html';
    return false;
  }
  return true;
}
