// supabase-config.js — NoteMed for Unisystem v2.3 (CORRIGIDO)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://zqwuzytzeytpypbpiads.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxd3V6eXR6ZXl0cHlwYnBpYWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NDYxNTAsImV4cCI6MjA5NzIyMjE1MH0.51RDmGcO2b_Dvq-iW98OX3GKv6xeO9vlgwQHuRW3omA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== AUTENTICACAO =====

// ===== VALIDACAO DE DUPLICADAS (CORRIGIDO) =====

/**
 * Verifica se o email ja existe na tabela profiles (usuarios confirmados)
 */
export async function checkEmailExists(email) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('Erro ao verificar email em profiles:', error.message);
    return false;
  }
  return !!data;
}

/**
 * Verifica se o CRM ja existe na tabela profiles
 */
export async function checkCRMExists(crm) {
  if (!crm || crm.trim() === '') return false;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, crm')
    .eq('crm', crm.trim())
    .maybeSingle();

  if (error) {
    console.error('Erro ao verificar CRM:', error.message);
    return false;
  }
  return !!data;
}



export async function signUp(email, password, name, specialty = '', crm = '') {
  // 1. Verifica CRM duplicado na tabela profiles
  if (crm && crm.trim() !== '') {
    const crmExists = await checkCRMExists(crm);
    if (crmExists) {
      throw new Error('CRM ja cadastrado no sistema. Use outro numero ou faca login.');
    }
  }

  // 2. Verifica email duplicado na tabela profiles (usuários já confirmados)
  const emailExists = await checkEmailExists(email);
  if (emailExists) {
    throw new Error('Email ja cadastrado. Faca login ou use outro email.');
  }

  // 3. Site URL no Supabase deve apontar para auth-confirm.html
  const redirectUrl = typeof window !== 'undefined' 
    ? window.location.origin + '/auth-confirm.html' 
    : 'http://localhost:3000/auth-confirm.html';

  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: {
      data: {
        name,
        specialty,
        crm,
        avatar_url: null,
        phone: '',
        bio: ''
      },
      emailRedirectTo: redirectUrl
    }
  });

  // 4. Verificação CRUCIAL - Supabase v2 comportamento:
  // Quando email já existe, retorna user com identities vazio ([]) em vez de erro
  if (data && data.user) {
    // identities === [] ou undefined = email já cadastrado (Supabase v2)
    if (!data.user.identities || data.user.identities.length === 0) {
      throw new Error('Email ja cadastrado. Faca login ou use outro email.');
    }
    // Se email já confirmado anteriormente
    if (data.user.email_confirmed_at) {
      throw new Error('Email ja cadastrado e confirmado. Faca login ou use outro email.');
    }
  }

  // 5. Se o Supabase retornar erro explicito
  if (error) {
    const errMsg = error.message.toLowerCase();
    if (errMsg.includes('user already registered') || 
        errMsg.includes('already registered') || 
        errMsg.includes('duplicate') ||
        errMsg.includes('email already')) {
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

  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!messages || messages.length === 0) return [];

  // Busca perfis dos remetentes
  const senderIds = [...new Set(messages.map(m => m.sender_id).filter(Boolean))];
  let profilesMap = new Map();

  if (senderIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url')
      .in('id', senderIds);

    if (!profileError && profiles) {
      profiles.forEach(p => profilesMap.set(p.id, p));
    }
  }

  return messages.map(msg => ({
    ...msg,
    sender: profilesMap.get(msg.sender_id) || { name: '', email: '', avatar_url: null }
  }));
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


// ============================================================

// ============================================================
// ===== ADMIN / PAINEL ADMINISTRATIVO =====
// ============================================================

/**
 * Retorna resumo geral para o painel admin
 */

/**
 * Retorna resumo geral para o painel admin
 * Formato compativel com admin.html
 */
export async function getAdminSummary() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  try {
    // Busca contagens basicas
    const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: totalNotes } = await supabase.from('notes').select('*', { count: 'exact', head: true });
    const { count: totalMessages } = await supabase.from('messages').select('*', { count: 'exact', head: true });

    // Tenta buscar de access_logs para dados mais precisos
    let onlineNow = 0;
    let todayAccess = 0;
    let peakHourToday = null;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // Conta acessos de hoje
      const { count } = await supabase.from('access_logs').select('*', { count: 'exact', head: true }).gte('accessed_at', todayISO);
      todayAccess = count || 0;

      // Calcula hora de pico de hoje
      const { data: hourlyData } = await supabase
        .from('access_logs')
        .select('accessed_at')
        .gte('accessed_at', todayISO);

      if (hourlyData && hourlyData.length > 0) {
        const hourCounts = {};
        hourlyData.forEach(log => {
          const hour = new Date(log.accessed_at).getHours();
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });
        let maxCount = 0;
        for (const [hour, count] of Object.entries(hourCounts)) {
          if (count > maxCount) {
            maxCount = count;
            peakHourToday = parseInt(hour);
          }
        }
      }

      // Usuarios online (últimos 15 min via access_logs)
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: recentLogs } = await supabase
        .from('access_logs')
        .select('user_id')
        .gte('accessed_at', fifteenMinutesAgo)
        .not('user_id', 'is', null);

      if (recentLogs) {
        onlineNow = new Set(recentLogs.map(l => l.user_id)).size;
      }
    } catch (e) {
      // access_logs pode estar vazia ou não existir
      // Fallback: usa profiles.updated_at como indicador de atividade
      try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('updated_at', fiveMinutesAgo);
        onlineNow = count || 0;
      } catch (e2) {
        onlineNow = 0;
      }
    }

    return {
      total_users: totalUsers || 0,
      total_notes: totalNotes || 0,
      total_messages: totalMessages || 0,
      online_now: onlineNow,
      today_access: todayAccess,
      peak_hour_today: peakHourToday
    };
  } catch (err) {
    console.warn('Erro em getAdminSummary:', err.message);
    return { 
      total_users: 0, 
      total_notes: 0, 
      total_messages: 0, 
      online_now: 0, 
      today_access: 0,
      peak_hour_today: null 
    };
  }
}
/**
 * Retorna lista de todos os usuarios (apenas admin)
 */
