// Supabase Edge Function: delete-user
// Arquivo: supabase/functions/delete-user/index.ts

import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId } = await req.json()

    // Cria cliente admin com service_role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verifica se o solicitante é admin
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user || user.email !== 'admin@wayforsystem.med') {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Deleta notas do usuário
    await supabaseAdmin.from('notes').delete().eq('user_id', userId)

    // Deleta mensagens do usuário
    await supabaseAdmin.from('messages').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)

    // Deleta logs de acesso do usuário
    await supabaseAdmin.from('access_logs').delete().eq('user_id', userId)

    // Deleta profile do usuário
    await supabaseAdmin.from('profiles').delete().eq('id', userId)

    // Deleta o usuário do auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) throw deleteError

    return new Response(JSON.stringify({ success: true, message: 'Usuário excluído com sucesso' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
