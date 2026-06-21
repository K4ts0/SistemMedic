

// ===== ANALYTICS / LOGS DE ACESSO (NOVO) =====

/**
 * Registra um acesso do usuário atual
 * Deve ser chamado em cada página carregada
 */
export async function logAccess(action = 'page_view', pagePath = null) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const sessionId = localStorage.getItem('session_id');
    const path = pagePath || window.location.pathname;

    await supabase.rpc('log_access', {
      p_action: action,
      p_page_path: path,
      p_session_id: sessionId
    });
  } catch (e) {
    // Silencioso - não quebra a experiência do usuário
    console.warn('Erro ao registrar log:', e);
  }
}

/**
 * Busca estatísticas de acesso por hora (últimas 24h)
 * Apenas admin
 */
export async function getAccessStatsByHour() {
  const { data, error } = await supabase.rpc('get_access_stats_by_hour');
  if (error) throw error;
  return data || [];
}

/**
 * Busca estatísticas de hoje
 * Apenas admin
 */
export async function getTodayStats() {
  const { data, error } = await supabase.rpc('get_today_stats');
  if (error) throw error;
  return data?.[0] || null;
}

/**
 * Busca usuários online (últimos 5 minutos)
 * Apenas admin
 */
export async function getOnlineUsers() {
  const { data, error } = await supabase.rpc('get_online_users');
  if (error) throw error;
  return data || [];
}

/**
 * Busca resumo do dashboard
 * Apenas admin
 */
export async function getAdminSummary() {
  const { data, error } = await supabase
    .from('admin_dashboard_summary')
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Busca logs de acesso recentes
 * Apenas admin
 */
export async function getRecentLogs(limit = 100) {
  const { data, error } = await supabase
    .from('access_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/**
 * Verifica se o usuário atual é admin
 */
export async function isAdmin() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.email === 'admin@wayforsystem.med';
  } catch {
    return false;
  }
}