export async function getAllUsers() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, specialty, crm, phone, bio, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Retorna lista de todas as notas (apenas admin)
 */
export async function getAllNotes() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Busca perfis separadamente
  const userIds = [...new Set((data || []).map(note => note.user_id).filter(Boolean))];
  let profilesMap = new Map();

  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', userIds);

    if (!profileError && profiles) {
      profiles.forEach(p => profilesMap.set(p.id, p));
    }
  }

  return (data || []).map(note => ({
    ...note,
    user: profilesMap.get(note.user_id) || { name: 'Usuario', email: '' }
  }));
}

/**
 * Retorna estatisticas de usuarios por dia (ultimos 7 dias)
 */
export async function getUserGrowthStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('profiles')
    .select('created_at')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Erro ao buscar crescimento de usuarios:', error.message);
    return [];
  }

  const dailyStats = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    dailyStats[key] = 0;
  }

  (data || []).forEach(profile => {
    const date = new Date(profile.created_at).toISOString().split('T')[0];
    dailyStats[date] = (dailyStats[date] || 0) + 1;
  });

  return Object.entries(dailyStats)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Retorna atividade recente do sistema
 */
export async function getRecentActivity(limit = 20) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  try {
    const { data, error } = await supabase
      .from('access_logs')
      .select('id, user_id, page, accessed_at')
      .order('accessed_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return [];
      }
      throw error;
    }

    // Busca perfis dos usuarios em query SEPARADA
    const userIds = [...new Set((data || []).map(log => log.user_id).filter(Boolean))];
    let profilesMap = new Map();

    if (userIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .in('id', userIds);

      if (!profileError && profiles) {
        profiles.forEach(p => profilesMap.set(p.id, p));
      }
    }

    return (data || []).map(log => ({
      ...log,
      user: profilesMap.get(log.user_id) || { name: 'Usuario', email: '', avatar_url: null }
    }));
  } catch (err) {
    console.warn('Erro em getRecentActivity:', err.message);
    return [];
  }
}

/**
 * Retorna estatisticas de notas
 */
