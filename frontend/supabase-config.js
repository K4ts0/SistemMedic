// supabase-config.js — NoteMed for Unisystem v2.2
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://zqwuzytzeytpypbpiads.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxd3V6eXR6ZXl0cHlwYnBpYWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NDYxNTAsImV4cCI6MjA5NzIyMjE1MH0.51RDmGcO2b_Dvq-iW98OX3GKv6xeO9vlgwQHuRW3omA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== AUTENTICACAO =====
export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
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
  try { await supabase.auth.updateUser({ data: { session_id: null } }); } catch (e) {}
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ===== PERFIL DO USUARIO =====
export async function getUserProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
  return {
    id: user.id,
    email: user.email,
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
      name: profile.name,
      avatar_url: profile.avatar_url,
      specialty: profile.specialty,
      crm: profile.crm,
      phone: profile.phone,
      bio: profile.bio
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

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(fileName);

  await updateUserProfile({ avatar_url: publicUrl });
  return publicUrl;
}

// ===== CRUD NOTAS =====
export async function getNotes() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
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
  if (!user) throw new Error('Usuario nao autenticado');
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
  if (!user) throw new Error('Usuario nao autenticado');
  const { data, error } = await supabase
    .from('notes')
    .insert([{ title, content, user_id: user.id }])
    .select();
  if (error) throw error;
  return data[0];
}

export async function updateNote(id, title, content) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');
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
  if (!user) throw new Error('Usuario nao autenticado');
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
  if (!user) throw new Error('Usuario nao autenticado');
  const { data, error } = await supabase
    .from('notes')
    .update({ is_favorite: !currentState })
    .eq('id', id)
    .eq('user_id', user.id)
    .select();
  if (error) throw error;
  return data[0];
}

// ===== CHAT =====
export async function getChatUsers() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, specialty, crm')
    .neq('id', user.id);

  if (error) throw error;
  return data || [];
}

// ===== BUSCAR USUARIO POR ID =====
export async function findUserById(userId) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    console.error('Usuario nao autenticado - nao pode buscar profiles');
    throw new Error('Voce precisa estar logado para buscar usuarios');
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (uuidRegex.test(userId)) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url, specialty, crm')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Erro ao buscar usuario:', error.message);
      return null;
    }
    return data;
  }

  return null;
}

// ===== BUSCAR USUARIO POR NOME/EMAIL =====
export async function searchUserByPartialId(partialId) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    console.error('Usuario nao autenticado');
    throw new Error('Voce precisa estar logado para buscar usuarios');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, specialty, crm')
    .or(`name.ilike.%${partialId}%,email.ilike.%${partialId}%`)
    .limit(10);

  if (error) {
    console.error('Erro na busca:', error.message);
    throw error;
  }

  return data || [];
}

// ===== BUSCAR USUARIO POR CRM =====
export async function searchUserByCRM(crm) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    console.error('Usuario nao autenticado');
    throw new Error('Voce precisa estar logado para buscar usuarios');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, specialty, crm')
    .eq('crm', crm)
    .single();

  if (error) {
    const { data: partialData, error: partialError } = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url, specialty, crm')
      .ilike('crm', `%${crm}%`)
      .limit(1);

    if (partialError || !partialData || partialData.length === 0) return null;
    return partialData[0];
  }

  return data;
}

// ===== CONTAR MEDICOS CADASTRADOS =====
export async function getDoctorsCount() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .not('crm', 'is', null)
    .neq('id', user.id);

  if (error) {
    console.error('Erro ao contar medicos:', error.message);
    return 0;
  }
  return count || 0;
}

// ===== CONVERSAS INICIADAS =====
export async function getConversations() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, sender_id, receiver_id, content, created_at, read')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error || !messages || messages.length === 0) return [];

  const conversationsMap = new Map();

  messages.forEach(msg => {
    const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
    if (!conversationsMap.has(otherId)) {
      conversationsMap.set(otherId, {
        other_user_id: otherId,
        last_message: msg,
        unread_count: 0
      });
    }
    if (msg.receiver_id === user.id && msg.read === false) {
      conversationsMap.get(otherId).unread_count++;
    }
  });

  const userIds = Array.from(conversationsMap.keys());
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, specialty, crm')
    .in('id', userIds);

  if (profileError) {
    console.error('Erro ao buscar profiles:', profileError.message);
  }

  const profilesMap = new Map((profiles || []).map(p => [p.id, p]));

  return Array.from(conversationsMap.values()).map(conv => ({
    ...conv,
    other_user: profilesMap.get(conv.other_user_id) || { 
      id: conv.other_user_id, 
      name: 'Usuario', 
      email: '', 
      avatar_url: null, 
      specialty: '', 
      crm: '' 
    }
  }));
}

// ===== MENSAGENS =====
export async function sendMessage(receiverId, content) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  const { data, error } = await supabase
    .from('messages')
    .insert([{
      sender_id: user.id,
      receiver_id: receiverId,
      content: content
    }])
    .select();

  if (error) throw error;
  return data[0];
}

export async function getMessages(otherUserId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export function subscribeToMessages(otherUserId, callback) {
  const channel = supabase
    .channel('messages')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages'
    }, (payload) => {
      const msg = payload.new;
      if ((msg.sender_id === otherUserId && msg.receiver_id === getCurrentUserId()) ||
          (msg.sender_id === getCurrentUserId() && msg.receiver_id === otherUserId)) {
        callback(msg);
      }
    })
    .subscribe();

  return channel;
}

function getCurrentUserId() {
  return supabase.auth.getUser().then(({ data }) => data.user?.id);
}

// ============================================================
// ===== CID / PRESCRICAO — BANCO EXPANDIDO COM SINTOMAS =====
// ============================================================

