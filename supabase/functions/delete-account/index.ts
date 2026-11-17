// Edge Function (Deno): exclui a conta do usuário logado e todos os dados dele.
// Deploy: supabase functions deploy delete-account
// Usa a service_role APENAS no servidor (variável de ambiente da função), nunca no app.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'server_misconfigured' }, 500);

  // Identifica o usuário pelo token enviado pelo app.
  const asUser = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data, error } = await asUser.auth.getUser();
  if (error || !data.user) return json({ error: 'not_authenticated' }, 401);

  const { error: dataError } = await asUser.rpc('delete_my_cloud_data');
  if (dataError) return json({ error: 'delete_data_failed' }, 500);

  const admin = createClient(url, serviceKey);
  const { error: userError } = await admin.auth.admin.deleteUser(data.user.id);
  if (userError) return json({ error: 'delete_user_failed' }, 500);

  return json({ ok: true });
});