export async function getNotesStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  const [
    { count: total },
    { count: favorites },
    { count: thisWeek }
  ] = await Promise.all([
    supabase.from('notes').select('*', { count: 'exact', head: true }),
    supabase.from('notes').select('*', { count: 'exact', head: true }).eq('is_favorite', true),
    supabase.from('notes').select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  ]);

  return {
    total: total || 0,
    favorites: favorites || 0,
    thisWeek: thisWeek || 0
  };
}


// ============================================================
// ===== ADMIN / FUNCOES ADICIONAIS DO PAINEL =====
// ============================================================

/**
 * Retorna usuarios online (baseado em acessos nos ultimos 15 minutos)
 */

/**
 * Retorna usuarios online (baseado em acessos nos ultimos 15 minutos)
 * Fallback para profiles.updated_at quando access_logs nao existe
 */
export async function getOnlineUsers() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    // TENTATIVA 1: Buscar de access_logs (mais preciso)
    try {
      const { data: logs, error: logsError } = await supabase
        .from('access_logs')
        .select('user_id, accessed_at')
        .gte('accessed_at', fifteenMinutesAgo)
        .not('user_id', 'is', null)
        .order('accessed_at', { ascending: false });

      if (!logsError && logs && logs.length > 0) {
        // Pega o acesso mais recente de cada usuário
        const latestByUser = {};
        logs.forEach(log => {
          if (!latestByUser[log.user_id] || new Date(log.accessed_at) > new Date(latestByUser[log.user_id].accessed_at)) {
            latestByUser[log.user_id] = log;
          }
        });

        const uniqueUserIds = Object.keys(latestByUser);

        if (uniqueUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, email, avatar_url, specialty, crm, updated_at')
            .in('id', uniqueUserIds);

          const profilesMap = new Map((profiles || []).map(p => [p.id, p]));

          return uniqueUserIds.map(id => {
            const p = profilesMap.get(id);
            const lastLog = latestByUser[id];
            return p ? { 
              ...p, 
              last_activity: lastLog?.accessed_at || p.updated_at 
            } : { 
              id, 
              name: 'Usuario', 
              email: '', 
              avatar_url: null, 
              specialty: '', 
              crm: '', 
              last_activity: lastLog?.accessed_at || new Date().toISOString()
            };
          }).sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity));
        }
      }
    } catch (e) {
      console.log('access_logs não disponível, usando fallback');
    }

    // FALLBACK: Usa profiles.updated_at como indicador de atividade
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url, specialty, crm, updated_at')
      .gte('updated_at', fifteenMinutesAgo)
      .order('updated_at', { ascending: false });

    if (profileError) {
      console.error('Erro ao buscar perfis online:', profileError.message);
      return [];
    }

    return (profiles || []).map(p => ({
      ...p,
      last_activity: p.updated_at
    }));

  } catch (err) {
    console.warn('Erro em getOnlineUsers:', err.message);
    return [];
  }
}
export async function getBannedUsers() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, specialty, crm, banned_at, ban_reason')
    .not('banned_at', 'is', null)
    .order('banned_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar usuarios banidos:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Bane um usuario
 */
export async function banUser(userId, reason = '') {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  const { error } = await supabase
    .from('profiles')
    .update({
      banned_at: new Date().toISOString(),
      ban_reason: reason,
      banned_by: user.id
    })
    .eq('id', userId);

  if (error) throw error;
  return true;
}

/**
 * Desbane um usuario
 */
export async function unbanUser(userId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  const { error } = await supabase
    .from('profiles')
    .update({
      banned_at: null,
      ban_reason: null,
      banned_by: null
    })
    .eq('id', userId);

  if (error) throw error;
  return true;
}

/**
 * Deleta um usuario (admin only)
 */
export async function deleteUser(userId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  // Deleta notas do usuario
  await supabase.from('notes').delete().eq('user_id', userId);

  // Deleta mensagens do usuario
  await supabase.from('messages').delete().eq('sender_id', userId);
  await supabase.from('messages').delete().eq('receiver_id', userId);

  // Deleta access logs
  await supabase.from('access_logs').delete().eq('user_id', userId);

  // Deleta perfil
  const { error: profileError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', userId);

  if (profileError) throw profileError;

  // Nota: Para deletar da auth.users, precisa de service role key
  // ou chamar uma Edge Function. Aqui removemos apenas os dados.

  return true;
}

/**
 * Retorna estatisticas completas do sistema
 */
export async function getSystemStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: totalNotes } = await supabase.from('notes').select('*', { count: 'exact', head: true });
    const { count: totalMessages } = await supabase.from('messages').select('*', { count: 'exact', head: true });

    let totalAccess = 0, todayAccess = 0, weekAccess = 0, monthAccess = 0;
    try {
      const r1 = await supabase.from('access_logs').select('*', { count: 'exact', head: true });
      totalAccess = r1.count || 0;
      const r2 = await supabase.from('access_logs').select('*', { count: 'exact', head: true }).gte('accessed_at', today.toISOString());
      todayAccess = r2.count || 0;
      const r3 = await supabase.from('access_logs').select('*', { count: 'exact', head: true }).gte('accessed_at', weekAgo.toISOString());
      weekAccess = r3.count || 0;
      const r4 = await supabase.from('access_logs').select('*', { count: 'exact', head: true }).gte('accessed_at', monthAgo.toISOString());
      monthAccess = r4.count || 0;
    } catch (e) {
      // access_logs pode nao existir
    }

    const { count: newUsersToday } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString());
    const { count: newUsersWeek } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString());
    const { count: newUsersMonth } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', monthAgo.toISOString());

    return {
      totalUsers: totalUsers || 0,
      totalNotes: totalNotes || 0,
      totalMessages: totalMessages || 0,
      totalAccess: totalAccess,
      todayAccess: todayAccess,
      weekAccess: weekAccess,
      monthAccess: monthAccess,
      newUsersToday: newUsersToday || 0,
      newUsersWeek: newUsersWeek || 0,
      newUsersMonth: newUsersMonth || 0
    };
  } catch (err) {
    console.warn('Erro em getSystemStats:', err.message);
    return {
      totalUsers: 0, totalNotes: 0, totalMessages: 0,
      totalAccess: 0, todayAccess: 0, weekAccess: 0, monthAccess: 0,
      newUsersToday: 0, newUsersWeek: 0, newUsersMonth: 0
    };
  }
}

