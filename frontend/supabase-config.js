// supabase-config.js — NoteMed for Unisystem v2.0
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://zqwuzytzeytpypbpiads.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxd3V6eXR6ZXl0cHlwYnBpYWRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NDYxNTAsImV4cCI6MjA5NzIyMjE1MH0.51RDmGcO2b_Dvq-iW98OX3GKv6xeO9vlgwQHuRW3omA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== AUTENTICAÇÃO =====
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

// ===== PERFIL DO USUÁRIO =====
export async function getUserProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');
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
  if (!user) throw new Error('Usuário não autenticado');

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

// ===== CHAT =====
export async function getChatUsers() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  // Busca todos os usuários exceto o atual
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, specialty')
    .neq('id', user.id);

  if (error) throw error;
  return data || [];
}

export async function sendMessage(receiverId, content) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

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
  if (!user) throw new Error('Usuário não autenticado');

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
  // Helper para o subscribe
  return supabase.auth.getUser().then(({ data }) => data.user?.id);
}

// ===== CID / PRESCRIÇÃO (dados locais) =====
export const CID_DATABASE = {
  'A00': { name: 'Cólera', desc: 'Doença diarreica aguda causada por Vibrio cholerae.', prescriptions: ['Reidratação oral (ORS)', 'Azitromicina 1g dose única', 'Zinco 20mg/dia (crianças)'] },
  'A01': { name: 'Febre Tifóide', desc: 'Infecção sistêmica causada por Salmonella typhi.', prescriptions: ['Azitromicina 500mg 1x/dia x 7 dias', 'Ciprofloxacino 500mg 2x/dia x 10 dias', 'Repouso e hidratação'] },
  'A02': { name: 'Outras infecções por Salmonella', desc: 'Gastroenterite não tifóide por Salmonella.', prescriptions: ['Ciprofloxacino 500mg 2x/dia x 5-7 dias', 'Hidratação oral', 'Dieta leve'] },
  'A09': { name: 'Gastroenterite e colite de origem infecciosa', desc: 'Diarreia infecciosa aguda.', prescriptions: ['ORS - Soro caseiro', 'Loperamida 2mg (adultos)', 'Probióticos', 'Zinco (crianças)'] },
  'B01': { name: 'Varicela', desc: 'Infecção por vírus varicela-zoster.', prescriptions: ['Aciclovir 800mg 5x/dia x 7 dias', 'Calamina tópica', 'Dipirona 1g para febre'] },
  'B02': { name: 'Herpes Zoster', desc: 'Reativação do VZV (cobreiro).', prescriptions: ['Aciclovir 800mg 5x/dia x 7-10 dias', 'Amitriptilina 25mg para neuralgia', 'Analgésicos'] },
  'B35': { name: 'Dermatofitose', desc: 'Micose superficial (tinea).', prescriptions: ['Terbinafina 250mg 1x/dia x 2-4 semanas', 'Cetoconazol creme 2x/dia', 'Miconazol tópico'] },
  'E10': { name: 'Diabetes Mellitus tipo 1', desc: 'Deficiência absoluta de insulina.', prescriptions: ['Insulina regular (basal-bolus)', 'Monitorização glicêmica', 'Metformina (adjuvante)'] },
  'E11': { name: 'Diabetes Mellitus tipo 2', desc: 'Resistência à insulina com defeito secretor.', prescriptions: ['Metformina 850mg 2x/dia', 'Glibenclamida 5mg 1x/dia', 'Sinvastatina 20mg', 'Controle glicêmico'] },
  'E66': { name: 'Obesidade', desc: 'IMC ≥ 30 kg/m².', prescriptions: ['Orlistate 120mg 3x/dia', 'Dieta hipocalórica', 'Exercício físico', 'Acompanhamento nutricional'] },
  'F32': { name: 'Episódio depressivo', desc: 'Transtorno depressivo maior.', prescriptions: ['Sertralina 50mg 1x/dia', 'Fluoxetina 20mg 1x/dia', 'Psicoterapia', 'Atividade física'] },
  'F41': { name: 'Transtorno de ansiedade generalizada', desc: 'TAG - ansiedade excessiva persistente.', prescriptions: ['Sertralina 50mg 1x/dia', 'Clonazepam 0,5mg (curto prazo)', 'Terapia cognitivo-comportamental'] },
  'G40': { name: 'Epilepsia', desc: 'Distúrbio neurológico crônico com crises recorrentes.', prescriptions: ['Fenitoína 100mg 3x/dia', 'Carbamazepina 200mg 2x/dia', 'Ácido valpróico 500mg 2x/dia'] },
  'H10': { name: 'Conjuntivite', desc: 'Inflamação da conjuntiva ocular.', prescriptions: ['Tobramicina colírio 3-4x/dia', 'Ciprofloxacino colírio', 'Compressas mornas'] },
  'I10': { name: 'Hipertensão Essencial', desc: 'Pressão arterial sistêmica elevada.', prescriptions: ['Losartana 50mg 1x/dia', 'Amlodipino 5mg 1x/dia', 'Hidroclorotiazida 25mg', 'Restrição de sódio'] },
  'I20': { name: 'Angina Pectoris', desc: 'Dor torácica por isquemia miocárdica.', prescriptions: ['Nitroglicerina SL (crise)', 'AAS 100mg 1x/dia', 'Atorvastatina 40mg', 'Metoprolol 50mg 2x/dia'] },
  'I50': { name: 'Insuficiência Cardíaca', desc: 'Incapacidade do coração de bombear adequadamente.', prescriptions: ['Enalapril 10mg 2x/dia', 'Furosemida 40mg 1x/dia', 'Espironolactona 25mg', 'Repouso'] },
  'J06': { name: 'Infecções agudas das vias aéreas superiores', desc: 'Resfriado comum, faringite, amigdalite.', prescriptions: ['Dipirona 1g (febre/dor)', 'Loratadina 10mg 1x/dia', 'Xarope expectorante', 'Repouso e hidratação'] },
  'J18': { name: 'Pneumonia', desc: 'Infecção dos pulmões.', prescriptions: ['Azitromicina 500mg 1x/dia x 5 dias', 'Amoxicilina 1g 3x/dia x 7 dias', 'Ambroxol xarope', 'Oxigênio (se necessário)'] },
  'J45': { name: 'Asma', desc: 'Doença inflamatória crônica das vias aéreas.', prescriptions: ['Salbutamol inalador (resgate)', 'Budesonida inalador (manutenção)', 'Montelucaste 10mg 1x/noite'] },
  'K29': { name: 'Gastrite e duodenite', desc: 'Inflamação da mucosa gástrica/duodenal.', prescriptions: ['Omeprazol 20mg 1x/dia', 'Ranitidina 150mg 2x/dia', 'Sucralfato 1g 4x/dia', 'Dieta branda'] },
  'L20': { name: 'Dermatite atópica', desc: 'Eczema crônico com prurido.', prescriptions: ['Hidrocortisona creme 1%', 'Cetirizina 10mg 1x/dia', 'Emolientes', 'Evitar alérgenos'] },
  'M06': { name: 'Artrite reumatoide', desc: 'Doença autoimune das articulações.', prescriptions: ['Metotrexato 15mg/semana', 'Prednisona 5mg 1x/dia', 'AAS 100mg', 'Fisioterapia'] },
  'M79': { name: 'Outras afecções dos tecidos moles', desc: 'Dores musculares, fibromialgia.', prescriptions: ['Paracetamol 750mg 3x/dia', 'Ciclobenzaprina 10mg 1x/noite', 'Fisioterapia', 'Alongamento'] },
  'N18': { name: 'Doença renal crônica', desc: 'Redução progressiva da função renal.', prescriptions: ['Losartana 50mg', 'Furosemida 40mg', 'Eritropoetina', 'Restrição de proteínas'] },
  'N39': { name: 'Outras afecções do trato urinário', desc: 'Infecção urinária, cistite.', prescriptions: ['Nitrofurantoína 100mg 2x/dia x 7 dias', 'Ciprofloxacino 500mg 2x/dia', 'Hidratação abundante'] },
  'O80': { name: 'Parto único espontâneo', desc: 'Parto vaginal normal.', prescriptions: ['Oxitocina (se necessário)', 'Analgesia peridural', 'Acompanhamento obstétrico'] },
  'R50': { name: 'Febre de origem desconhecida', desc: 'Febre sem causa identificada.', prescriptions: ['Dipirona 1g (sintomático)', 'Paracetamol 750mg', 'Investigação diagnóstica'] },
  'S72': { name: 'Fratura do fêmur', desc: 'Fratura do osso da coxa.', prescriptions: ['Analgésicos (morfina se necessário)', 'Imobilização', 'Cirurgia ortopédica'] },
  'Z00': { name: 'Exame geral de saúde', desc: 'Consulta de rotina/check-up.', prescriptions: ['Exames laboratoriais', 'Avaliação clínica completa', 'Orientações preventivas'] },
  'Z51': { name: 'Cuidados médicos por radioterapia/quimioterapia', desc: 'Tratamento oncológico.', prescriptions: ['Protocolo oncológico específico', 'Antieméticos', 'Suporte hematológico'] }
};

