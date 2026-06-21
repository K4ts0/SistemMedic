-- ============================================
-- WAY FOR SYSTEM - SETUP DO USUÁRIO ADMIN
-- ============================================

-- 1. Criar o usuário admin via Supabase Auth (faça isso pelo Dashboard ou API)
-- Email: admin@wayforsystem.med
-- Senha: QryqZV3tQsPRWqZhtu299w

-- 2. Garantir que o profile do admin tenha dados completos
UPDATE public.profiles 
SET 
  name = 'Administrador do Sistema',
  specialty = 'Administração',
  crm = 'ADMIN-001',
  updated_at = NOW()
WHERE email = 'admin@wayforsystem.med';

-- 3. Criar tabela de logs de acesso (opcional, para analytics reais)
CREATE TABLE IF NOT EXISTS public.access_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Habilitar RLS na tabela de logs
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- 5. Política para admin ver todos os logs
CREATE POLICY "Admin can view all logs" ON public.access_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.email = 'admin@wayforsystem.med'
    )
  );

-- 6. Função para registrar acesso (chamar no login)
CREATE OR REPLACE FUNCTION public.log_access()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.access_logs (user_id, action, created_at)
  VALUES (NEW.id, 'login', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Trigger para logar logins (opcional)
-- CREATE TRIGGER on_auth_user_login
--   AFTER UPDATE OF last_sign_in_at ON auth.users
--   FOR EACH ROW
--   WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
--   EXECUTE FUNCTION public.log_access();

-- ============================================
-- EDGE FUNCTION PARA EXCLUSÃO SEGURA (Recomendado)
-- ============================================

-- Crie uma Edge Function no Supabase com o seguinte código:
/*
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, adminEmail } = await req.json()

    // Verifica se quem está solicitando é o admin
    if (adminEmail !== 'admin@wayforsystem.med') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Deleta o usuário do auth
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (error) throw error

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
*/