/**
 * Retorna sessoes ativas (usuarios com acesso nos ultimos 30 min)
 */
export async function getActiveSessions() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('access_logs')
      .select('user_id, page, accessed_at')
      .gte('accessed_at', thirtyMinutesAgo)
      .not('user_id', 'is', null)
      .order('accessed_at', { ascending: false });

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return [];
      }
      throw error;
    }

    // Agrupa por usuario (pega o acesso mais recente de cada um)
    const sessions = [];
    const seen = new Set();

    (data || []).forEach(log => {
      if (log.user_id && !seen.has(log.user_id)) {
        seen.add(log.user_id);
        sessions.push({
          user_id: log.user_id,
          page: log.page,
          last_access: log.accessed_at
        });
      }
    });

    // Busca perfis separadamente (SEM join!)
    if (sessions.length > 0) {
      const userIds = sessions.map(s => s.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .in('id', userIds);

      const profilesMap = new Map((profiles || []).map(p => [p.id, p]));
      sessions.forEach(s => {
        s.user = profilesMap.get(s.user_id) || { name: 'Usuario', email: '', avatar_url: null };
      });
    }

    return sessions;
  } catch (err) {
    console.warn('Erro em getActiveSessions:', err.message);
    return [];
  }
}

/**
 * Retorna atividade de um usuario especifico
 */
export async function getUserActivity(userId, limit = 50) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  try {
    const { data, error } = await supabase
      .from('access_logs')
      .select('*')
      .eq('user_id', userId)
      .order('accessed_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return [];
      }
      throw error;
    }

    return data || [];
  } catch (err) {
    console.warn('Erro em getUserActivity:', err.message);
    return [];
  }
}

/**
 * Retorna visualizacoes de paginas
 */
export async function getPageViews(days = 7) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  try {
    const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('access_logs')
      .select('page, accessed_at')
      .gte('accessed_at', daysAgo);

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return [];
      }
      throw error;
    }

    const pageViews = {};
    (data || []).forEach(log => {
      pageViews[log.page] = (pageViews[log.page] || 0) + 1;
    });

    return Object.entries(pageViews)
      .map(([page, views]) => ({ page, views }))
      .sort((a, b) => b.views - a.views);
  } catch (err) {
    console.warn('Erro em getPageViews:', err.message);
    return [];
  }
}