export function searchCID(query) {
  query = query.toUpperCase().trim();
  if (!query) return [];

  const results = [];
  for (const [code, data] of Object.entries(CID_DATABASE)) {
    if (code.includes(query) || data.name.toUpperCase().includes(query)) {
      results.push({ code, ...data });
    }
  }
  return results;
}

export function getCID(code) {
  const data = CID_DATABASE[code.toUpperCase()];
  return data ? { code: code.toUpperCase(), ...data } : null;
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


// ===== NOTIFICAÇÕES =====
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

// ===== BUSCAR USUÁRIO POR ID =====
export async function findUserById(userId) {
  // 1️⃣ VERIFICAR SESSÃO ATIVA ANTES DE BUSCAR
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.error('❌ Usuário não autenticado - não pode buscar profiles');
    throw new Error('Você precisa estar logado para buscar usuários');
  }

  // 2️⃣ FAZER A REQUISIÇÃO COM AUTENTICAÇÃO
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, specialty')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Erro ao buscar usuário:', error.message, error.details, error.hint);
    // Se não encontrar na tabela profiles, retorna null
    return null;
  }
  
  return data;
}

export async function searchUserByPartialId(partialId) {
  // 1️⃣ VERIFICAR SESSÃO ATIVA
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.error('❌ Usuário não autenticado');
    throw new Error('Você precisa estar logado para buscar usuários');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, specialty')
    .ilike('id', `%${partialId}%`)
    .limit(10);

  if (error) {
    console.error('Erro na busca parcial:', error.message);
    throw error;
  }
  
  return data || [];
}

export async function checkSingleSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const storedSession = localStorage.getItem('session_id');
  const serverSession = user.user_metadata?.session_id;
  if (serverSession && storedSession && serverSession !== storedSession) {
    await signOut();
    localStorage.removeItem('session_id');
    alert('⚠️ Sua sessão foi encerrada porque você fez login em outro dispositivo.');
    window.location.href = 'index.html';
    return false;
   return true;
  }
  
  // ===== BUSCAR USUÁRIO POR NOME/EMAIL/ID =====
export async function findUserById(userId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Você precisa estar logado para buscar usuários');
  }

  // Se parece UUID completo, busca exato
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (uuidRegex.test(userId)) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url, specialty')
      .eq('id', userId)
      .single();
    
    if (error) return null;
    return data;
  }
  
  // Se não for UUID, busca por nome ou email
  return null; // delega para searchUserByPartialId
}

export async function searchUserByPartialId(partialId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Você precisa estar logado para buscar usuários');
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, specialty')
    .or(`name.ilike.%${partialId}%,email.ilike.%${partialId}%`)
    .limit(10);

  if (error) {
    console.error('Erro na busca:', error.message);
    throw error;
  }
  
  return data || [];
}
}