export const CID_DATABASE = {
  // === INFECCOES ===
  'A00': { 
    name: 'Colera', 
    desc: 'Doenca diarreica aguda causada por Vibrio cholerae. Caracterizada por diarreia aquosa profusa, vomitos e desidratacao rapida.',
    symptoms: ['diarreia aquosa', 'vomitos', 'desidratacao', 'caibras', 'fraqueza extrema', 'fezes rice water'],
    keywords: ['colera', 'diarreia profusa', 'desidratacao', 'vibrio', 'fezes aquosas', 'colera asiatica'],
    prescriptions: ['Reidratacao oral (ORS) — 1 sache em 1L de agua', 'Azitromicina 1g dose unica', 'Zinco 20mg/dia (criancas)', 'Tetraciclina 500mg 4x/dia x 3 dias']
  },
  'A01': { 
    name: 'Febre Tifoide', 
    desc: 'Infeccao sistemica causada por Salmonella typhi. Febre prolongada, dor abdominal, rose spots na pele.',
    symptoms: ['febre alta prolongada', 'dor abdominal', 'rose spots', 'bradicardia relativa', 'hepatoesplenomegalia', 'constipacao'],
    keywords: ['tifo', 'febre tifoide', 'salmonella', 'rose spots', 'febre prolongada', 'tifico'],
    prescriptions: ['Azitromicina 500mg 1x/dia x 7 dias', 'Ciprofloxacino 500mg 2x/dia x 10 dias', 'Ceftriaxona 2g IV 1x/dia (grave)', 'Repouso e hidratacao']
  },
  'A02': { 
    name: 'Outras infeccoes por Salmonella', 
    desc: 'Gastroenterite nao tifoide por Salmonella. Diarreia, febre, colicas abdominais.',
    symptoms: ['diarreia', 'febre', 'colicas abdominais', 'nauseas', 'vomitos'],
    keywords: ['salmonelose', 'gastroenterite', 'salmonella', 'intoxicacao alimentar', 'diarreia bacteriana'],
    prescriptions: ['Ciprofloxacino 500mg 2x/dia x 5-7 dias', 'Azitromicina 500mg 1x/dia x 3 dias', 'Hidratacao oral', 'Dieta leve (arroz, banana, maca)']
  },
  'A09': { 
    name: 'Gastroenterite e colite de origem infecciosa', 
    desc: 'Diarreia infecciosa aguda — a causa mais comum de consulta medica. Pode ser viral, bacteriana ou parasitaria.',
    symptoms: ['diarreia', 'nauseas', 'vomitos', 'colicas', 'febre', 'dores abdominais', 'desidratacao'],
    keywords: ['gastroenterite', 'diarreia', 'vomito', 'colite', 'gripe intestinal', 'intoxicacao alimentar', 'dor de barriga', 'nausea', 'indisposicao estomacal'],
    prescriptions: ['ORS — Soro caseiro (1L agua + 1 colher cafe sal + 2 colheres acucar)', 'Loperamida 2mg (adultos, sem sangue na fezes)', 'Probióticos (Saccharomyces boulardii)', 'Zinco 20mg/dia (criancas < 5 anos)', 'Metronidazol 500mg 3x/dia (se parasitose)']
  },
  'B01': { 
    name: 'Varicela', 
    desc: 'Infeccao por virus varicela-zoster (VZV). Exantema vesicular pruriginoso em surtos.',
    symptoms: ['vesiculas pruriginosas', 'febre', 'mal-estar', 'exantema', 'prurido intenso', 'lesoes em crosta'],
    keywords: ['varicela', 'catapora', 'vesiculas', 'virus varicela', 'zoster', 'catapora adulto'],
    prescriptions: ['Aciclovir 800mg 5x/dia x 7 dias (adultos)', 'Calamina topica 3-4x/dia', 'Dipirona 1g para febre', 'Antihistaminico (Cetirizina 10mg) para coceira', 'Higiene das lesoes']
  },
  'B02': { 
    name: 'Herpes Zoster', 
    desc: 'Reativacao do VZV (cobreiro). Dor neuropatica unilateral seguida de vesiculas em dermatoma.',
    symptoms: ['dor neuropatica unilateral', 'vesiculas em dermatoma', 'ardor', 'hiperestesia', 'prurido'],
    keywords: ['herpes zoster', 'cobreiro', 'neuralgia pos-herpetica', 'zoster', 'vesiculas dor', 'herpes dor'],
    prescriptions: ['Aciclovir 800mg 5x/dia x 7-10 dias (iniciar em 72h)', 'Amitriptilina 25mg 1x/noite (neuralgia)', 'Pregabalina 75mg 2x/dia (neuropatia)', 'Analgesicos (Paracetamol 750mg 3x/dia)', 'Creme aciclovir topico']
  },
  'B35': { 
    name: 'Dermatofitose', 
    desc: 'Micose superficial (tinea) causada por fungos dermatofitos. Lesoes circinadas, descamacao, prurido.',
    symptoms: ['lesoes circinadas', 'descamacao', 'prurido', 'eritema', 'bordas elevadas', 'alopecia localizada'],
    keywords: ['micose', 'tinea', 'pe de atleta', 'tinha', 'dermatofitose', 'fungos', 'candidiase cutanea', 'lesao circular'],
    prescriptions: ['Terbinafina 250mg 1x/dia x 2-4 semanas', 'Cetoconazol creme 2x/dia x 4 semanas', 'Miconazol topico 2x/dia', 'Itraconazol 200mg 1x/dia x 1 semana (pulse)']
  },

  // === ENDOCRINOLOGIA / METABOLISMO ===
  'E10': { 
    name: 'Diabetes Mellitus tipo 1', 
    desc: 'Deficiencia absoluta de insulina. Inicio juvenil, dependente de insulina.',
    symptoms: ['poliuria', 'polidipsia', 'polifagia', 'perda de peso', 'cetonuria', 'fadiga'],
    keywords: ['diabetes tipo 1', 'DM1', 'insulina dependente', 'juvenil', 'cetoacidose', 'glicemia alta', 'acucar alto'],
    prescriptions: ['Insulina NPH (basal) + Regular (bolus) — ajustar por glicemia', 'Monitorizacao glicemica 4x/dia', 'Metformina 500mg 2x/dia (adjuvante)', 'Educacao em diabetes', 'A1c a cada 3 meses']
  },
  'E11': { 
    name: 'Diabetes Mellitus tipo 2', 
    desc: 'Resistencia a insulina com defeito secretor. Associado a obesidade e sedentarismo.',
    symptoms: ['fadiga', 'poliuria', 'visao turva', 'feridas que nao cicatrizam', 'infeccoes recorrentes', 'parestesias'],
    keywords: ['diabetes tipo 2', 'DM2', 'glicemia elevada', 'acucar no sangue', 'resistencia insulina', 'pre-diabetes', 'hiperglicemia'],
    prescriptions: ['Metformina 850mg 2x/dia (inicio 500mg)', 'Glibenclamida 5mg 1x/dia (se HbA1c > 7%)', 'Sinvastatina 20mg 1x/noite', 'AAS 100mg 1x/dia', 'Controle glicemico (glicemia jejum < 100mg/dL)', 'Dieta hipoglicemica']
  },
  'E66': { 
    name: 'Obesidade', 
    desc: 'IMC >= 30 kg/m2. Doenca cronica multifatorial com risco cardiovascular aumentado.',
    symptoms: ['excesso de peso', 'dispneia aos esforcos', 'apneia do sono', 'hipertensao', 'dor articular'],
    keywords: ['obesidade', 'sobrepeso', 'IMC alto', 'gordura', 'excesso peso', 'apneia sono', 'sindrome metabolica'],
    prescriptions: ['Orlistate 120mg 3x/dia (refeicoes)', 'Dieta hipocalorica (1200-1500 kcal)', 'Exercicio fisico 150min/semana', 'Acompanhamento nutricional', 'Bariatrica (IMC > 40 ou > 35 com comorbidades)']
  },

  // === PSIQUIATRIA ===
  'F32': { 
    name: 'Episodio depressivo', 
    desc: 'Transtorno depressivo maior. Humor deprimido persistente com perda de interesse.',
    symptoms: ['humor deprimido', 'perda de interesse', 'insonia ou hipersonia', 'fadiga', 'culpa', 'dificuldade concentracao', 'ideacao suicida'],
    keywords: ['depressao', 'tristeza', 'humor baixo', 'ansiedade', 'insonia', 'falta vontade', 'depressao maior', 'melancolia', 'suicidio'],
    prescriptions: ['Sertralina 50mg 1x/dia (aumentar para 100mg em 2 semanas)', 'Fluoxetina 20mg 1x/dia (manha)', 'Escitalopram 10mg 1x/dia', 'Psicoterapia (TCC)', 'Atividade fisica regular', 'Avaliar risco suicida a cada consulta']
  },
  'F41': { 
    name: 'Transtorno de ansiedade generalizada', 
    desc: 'TAG — ansiedade excessiva persistente por >= 6 meses. Preocupacoes multiplas dificeis de controlar.',
    symptoms: ['ansiedade excessiva', 'preocupacao constante', 'irritabilidade', 'tensao muscular', 'insonia', 'fadiga', 'dificuldade concentracao'],
    keywords: ['ansiedade', 'TAG', 'nervosismo', 'preocupacao excessiva', 'panico', 'stress', 'estresse', 'tensao', 'inquietacao'],
    prescriptions: ['Sertralina 50mg 1x/dia', 'Escitalopram 10mg 1x/dia', 'Clonazepam 0,5mg 2x/dia (curto prazo, max 4 semanas)', 'Terapia cognitivo-comportamental (TCC)', 'Relaxamento e mindfulness']
  },

  // === NEUROLOGIA ===
  'G40': { 
    name: 'Epilepsia', 
    desc: 'Disturbio neurologico cronico com crises recorrentes nao provocadas.',
    symptoms: ['crises convulsivas', 'perda consciencia', 'aura', 'movimentos tonico-clonicos', 'confusao pos-critica', 'lingua mordida'],
    keywords: ['epilepsia', 'convulsao', 'crise convulsiva', 'mal', 'ataque', 'desmaio com convulsao', 'tonico clonica'],
    prescriptions: ['Carbamazepina 200mg 2x/dia (crises parciais)', 'Fenitoina 100mg 3x/dia', 'Acido valproico 500mg 2x/dia (crises generalizadas)', 'Levetiracetam 500mg 2x/dia', 'Evitar gatilhos (falta sono, alcool)']
  },
  'G43': {
    name: 'Enxaqueca',
    desc: 'Cefaleia primaria pulsatil, unilateral, moderada a grave, agravada por esforco fisico.',
    symptoms: ['dor de cabeca pulsatil', 'nauseas', 'fotofobia', 'fonofobia', 'aura visual', 'vomitos'],
    keywords: ['enxaqueca', 'migranea', 'dor de cabeca', 'cefaleia', 'migraine', 'dor cabeca forte', 'enjoo cabeca'],
    prescriptions: ['Sumatriptano 50mg (crise, max 200mg/dia)', 'Paracetamol 1g + Cafeina 65mg', 'Metoclopramida 10mg (nausea)', 'Propranolol 40mg 2x/dia (profilaxia)', 'Amitriptilina 25mg/noite (profilaxia cronica)']
  },
  'G44': {
    name: 'Outras sindromes de cefaleia',
    desc: 'Cefaleia tensional, cluster e outras formas de dor de cabeca primaria.',
    symptoms: ['dor de cabeca em faixa', 'pressao occipital', 'lacrimejo', 'congestao nasal', 'agitacao'],
    keywords: ['cefaleia', 'dor de cabeca', 'tensional', 'cluster', 'sinusite', 'pressao cabeca'],
    prescriptions: ['Paracetamol 750mg 3x/dia', 'Ibuprofeno 400mg 3x/dia', 'Amitriptilina 25mg/noite (tensional cronica)', 'Verapamil 240mg (cluster)', 'Oxigenio 100% 7-15L/min (cluster aguda)']
  },

  // === OFTALMOLOGIA ===
  'H10': { 
    name: 'Conjuntivite', 
    desc: 'Inflamacao da conjuntiva ocular. Pode ser viral, bacteriana ou alergica.',
    symptoms: ['olho vermelho', 'secrecao', 'prurido', 'ardor', 'lacrimejo', 'sensacao corpo estranho'],
    keywords: ['conjuntivite', 'olho vermelho', 'olho irritado', 'secrecao ocular', 'olho inchado', 'blefarite'],
    prescriptions: ['Tobramicina colirio 3-4x/dia (bacteriana)', 'Ciprofloxacino colirio 4x/dia', 'Lubrificante ocular (carboximetilcelulose)', 'Compressas mornas', 'Higiene das palpebras (blefarite)']
  },
  'H25': {
    name: 'Catarata senil',
    desc: 'Opacificacao do cristalino relacionada a idade. Visao embacada progressiva.',
    symptoms: ['visao embacada', 'ofuscamento', 'dificuldade noturna', 'halos', 'desbotamento cores'],
    keywords: ['catarata', 'visao turva', 'cristalino', 'opacificacao', 'olho embacado'],
    prescriptions: ['Cirurgia de facoemulsificacao (indicacao principal)', 'Colirio lubrificante', 'Oculos de sol UV', 'Reavaliacao a cada 6 meses']
  },
  'H52': {
    name: 'Erros de refracao',
    desc: 'Miopia, hipermetropia, astigmatismo e presbiopia.',
    symptoms: ['visao embacada', 'dor de cabeca', 'astenopia', 'dificuldade leitura', 'ofuscamento'],
    keywords: ['miopia', 'hipermetropia', 'astigmatismo', 'presbiopia', 'oculos', 'visao ruim', 'dificuldade enxergar'],
    prescriptions: ['Prescricao de oculos corretivos', 'Lentes de contato (se indicado)', 'Cirurgia refrativa (LASIK, PRK)', 'Reavaliacao anual']
  },

  // === CARDIOLOGIA ===
  'I10': { 
    name: 'Hipertensao Essencial', 
    desc: 'Pressao arterial sistemica elevada (PAS >= 140 ou PAD >= 90 mmHg) sem causa secundaria identificavel.',
    symptoms: ['assintomatica', 'cefaleia occipital', 'tontura', 'epistaxe', 'dispneia', 'palpitacoes'],
    keywords: ['hipertensao', 'pressao alta', 'PA elevada', 'HAS', 'hipertensao arterial', 'pressao', 'tensao alta'],
    prescriptions: ['Losartana 50mg 1x/dia (inicio)', 'Amlodipino 5mg 1x/dia', 'Hidroclorotiazida 25mg 1x/dia', 'Enalapril 10mg 2x/dia', 'Restricao de sodio (< 2g/dia)', 'Monitoramento domiciliar']
  },
  'I20': { 
    name: 'Angina Pectoris', 
    desc: 'Dor toracica por isquemia miocardica transitoria. Dor em aperto, irradiacao para braco esquerdo.',
    symptoms: ['dor toracica em aperto', 'irradiacao braco esquerdo', 'dispneia aos esforcos', 'suor frio', 'nauseas'],
    keywords: ['angina', 'dor no peito', 'isquemia', 'coronaria', 'infarto', 'dor cardiaca', 'aperto peito'],
    prescriptions: ['Nitroglicerina SL 0,5mg (crise, max 3 doses)', 'AAS 100mg 1x/dia', 'Atorvastatina 40mg 1x/noite', 'Metoprolol 50mg 2x/dia', 'Clopidogrel 75mg 1x/dia', 'Cinecoronariografia se alto risco']
  },
  'I21': {
    name: 'Infarto agudo do miocardio',
    desc: 'Necrose miocardica por oclusao coronaria aguda. Emergencia medica.',
    symptoms: ['dor toracica intensa', 'suor frio', 'nauseas', 'vomitos', 'dispneia', 'palidez', 'medo de morrer'],
    keywords: ['infarto', 'IAM', 'ataque cardiaco', 'dor peito intensa', 'coronaria aguda', 'emergencia cardiaca'],
    prescriptions: ['AAS 300mg (mastigar)', 'Clopidogrel 600mg (loading)', 'Nitroglicerina SL', 'Heparina IV', 'Metoprolol 5mg IV', 'Angioplastia primaria < 90min', 'Atorvastatina 80mg', 'ENCAMINHAR EMERGENCIA']
  },
  'I50': { 
    name: 'Insuficiencia Cardiaca', 
    desc: 'Incapacidade do coracao de bombear adequadamente. Edema, dispneia, ortopneia.',
    symptoms: ['dispneia aos esforcos', 'ortopneia', 'edema de MMII', 'fadiga', 'ingurgitamento jugular', 'hepatomegalia'],
    keywords: ['insuficiencia cardiaca', 'IC', 'edema', 'falta ar', 'dispneia', 'coracao fraco', 'congestao'],
    prescriptions: ['Enalapril 10mg 2x/dia', 'Furosemida 40mg 1x/dia (aumentar se edema)', 'Espironolactona 25mg 1x/dia', 'Carvedilol 12,5mg 2x/dia (estavel)', 'Restricao hidrica e de sodio']
  },
  'I48': {
    name: 'Fibrilacao atrial',
    desc: 'Arritmia supraventricular mais comum. Ritmo irregular, risco de AVC.',
    symptoms: ['palpitacoes', 'fadiga', 'dispneia', 'tontura', 'sincope', 'ritmo irregular'],
    keywords: ['fibrilacao', 'arritmia', 'palpitacao', 'batimento irregular', 'FA', 'AVC'],
    prescriptions: ['Amiodarona 200mg 3x/dia (controle ritmo)', 'Warfarina 5mg (INR 2-3) ou Rivaroxabana 20mg', 'Metoprolol 50mg 2x/dia (controle frequencia)', 'Ablacao por cateter (sintomatico refratario)']
  },

  // === PNEUMOLOGIA ===
  'J06': { 
    name: 'Infeccoes agudas das vias aereas superiores', 
    desc: 'Resfriado comum, faringite, amigdalite, rinite aguda. Causada principalmente por virus.',
    symptoms: ['coriza', 'espirros', 'dor de garganta', 'tosse', 'febre baixa', 'mal-estar', 'congestao nasal'],
    keywords: ['resfriado', 'gripe', 'faringite', 'amigdalite', 'coriza', 'nariz entupido', 'dor garganta', 'tosse seca', 'sintomas gripais'],
    prescriptions: ['Dipirona 1g (febre/dor)', 'Paracetamol 750mg 3x/dia', 'Loratadina 10mg 1x/dia', 'Xarope expectorante (Ambroxol)', 'Repouso e hidratacao', 'Nao usar antibiotico (viral)']
  },
  'J18': { 
    name: 'Pneumonia', 
    desc: 'Infeccao dos pulmoes. Tosse produtiva, febre alta, dispneia, estertores.',
    symptoms: ['tosse produtiva', 'febre alta', 'dispneia', 'dor toracica pleuritica', 'estertores', 'taquipneia'],
    keywords: ['pneumonia', 'pulmao infectado', 'tosse com catarro', 'febre alta', 'infeccao pulmonar', 'broncopneumonia'],
    prescriptions: ['Azitromicina 500mg 1x/dia x 5 dias', 'Amoxicilina 1g 3x/dia x 7 dias', 'Ambroxol xarope 3x/dia', 'Oxigenio (se SpO2 < 92%)', 'Hidratacao IV (se desidratado)', 'Raio-X de torax']
  },
  'J45': { 
    name: 'Asma', 
    desc: 'Doenca inflamatoria cronica das vias aereas. Broncoespasmo reversivel.',
    symptoms: ['dispneia', 'sibilos', 'tosse noturna', 'opressao toracica', 'crises de falta de ar'],
    keywords: ['asma', 'falta de ar', 'sibilos', 'bronquite', 'crise asmatica', 'dispneia', 'opressao peito'],
    prescriptions: ['Salbutamol inalador 100mcg 2 jatos (resgate)', 'Budesonide inalador 200mcg 2x/dia (manutencao)', 'Montelucaste 10mg 1x/noite', 'Prednisona 40mg 1x/dia (exacerbacao)', 'Plano de acao escrito']
  },
  'J44': {
    name: 'Doenca pulmonar obstrutiva cronica',
    desc: 'DPOC — doenca progressiva com limitacao ao fluxo aereo. Fumantes > 40 anos.',
    symptoms: ['dispneia progressiva', 'tosse cronica', 'expectoracao', 'sibilos', 'fadiga'],
    keywords: ['DPOC', 'enfisema', 'bronquite cronica', 'fumante', 'falta ar progressiva', 'pulmao obstrutivo'],
    prescriptions: ['Tiotropio 18mcg inalador 1x/dia', 'Salbutamol inalador (resgate)', 'Budesonide/Formoterol (manutencao)', 'Oxigenio domiciliar (PaO2 < 55mmHg)', 'Cessacao tabagica', 'Vacina pneumococica e influenza']
  },

  // === GASTROENTEROLOGIA ===
  'K29': { 
    name: 'Gastrite e duodenite', 
    desc: 'Inflamacao da mucosa gastrica/duodenal. Pode ser aguda ou cronica.',
    symptoms: ['dor epigastrica', 'pirose', 'nauseas', 'vomitos', 'saciedade precoce', 'eructacao'],
    keywords: ['gastrite', 'azia', 'dor estomago', 'pirose', 'ulcera', 'refluxo', 'ma digestao', 'queimacao'],
    prescriptions: ['Omeprazol 20mg 1x/dia (30min antes cafe)', 'Ranitidina 150mg 2x/dia', 'Sucralfato 1g 4x/dia (1h antes refeicoes)', 'Teste de H. pylori (ureia respiratoria)', 'Eradicacao: OMA (Omeprazol + Amoxicilina + Claritromicina)']
  },
  'K30': {
    name: 'Dispepsia',
    desc: 'Ma digestao funcional. Dor ou desconforto epigastrico sem causa organica.',
    symptoms: ['ma digestao', 'saciedade precoce', 'distensao abdominal', 'eructacao', 'nauseas'],
    keywords: ['dispepsia', 'ma digestao', 'estomago pesado', 'gases', 'inchaco', 'digestao lenta'],
    prescriptions: ['Omeprazol 20mg 1x/dia', 'Dimeticona 40mg 4x/dia', 'Metoclopramida 10mg 3x/dia', 'Dieta fracionada', 'Evitar gorduras e alcool']
  },
  'K59': {
    name: 'Constipacao',
    desc: 'Evacuacoes infrequentes ou dificuldade na defecacao.',
    symptoms: ['evacuacao dificultosa', 'fezes endurecidas', 'distensao abdominal', 'tenesmo', 'sangramento as vezes'],
    keywords: ['prisao de ventre', 'constipacao', 'evacuar dificil', 'fezes duras', 'intestino preso'],
    prescriptions: ['Polietilenoglicol 3350 17g/dia', 'Lactulose 15ml 2x/dia', 'Senna 15mg (noturno)', 'Fibra alimentar 25-30g/dia', 'Hidratacao abundante (> 2L/dia)', 'Exercicio fisico']
  },
  'K70': {
    name: 'Doenca alcoolica do figado',
    desc: 'Esteatose, esteato-hepatite, cirrose por consumo cronico de alcool.',
    symptoms: ['hepatomegalia', 'ictericia', 'ascite', 'encefalopatia', 'hemorragia varicosa'],
    keywords: ['cirrose', 'figado gorduroso', 'hepatite alcoolica', 'alcool', 'ictericia', 'ascite'],
    prescriptions: ['Abstinencia alcoolica total', 'Prednisona 40mg/dia (hepatite alcoolica grave)', 'Pentoxifilina 400mg 3x/dia', 'Propranolol (prevencao varizes)', 'Espironolactona + Furosemida (ascite)', 'Transplante hepatico (avaliacao)']
  },

  // === DERMATOLOGIA ===
  'L20': { 
    name: 'Dermatite atopica', 
    desc: 'Eczema cronico com prurido. Historia familiar de atopia.',
    symptoms: ['prurido intenso', 'lesoes eritematosas', 'lichenificacao', 'xerose', 'excoriacoes'],
    keywords: ['eczema', 'dermatite', 'coceira', 'pele seca', 'atopia', 'dermatite alergica'],
    prescriptions: ['Hidrocortisona creme 1% 2x/dia (aguda)', 'Betametasona creme (cronica)', 'Cetirizina 10mg 1x/dia', 'Emolientes (glicerina, ureia 10%)', 'Evitar alegenos e sabonetes']
  },
  'L50': {
    name: 'Urticaria',
    desc: 'Edema dermico transitorio com prurido. Pode ser aguda ou cronica.',
    symptoms: ['lesoes eritematosas edemaciadas', 'prurido intenso', 'angioedema', 'wheals', 'queimacao'],
    keywords: ['urticaria', 'alergia pele', 'coceira', 'bolhas pele', 'angioedema', 'intolerancia alimentar'],
    prescriptions: ['Cetirizina 10mg 1x/dia', 'Loratadina 10mg 1x/dia', 'Dexametasona 4mg IM (aguda grave)', 'Epinefrina 0,3mg IM (anafilaxia)', 'Identificar e evitar gatilhos']
  },
  'L70': {
    name: 'Acne vulgar',
    desc: 'Doenca dos foliculos pilosebaceos. Comedoes, papulas, pustulas, nodulos.',
    symptoms: ['comedoes', 'papulas', 'pustulas', 'nodulos', 'cicatrizes', 'seborreia'],
    keywords: ['acne', 'espinhas', 'cravos', 'pele oleosa', 'seborreia', 'comedoes'],
    prescriptions: ['Adapaleno 0,1% gel (noturno)', 'Peroxido de benzoila 5% gel (manha)', 'Minociclina 100mg 1x/dia (moderada-grave)', 'Isotretinoína 0,5mg/kg/dia (grave)', 'Acido salicilico 2%']
  },

  // === REUMATOLOGIA ===
  'M06': { 
    name: 'Artrite reumatoide', 
    desc: 'Doenca autoimune das articulacoes. Poliartrite simetrica, rigidez matinal.',
    symptoms: ['poliartrite simetrica', 'rigidez matinal > 1h', 'edema articular', 'nodulos reumatoides', 'fadiga'],
    keywords: ['artrite', 'reumatismo', 'dor articular', 'inchaco articulacoes', 'rigidez', 'reumatoide'],
    prescriptions: ['Metotrexato 15mg/semana (oral ou SC)', 'Prednisona 5-10mg 1x/dia', 'AAS 100mg 1x/dia', 'Hidroxicloroquina 400mg/dia', 'Fisioterapia', 'Anti-TNF (Adalimumab) se refratario']
  },
  'M15': {
    name: 'Artrose policentrica',
    desc: 'Doenca degenerativa articular. Dor mecanica, rigidez < 30min.',
    symptoms: ['dor articular mecanica', 'rigidez matinal curta', 'crepitacao', 'deformidade articular', 'limitacao movimento'],
    keywords: ['artrose', 'osteoartrite', 'desgaste cartilagem', 'dor joelho', 'coxartrose', 'gonartrose'],
    prescriptions: ['Paracetamol 750mg 3x/dia (1ª linha)', 'Ibuprofeno 400mg 3x/dia (se necessario)', 'Condroitina + Glucosamina', 'Acido hialuronico intra-articular', 'Artroplastia (caso refratario)']
  },
  'M54': {
    name: 'Dorsalgia / Lombalgia',
    desc: 'Dor na coluna lombar ou toracica. Causa mais comum de incapacidade.',
    symptoms: ['dor lombar', 'rigidez', 'ciatica', 'dor irradiada perna', 'parestesia'],
    keywords: ['lombalgia', 'dor nas costas', 'ciatica', 'hernia disco', 'coluna', 'dor lombar'],
    prescriptions: ['Paracetamol 750mg 3x/dia', 'Diclofenaco 50mg 2x/dia (aguda)', 'Tizanidina 2mg 2x/dia (relaxante)', 'Fisioterapia', 'Exercicios de fortalecimento', 'RM se deficit neurologico']
  },
  'M79': { 
    name: 'Outras afecoes dos tecidos moles', 
    desc: 'Dores musculares, fibromialgia, mialgia, fascite plantar.',
    symptoms: ['dor muscular difusa', 'pontos gatilho', 'fadiga', 'disturbio sono', 'rigidez'],
    keywords: ['fibromialgia', 'dor muscular', 'mialgia', 'dor corpo', 'cansaco muscular', 'fascite plantar'],
    prescriptions: ['Paracetamol 750mg 3x/dia', 'Ciclobenzaprina 10mg 1x/noite', 'Pregabalina 75mg 2x/dia', 'Fisioterapia', 'Alongamento', 'Exercicio aerobio leve', 'Amitriptilina 25mg/noite']
  },

  // === NEFROLOGIA ===
  'N18': { 
    name: 'Doenca renal cronica', 
    desc: 'Reducao progressiva da funcao renal por >= 3 meses.',
    symptoms: ['edema', 'hipertensao', 'anemia', 'prurido', 'nauseas', 'uremia'],
    keywords: ['insuficiencia renal', 'rim', 'creatinina alta', 'ureia alta', 'DRC', 'dialise', 'nefropatia'],
    prescriptions: ['Losartana 50mg (protecao renal)', 'Furosemida 40mg (edema)', 'Eritropoetina (anemia)', 'Restricao de proteinas 0,8g/kg', 'Controle de fosforo e potassio', 'Nefrologista (eGFR < 30)']
  },
  'N39': { 
    name: 'Outras afecoes do trato urinario', 
    desc: 'Infeccao urinaria, cistite, uretrite. Disuria, polaciuria, dor suprapubica.',
    symptoms: ['disuria', 'polaciuria', 'dor suprapubica', 'urgencia miccional', 'sangue na urina', 'febre (pielonefrite)'],
    keywords: ['cistite', 'infeccao urinaria', 'ardor urinar', 'urina frequente', 'disuria', 'ITU', 'urina com sangue'],
    prescriptions: ['Nitrofurantoína 100mg 2x/dia x 7 dias', 'Ciprofloxacino 500mg 2x/dia x 3 dias', 'Fosfomicina trometamol 3g dose unica', 'Hidratacao abundante (> 2L/dia)', 'Urocultura']
  },
  'N20': {
    name: 'Calculo renal',
    desc: 'Nefrolitiase. Dor lombar intensa (colica nefretica), hematuria.',
    symptoms: ['colica nefretica', 'dor lombar intensa', 'hematuria', 'nauseas', 'vomitos', 'disuria'],
    keywords: ['pedra no rim', 'calculo renal', 'colica', 'dor lado', 'hematuria', 'nefrolitiase'],
    prescriptions: ['Diclofenaco 75mg IM (dor aguda)', 'Hidratacao abundante', 'Tansulosina 0,4mg 1x/dia (facilita passagem)', 'Citrato de potassio (urina acida)', 'Litotripsia extracorporea (ESWL)', 'Analise do calculo']
  },

  // === GINECOLOGIA / OBSTETRICIA ===
  'O80': { 
    name: 'Parto unico espontaneo', 
    desc: 'Parto vaginal normal. Acompanhamento obstetrico adequado.',
    symptoms: ['contractions uterinas regulares', 'dilatacao cervical', 'ruptura de membranas'],
    keywords: ['parto', 'gestacao', 'gravida', 'trabalho de parto', 'nascimento'],
    prescriptions: ['Oxitocina 10UI em 1L SG 5% (se necessario)', 'Analgesia peridural', 'Acompanhamento obstetrico continuo', 'Parto humanizado']
  },
  'N94': {
    name: 'Dismenorreia',
    desc: 'Dor menstrual. Primaria (sem causa) ou secundaria (endometriose, mioma).',
    symptoms: ['dor menstrual', 'colica', 'nauseas', 'diarreia', 'dor lombar'],
    keywords: ['colica menstrual', 'dor menstruacao', 'TPM', 'dismenorreia', 'colica'],
    prescriptions: ['Ibuprofeno 400mg 3x/dia (iniciar 1 dia antes)', 'Mefenamico 500mg 3x/dia', 'Anticoncepcional oral (se recorrente)', 'Calor local', 'Exercicio fisico']
  },

  // === SINTOMAS GERAIS ===
  'R50': { 
    name: 'Febre de origem desconhecida', 
    desc: 'Febre persistente sem diagnostico apos investigacao inicial.',
    symptoms: ['febre persistente', 'calafrios', 'sudorese', 'perda de peso', 'fadiga'],
    keywords: ['febre', 'febre alta', 'calafrio', 'sudorese', 'temperatura alta', 'febre persistente'],
    prescriptions: ['Dipirona 1g (sintomatico)', 'Paracetamol 750mg 3x/dia', 'Investigacao diagnostica completa', 'Hemocultura, urina, RX torax', 'TC abdome se necessario']
  },
  'R51': {
    name: 'Cefaleia',
    desc: 'Dor de cabeca nao especificada. Pode ser primaria ou secundaria.',
    symptoms: ['dor de cabeca', 'cefaleia', 'pressao craniana', 'tontura'],
    keywords: ['dor de cabeca', 'cefaleia', 'enxaqueca', 'migranea', 'dor cabeca', 'tensao'],
    prescriptions: ['Paracetamol 750mg 3x/dia', 'Ibuprofeno 400mg 3x/dia', 'Dipirona 1g', 'Hidratacao', 'Repouso em ambiente escuro']
  },
  'R52': {
    name: 'Dor nao especificada',
    desc: 'Dor aguda ou cronica sem causa identificada.',
    symptoms: ['dor generalizada', 'dor localizada', 'dor cronica', 'dor aguda'],
    keywords: ['dor', 'dores', 'muita dor', 'dor intensa', 'dor generalizada', 'mal estar'],
    prescriptions: ['Paracetamol 750mg 3x/dia', 'Dipirona 1g 4x/dia', 'Tramadol 50mg (dor moderada-grave)', 'Investigar causa subjacente', 'Analgesicos por etapas (OMS)']
  },

  // === TRAUMATOLOGIA ===
  'S72': { 
    name: 'Fratura do femur', 
    desc: 'Fratura do osso da coxa. Emergencia ortopedica, especialmente em idosos.',
    symptoms: ['dor intensa coxa', 'deformidade', 'encurtamento', 'impotencia funcional', 'edema'],
    keywords: ['fratura', 'femur', 'quadril', 'coxa quebrada', 'queda', 'trauma'],
    prescriptions: ['Analgesicos (Morfina 5mg IV se necessario)', 'Imobilizacao', 'Cirurgia ortopedica (osteosintese ou artroplastia)', 'Profilaxia de trombose', 'Fisioterapia precoce']
  },
  'S82': {
    name: 'Fratura da tibia ou peronio',
    desc: 'Fratura da perna. Pode ser exposta ou fechada.',
    symptoms: ['dor perna', 'deformidade', 'edema', 'crepitacao', 'impotencia funcional'],
    keywords: ['fratura perna', 'tibia', 'peronio', 'perna quebrada', 'trauma'],
    prescriptions: ['Imobilizacao gessada', 'Analgesicos', 'Elevacao do membro', 'Cirurgia se desvio > 5mm', 'Fisioterapia']
  },

  // === PREVENCAO / SAUDE ===
  'Z00': { 
    name: 'Exame geral de saude', 
    desc: 'Consulta de rotina/check-up. Avaliacao preventiva completa.',
    symptoms: ['assintomatico', 'check-up', 'avaliacao preventiva'],
    keywords: ['check-up', 'exame rotina', 'avaliacao saude', 'prevencao', 'consulta anual', 'exame periodico'],
    prescriptions: ['Exames laboratoriais (CBC, glicemia, creatinina, lipidograma, TSH)', 'Avaliacao clinica completa', 'Orientacoes preventivas', 'Vacinas em dia', 'Rastreamento cancer (idade apropriada)']
  },
  'Z51': { 
    name: 'Cuidados medicos por radioterapia/quimioterapia', 
    desc: 'Tratamento oncologico sistemico ou local.',
    symptoms: ['nauseas', 'vomitos', 'mielossupressao', 'alopecia', 'mucosite', 'fadiga'],
    keywords: ['quimioterapia', 'radioterapia', 'cancer', 'onco', 'tratamento oncologia', 'neoplasia'],
    prescriptions: ['Protocolo oncologico especifico', 'Ondansetrona 8mg (nausea)', 'Filgrastim (neutropenia)', 'Suporte transfusional', 'Nutricao enteral/parenteral se necessario']
  },
  'Z72': {
    name: 'Problemas relacionados ao estilo de vida',
    desc: 'Tabagismo, sedentarismo, alcoolismo, ma alimentacao.',
    symptoms: ['tabagismo', 'sedentarismo', 'obesidade', 'estresse'],
    keywords: ['tabagismo', 'fumar', 'sedentarismo', 'alcool', 'estilo vida', 'habitos saudaveis'],
    prescriptions: ['Cessacao tabagica (Bupropiona 150mg + adesivo nicotina)', 'Exercicio fisico regular', 'Dieta mediterranea', 'Reducao alcool', 'Acompanhamento psicologico']
  }
};

