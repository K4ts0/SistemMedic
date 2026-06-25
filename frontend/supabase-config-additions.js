// supabase-config-addition.js — Funções adicionais de analytics e logs
// VERSÃO CORRIGIDA: Usa queries diretas em vez de RPC (compatível com banco atual)
// Nota: Importe este arquivo OU copie as funções para o supabase-config.js principal

import { supabase } from './supabase-config.js';

const ADMIN_EMAIL = 'admin@wayforsystem.med';

// ===== ANALYTICS / LOGS DE ACESSO (CORRIGIDO - SEM RPC) =====

/**
 * Registra um acesso do usuário atual
 * Deve ser chamado em cada página carregada
 * VERSÃO CORRIGIDA: Usa insert direto na tabela access_logs em vez de RPC
 */
export async function logAccessAddition(action = 'page_view', pagePath = null) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const sessionId = localStorage.getItem('session_id');
    const path = pagePath || window.location.pathname;

    // Não registra se não há usuário logado
    if (!user?.id) {
      return { success: false, reason: 'no_user' };
    }

    // Não registra acesso do admin
    if (user.email === ADMIN_EMAIL) {
      return { success: false, reason: 'admin_excluded' };
    }

    const { error } = await supabase
      .from('access_logs')
      .insert([{
        user_id: user.id,
        page: path,
        action: action,
        session_id: sessionId,
        accessed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }]);

    if (error) {
      // Silenciosamente ignora se tabela não existir
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('[logAccess] Tabela access_logs não existe.');
        return { success: false, reason: 'table_not_found' };
      }
      // Silenciosamente ignora erro de permissão (RLS)
      if (error.code === '42501' || error.message?.includes('permission denied')) {
        console.warn('[logAccess] Permissão negada (RLS).');
        return { success: false, reason: 'permission_denied' };
      }
      console.warn('[logAccess] Erro:', error.message);
      return { success: false, reason: 'error', error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.warn('[logAccess] Erro inesperado:', err?.message || err);
    return { success: false, reason: 'exception', error: err?.message };
  }
}

/**
 * Busca estatísticas de acesso por hora (últimas 24h)
 * Apenas admin
 * VERSÃO CORRIGIDA: Query direta em vez de RPC
 */
export async function getAccessStatsByHourAddition() {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Pega ID do admin para filtrar
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', ADMIN_EMAIL)
      .single();

    const adminId = adminProfile?.id;

    let query = supabase
      .from('access_logs')
      .select('accessed_at, user_id')
      .gte('accessed_at', twentyFourHoursAgo);

    if (adminId) {
      query = query.neq('user_id', adminId);
    }

    const { data, error } = await query.order('accessed_at', { ascending: true });

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return Array.from({length: 24}, (_, i) => ({ hour_of_day: i, access_count: 0 }));
      }
      throw error;
    }

    // Agrupa por hora (com timezone BRT/UTC-3)
    const hourlyStats = {};
    for (let i = 0; i < 24; i++) {
      hourlyStats[i] = 0;
    }

    const hourUsers = {};
    (data || []).forEach(log => {
      const logDate = new Date(log.accessed_at);
      const localHour = (logDate.getUTCHours() - 3 + 24) % 24;

      if (!hourUsers[localHour]) hourUsers[localHour] = new Set();
      hourUsers[localHour].add(log.user_id);
    });

    for (let i = 0; i < 24; i++) {
      hourlyStats[i] = hourUsers[i] ? hourUsers[i].size : 0;
    }

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
 * Busca estatísticas de hoje
 * Apenas admin
 * VERSÃO CORRIGIDA: Query direta em vez de RPC
 */
export async function getTodayStatsAddition() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const { data, error } = await supabase
      .from('access_logs')
      .select('*', { count: 'exact' })
      .gte('accessed_at', todayISO);

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
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
 * Busca usuários online (últimos 15 minutos)
 * Apenas admin
 * VERSÃO CORRIGIDA: Query direta em vez de RPC
 */