/**
 * Retorna logs de erro (se houver tabela error_logs)
 */
export async function getErrorLogs(limit = 50) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  const { data, error } = await supabase
    .from('error_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    // Se a tabela nao existir, retorna array vazio
    if (error.message.includes('does not exist')) {
      return [];
    }
    console.error('Erro ao buscar logs:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Verifica se o usuario atual eh admin
 */
export async function isAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error || !data) return false;
  return data.role === 'admin' || data.role === 'superadmin';
}

// ===== ANALYTICS / ESTATISTICAS DO ADMIN =====
// ============================================================

/**
 * Retorna estatisticas de acesso por hora (ultimas 24h)
 * Requer tabela 'access_logs' com colunas: id, user_id, page, accessed_at
 */

/**
 * Retorna estatisticas de acesso por hora (ultimas 24h)
 * Requer tabela 'access_logs' com colunas: id, user_id, page, accessed_at
 */
export async function getAccessStatsByHour() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('access_logs')
      .select('accessed_at')
      .gte('accessed_at', twentyFourHoursAgo)
      .order('accessed_at', { ascending: true });

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.warn('Tabela access_logs nao existe. Retornando dados vazios.');
        return Array.from({length: 24}, (_, i) => ({ hour_of_day: i, access_count: 0 }));
      }
      throw error;
    }

    // Agrupa por hora
    const hourlyStats = {};
    for (let i = 0; i < 24; i++) {
      hourlyStats[i] = 0;
    }

    (data || []).forEach(log => {
      const hour = new Date(log.accessed_at).getHours();
      hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
    });

    return Object.entries(hourlyStats).map(([hour, count]) => ({
      hour_of_day: parseInt(hour),
      access_count: count
    }));
  } catch (err) {
    console.warn('Erro em getAccessStatsByHour:', err.message);
    return Array.from({length: 24}, (_, i) => ({ hour_of_day: i, access_count: 0 }));
  }
}
/**
 * Retorna estatisticas do dia atual
 */
export async function getTodayStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const { data, error } = await supabase
      .from('access_logs')
      .select('*', { count: 'exact' })
      .gte('accessed_at', todayISO);

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return { total: 0, uniqueUsers: 0 };
      }
      throw error;
    }

    const uniqueUsers = new Set((data || []).map(log => log.user_id)).size;

    return {
      total: data?.length || 0,
      uniqueUsers
    };
  } catch (err) {
    console.warn('Erro em getTodayStats:', err.message);
    return { total: 0, uniqueUsers: 0 };
  }
}

/**
 * Retorna estatisticas de acesso gerais
 */
export async function getAccessStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [{ count: totalCount }, { count: todayCount }, { count: weekCount }, { count: monthCount }] = await Promise.all([
      supabase.from('access_logs').select('*', { count: 'exact', head: true }),
      supabase.from('access_logs').select('*', { count: 'exact', head: true }).gte('accessed_at', today.toISOString()),
      supabase.from('access_logs').select('*', { count: 'exact', head: true }).gte('accessed_at', weekAgo.toISOString()),
      supabase.from('access_logs').select('*', { count: 'exact', head: true }).gte('accessed_at', monthAgo.toISOString())
    ]);

    return {
      total: totalCount || 0,
      today: todayCount || 0,
      week: weekCount || 0,
      month: monthCount || 0
    };
  } catch (err) {
    console.warn('Erro em getAccessStats:', err.message);
    return { total: 0, today: 0, week: 0, month: 0 };
  }
}

/**
 * Retorna estatisticas diarias (ultimos 7 dias)
 */
export async function getDailyStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('access_logs')
      .select('accessed_at')
      .gte('accessed_at', sevenDaysAgo)
      .order('accessed_at', { ascending: true });

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return Array.from({length: 7}, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return { date: d.toISOString().split('T')[0], count: 0 };
        });
      }
      throw error;
    }

    const dailyStats = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dailyStats[key] = 0;
    }

    (data || []).forEach(log => {
      const date = new Date(log.accessed_at).toISOString().split('T')[0];
      dailyStats[date] = (dailyStats[date] || 0) + 1;
    });

    return Object.entries(dailyStats)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    console.warn('Erro em getDailyStats:', err.message);
    return [];
  }
}