// ===== BUSCA INTELIGENTE CID COM SINONIMOS E SINTOMAS =====
export function searchCID(query) {
  query = query.toUpperCase().trim();
  if (!query || query.length < 2) return [];

  const results = [];
  const queryTerms = query.split(/\s+/);

  for (const [code, data] of Object.entries(CID_DATABASE)) {
    let score = 0;
    const searchableText = [
      code,
      data.name,
      ...(data.keywords || []),
      ...(data.symptoms || []),
      data.desc
    ].join(' ').toUpperCase();

    // Codigo CID exato ou prefixo
    if (code === query) {
      score += 100;
    } else if (code.startsWith(query)) {
      score += 50;
    }

    // Nome exato
    if (data.name.toUpperCase() === query) {
      score += 80;
    }

    // Cada termo da busca
    for (const term of queryTerms) {
      if (term.length < 2) continue;

      // Palavra-chave exata
      if (data.keywords && data.keywords.some(k => k.toUpperCase() === term)) {
        score += 30;
      }
      else if (data.keywords && data.keywords.some(k => k.toUpperCase().includes(term))) {
        score += 15;
      }

      // Sintoma exato
      if (data.symptoms && data.symptoms.some(s => s.toUpperCase() === term)) {
        score += 25;
      }
      else if (data.symptoms && data.symptoms.some(s => s.toUpperCase().includes(term))) {
        score += 10;
      }

      // Nome ou descricao
      if (data.name.toUpperCase().includes(term)) {
        score += 12;
      }
      if (data.desc.toUpperCase().includes(term)) {
        score += 8;
      }
    }

    if (score > 0) {
      results.push({ code, score, ...data });
    }
  }

  // Ordena por pontuacao (maior primeiro)
  results.sort((a, b) => b.score - a.score);

  // Retorna top 15 resultados
  return results.slice(0, 15);
}

export function getCID(code) {
  const data = CID_DATABASE[code.toUpperCase()];
  return data ? { code: code.toUpperCase(), ...data } : null;
}

// ===== SESSAO UNICA =====
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

  const { data, error } = await supabase
    .from('messages')
    .select('*, sender:sender_id(name, email, avatar_url)')
    .eq('receiver_id', user.id)
    .eq('read', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function markMessageAsRead(messageId) {
  const { error } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('id', messageId);
  if (error) throw error;
}

export async function markAllMessagesAsRead() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('receiver_id', user.id)
    .eq('read', false);
  if (error) throw error;
}

export async function getUnreadCount() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('receiver_id', user.id)
    .eq('read', false);

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