export async function getOnlineUsersAddition() {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', ADMIN_EMAIL)
      .single();

    const adminId = adminProfile?.id;

    // TENTATIVA 1: Buscar de access_logs
    try {
      let logsQuery = supabase
        .from('access_logs')
        .select('user_id, accessed_at')
        .gte('accessed_at', fifteenMinutesAgo)
        .not('user_id', 'is', null);

      if (adminId) {
        logsQuery = logsQuery.neq('user_id', adminId);
      }

      const { data: logs, error: logsError } = await logsQuery.order('accessed_at', { ascending: false });

      if (!logsError && logs && logs.length > 0) {
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
      console.log('access_logs nao disponivel, usando fallback');
    }

    // FALLBACK: Usa profiles.updated_at
    let profileQuery = supabase
      .from('profiles')
      .select('id, name, email, avatar_url, specialty, crm, updated_at')
      .gte('updated_at', fifteenMinutesAgo);

    if (adminId) {
      profileQuery = profileQuery.neq('id', adminId);
    }

    const { data: profiles, error: profileError } = await profileQuery.order('updated_at', { ascending: false });

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

/**
 * Busca resumo do dashboard
 * Apenas admin
 * VERSÃO CORRIGIDA: Query direta em vez de view
 */
export async function getAdminSummaryAddition() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  try {
    const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: totalNotes } = await supabase.from('notes').select('*', { count: 'exact', head: true });
    const { count: totalMessages } = await supabase.from('messages').select('*', { count: 'exact', head: true });

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', ADMIN_EMAIL)
      .single();

    const adminId = adminProfile?.id;

    let onlineNow = 0;
    let todayAccess = 0;
    let peakHourToday = null;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      let query = supabase
        .from('access_logs')
        .select('*', { count: 'exact', head: true })
        .gte('accessed_at', todayISO);

      if (adminId) {
        query = query.neq('user_id', adminId);
      }

      const { count } = await query;
      todayAccess = count || 0;

      let peakQuery = supabase
        .from('access_logs')
        .select('accessed_at')
        .gte('accessed_at', todayISO);

      if (adminId) {
        peakQuery = peakQuery.neq('user_id', adminId);
      }

      const { data: hourlyData } = await peakQuery;

      if (hourlyData && hourlyData.length > 0) {
        const hourCounts = {};
        hourlyData.forEach(log => {
          const logDate = new Date(log.accessed_at);
          const localHour = (logDate.getUTCHours() - 3 + 24) % 24;
          hourCounts[localHour] = (hourCounts[localHour] || 0) + 1;
        });
        let maxCount = 0;
        for (const [hour, count] of Object.entries(hourCounts)) {
          if (count > maxCount) {
            maxCount = count;
            peakHourToday = parseInt(hour);
          }
        }
      }

      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

      let onlineQuery = supabase
        .from('access_logs')
        .select('user_id')
        .gte('accessed_at', fifteenMinutesAgo)
        .not('user_id', 'is', null);

      if (adminId) {
        onlineQuery = onlineQuery.neq('user_id', adminId);
      }

      const { data: recentLogs } = await onlineQuery;

      if (recentLogs) {
        onlineNow = new Set(recentLogs.map(l => l.user_id)).size;
      }
    } catch (e) {
      try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        let query = supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('updated_at', fiveMinutesAgo);
        if (adminId) {
          query = query.neq('id', adminId);
        }
        const { count } = await query;
        onlineNow = count || 0;
      } catch (e2) {
        onlineNow = 0;
      }
    }

    return {
      total_users: (totalUsers || 0) - (adminId ? 1 : 0),
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
 * Busca logs de acesso recentes
 * Apenas admin
 * VERSÃO CORRIGIDA: Query direta (equivalente a getRecentActivity)
 */
export async function getRecentLogsAddition(limit = 100) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario nao autenticado');

  try {
    const { data, error } = await supabase
      .from('access_logs')
      .select('id, user_id, page, action, accessed_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return [];
      }
      throw error;
    }

    // Busca perfis dos usuários
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
    console.warn('Erro em getRecentLogs:', err.message);
    return [];
  }
}

/**
 * Verifica se o usuário atual é admin
 * VERSÃO CORRIGIDA: Verifica role no banco (mais seguro)
 */
export async function isAdminAddition() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (error || !data) return false;
    return data.role === 'admin' || data.role === 'superadmin';
  } catch {
    return false;
  }
}