/**
 * Retorna estatisticas semanais
 */
export async function getWeeklyStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  try {
    const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('access_logs')
      .select('accessed_at')
      .gte('accessed_at', fourWeeksAgo);

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return [];
      }
      throw error;
    }

    const weeklyStats = {};
    (data || []).forEach(log => {
      const date = new Date(log.accessed_at);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const key = weekStart.toISOString().split('T')[0];
      weeklyStats[key] = (weeklyStats[key] || 0) + 1;
    });

    return Object.entries(weeklyStats)
      .map(([week, count]) => ({ week, count }))
      .sort((a, b) => a.week.localeCompare(b.week));
  } catch (err) {
    console.warn('Erro em getWeeklyStats:', err.message);
    return [];
  }
}

/**
 * Retorna estatisticas mensais
 */
export async function getMonthlyStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  try {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const { data, error } = await supabase
      .from('access_logs')
      .select('accessed_at')
      .gte('accessed_at', twelveMonthsAgo.toISOString());

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return [];
      }
      throw error;
    }

    const monthlyStats = {};
    (data || []).forEach(log => {
      const date = new Date(log.accessed_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyStats[key] = (monthlyStats[key] || 0) + 1;
    });

    return Object.entries(monthlyStats)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));
  } catch (err) {
    console.warn('Erro em getMonthlyStats:', err.message);
    return [];
  }
}

/**
 * Retorna estatisticas de usuarios
 */
export async function getUserStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  const [{ count: totalUsers }, { count: activeToday }, { count: newThisWeek }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('access_logs').select('*', { count: 'exact', head: true }).gte('accessed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  ]);

  return {
    totalUsers: totalUsers || 0,
    activeToday: activeToday || 0,
    newThisWeek: newThisWeek || 0
  };
}

/**
 * Retorna estatisticas de login
 */
export async function getLoginStats() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('access_logs')
      .select('accessed_at, page')
      .gte('accessed_at', sevenDaysAgo)
      .eq('page', 'login');

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return [];
      }
      throw error;
    }

    const loginStats = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      loginStats[key] = 0;
    }

    (data || []).forEach(log => {
      const date = new Date(log.accessed_at).toISOString().split('T')[0];
      loginStats[date] = (loginStats[date] || 0) + 1;
    });

    return Object.entries(loginStats)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    console.warn('Erro em getLoginStats:', err.message);
    return [];
  }
}

/**
 * Retorna paginas mais acessadas
 */
export async function getTopPages(limit = 10) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  try {
    const { data, error } = await supabase
      .from('access_logs')
      .select('page');

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return [];
      }
      throw error;
    }

    const pageCounts = {};
    (data || []).forEach(log => {
      pageCounts[log.page] = (pageCounts[log.page] || 0) + 1;
    });

    return Object.entries(pageCounts)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  } catch (err) {
    console.warn('Erro em getTopPages:', err.message);
    return [];
  }
}

/**
 * Registra um acesso na tabela access_logs
 */
export async function logAccess(page) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    // Se não há usuário logado, não tenta inserir
    if (!user?.id) {
      return;
    }

    const { error } = await supabase
      .from('access_logs')
      .insert([{
        user_id: user.id,
        page: page || 'page_view',
        accessed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }]);

    if (error) {
      // Silenciosamente ignora erro se tabela não existir
      if (!error.message.includes('does not exist') && error.code !== '42P01') {
        console.warn('Erro ao registrar acesso:', error.message);
      }
    }
  } catch (err) {
    // Silenciosamente ignora
  }
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

  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .eq('receiver_id', user.id)
    .eq('read', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!messages || messages.length === 0) return [];

  // Busca perfis dos remetentes separadamente
  const senderIds = [...new Set(messages.map(m => m.sender_id).filter(Boolean))];
  let profilesMap = new Map();

  if (senderIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url')
      .in('id', senderIds);

    if (!profileError && profiles) {
      profiles.forEach(p => profilesMap.set(p.id, p));
    }
  }

  // Mescla dados do remetente em cada mensagem
  return messages.map(msg => ({
    ...msg,
    sender: profilesMap.get(msg.sender_id) || { name: '', email: '', avatar_url: null }
  }));
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
