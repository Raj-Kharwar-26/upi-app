import { Hono } from 'npm:hono@4';
import { cors } from 'npm:hono/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const app = new Hono().basePath('/functions/v1/api');

app.use('*', cors({ origin: '*', credentials: true }));

function supabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

function mapRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    payeeVpa: row.payee_vpa,
    payeeName: row.payee_name,
    amount: Number(row.amount),
    status: row.status,
    mode: row.mode,
    userPhone: row.user_phone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

app.get('/', (c) => c.json({ message: 'PayLite UPI API', version: '1.0.0' }));

app.post('/transactions', async (c) => {
  const body = await c.req.json();
  const { payeeVpa, payeeName, amount, userPhone } = body;
  if (!payeeVpa || !payeeName || !amount) {
    return c.json({ error: 'Missing required fields' }, 400);
  }
  const supabase = supabaseClient();
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      payee_vpa: payeeVpa,
      payee_name: payeeName,
      amount: Number(amount),
      status: 'created',
      user_phone: userPhone || null,
    })
    .select()
    .single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ transaction: mapRow(data as Record<string, unknown>) }, 201);
});

app.get('/transactions/:id', async (c) => {
  const id = c.req.param('id');
  const supabase = supabaseClient();
  const { data, error } = await supabase.from('transactions').select().eq('id', id).single();
  if (error || !data) return c.json({ error: 'Transaction not found' }, 404);
  return c.json({ transaction: mapRow(data as Record<string, unknown>) });
});

app.post('/transactions/:id/confirm', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const mode = body.mode as 'ussd' | 'ivr';
  if (!mode || !['ussd', 'ivr'].includes(mode)) {
    return c.json({ error: 'Invalid mode' }, 400);
  }
  const supabase = supabaseClient();
  const { data: existing } = await supabase.from('transactions').select().eq('id', id).single();
  if (!existing) return c.json({ error: 'Transaction not found' }, 404);
  if (existing.status !== 'created') return c.json({ error: 'Transaction already processed' }, 400);

  await supabase
    .from('transactions')
    .update({ status: 'confirmed', mode, updated_at: new Date().toISOString() })
    .eq('id', id);

  EdgeRuntime.waitUntil(
    (async () => {
      await new Promise((r) => setTimeout(r, 1500));
      const sb = supabaseClient();
      await sb.from('transactions').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', id);
      await new Promise((r) => setTimeout(r, 3000));
      const outcomes = ['success', 'success', 'success', 'pending', 'failed'];
      const finalStatus = outcomes[Math.floor(Math.random() * outcomes.length)];
      await sb.from('transactions').update({ status: finalStatus, updated_at: new Date().toISOString() }).eq('id', id);
    })()
  );

  const ussdSteps = [
    'Dial *99# from the SIM linked to your bank account.',
    'Select Option 1 → "Send Money".',
    `Choose "UPI ID" and enter: ${existing.payee_vpa}`,
    `Enter amount: ₹${existing.amount}`,
    'Enter a remark or press 1 to skip.',
    'Enter your UPI PIN to authorize the payment.',
    'You will see a confirmation message and receive an SMS.',
  ];
  const ivrSteps = [
    'Call 080-4516-3666 from your registered mobile number.\n(SBI, HDFC, ICICI, Axis, IDFC First)\nOr call 6366-200-200 (Canara, PNB, NSDL)',
    'Select your preferred language.',
    'Choose "Money Transfer" or "Send Money".',
    `Enter recipient mobile number or UPI ID: ${existing.payee_vpa}`,
    `Enter amount: ₹${existing.amount}`,
    'Enter your UPI PIN using the keypad to authorize.',
    'You will hear a confirmation and receive an SMS.',
  ];
  const transaction = mapRow({ ...existing as Record<string, unknown>, status: 'confirmed', mode });
  return c.json({
    transaction,
    instruction: mode === 'ussd'
      ? { type: 'ussd', steps: ussdSteps, message: ussdSteps.join('\n') }
      : { type: 'ivr', steps: ivrSteps, message: ivrSteps.join('\n') },
  });
});

app.get('/transactions/:id/status', async (c) => {
  const id = c.req.param('id');
  const supabase = supabaseClient();
  const { data, error } = await supabase
    .from('transactions')
    .select('id, status, updated_at')
    .eq('id', id)
    .single();
  if (error || !data) return c.json({ error: 'Transaction not found' }, 404);
  return c.json({ id: data.id, status: data.status, updatedAt: data.updated_at });
});

app.get('/transactions', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') || 50), 100);
  const offset = Number(c.req.query('offset') || 0);
  const status = c.req.query('status');
  const supabase = supabaseClient();
  let query = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (status) query = query.eq('status', status);
  const { data, error, count } = await query;
  if (error) return c.json({ error: error.message }, 500);
  return c.json({
    transactions: (data || []).map((r) => mapRow(r as Record<string, unknown>)),
    total: count || 0,
    limit,
    offset,
  });
});

Deno.serve(app.fetch);
