import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const app = new Hono();

app.use(
  '*',
  cors({
    credentials: true,
    origin: (origin) => origin || '*',
  })
);

app.get('/', (c) => {
  return c.json({ message: 'PayLite UPI API', version: '1.0.0' });
});

const createTransactionSchema = z.object({
  payeeVpa: z.string().min(1),
  payeeName: z.string().min(1),
  amount: z.number().positive(),
  userPhone: z.string().optional(),
});

app.post(
  '/api/transactions',
  zValidator('json', createTransactionSchema),
  async (c) => {
    const body = c.req.valid('json');

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        payee_vpa: body.payeeVpa,
        payee_name: body.payeeName,
        amount: body.amount,
        status: 'created',
        user_phone: body.userPhone || null,
      })
      .select()
      .single();

    if (error) {
      return c.json({ error: error.message }, 500);
    }

    const transaction = mapRow(data);
    return c.json({ transaction }, 201);
  }
);

app.get('/api/transactions/:id', async (c) => {
  const id = c.req.param('id');
  const { data, error } = await supabase
    .from('transactions')
    .select()
    .eq('id', id)
    .single();

  if (error || !data) {
    return c.json({ error: 'Transaction not found' }, 404);
  }

  return c.json({ transaction: mapRow(data) });
});

const confirmSchema = z.object({
  mode: z.enum(['ussd', 'ivr']),
});

app.post(
  '/api/transactions/:id/confirm',
  zValidator('json', confirmSchema),
  async (c) => {
    const id = c.req.param('id');
    const { mode } = c.req.valid('json');

    const { data: existing } = await supabase
      .from('transactions')
      .select()
      .eq('id', id)
      .single();

    if (!existing) {
      return c.json({ error: 'Transaction not found' }, 404);
    }

    if (existing.status !== 'created') {
      return c.json({ error: 'Transaction already processed' }, 400);
    }

    await supabase
      .from('transactions')
      .update({ status: 'confirmed', mode, updated_at: new Date().toISOString() })
      .eq('id', id);

    setTimeout(async () => {
      await supabase
        .from('transactions')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', id);

      setTimeout(async () => {
        const outcomes = ['success', 'success', 'success', 'pending', 'failed'];
        const finalStatus = outcomes[Math.floor(Math.random() * outcomes.length)];
        await supabase
          .from('transactions')
          .update({ status: finalStatus, updated_at: new Date().toISOString() })
          .eq('id', id);
      }, 3000);
    }, 1500);

    const transaction = mapRow({ ...existing, status: 'confirmed', mode });

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

    return c.json({
      transaction,
      instruction: mode === 'ussd'
        ? { type: 'ussd', steps: ussdSteps, message: ussdSteps.join('\n') }
        : { type: 'ivr', steps: ivrSteps, message: ivrSteps.join('\n') },
    });
  }
);

app.get('/api/transactions/:id/status', async (c) => {
  const id = c.req.param('id');
  const { data, error } = await supabase
    .from('transactions')
    .select('id, status, updated_at')
    .eq('id', id)
    .single();

  if (error || !data) {
    return c.json({ error: 'Transaction not found' }, 404);
  }

  return c.json({
    id: data.id,
    status: data.status,
    updatedAt: data.updated_at,
  });
});

app.get('/api/transactions', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') || 50), 100);
  const offset = Number(c.req.query('offset') || 0);
  const status = c.req.query('status');

  let query = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({
    transactions: (data || []).map(mapRow),
    total: count || 0,
    limit,
    offset,
  });
});

function mapRow(row: any) {
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

export default {
  fetch: app.fetch,
  port: 3002,
};
