import { NextResponse } from 'next/server';
import postgres from 'postgres';

const sql = postgres(process.env.CRM_DATABASE_URL);

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) {
    return `+${digits}`;
  } else if (digits.length === 10) {
    return `+91${digits}`;
  }
  return `+${digits}`;
}

export async function POST(request) {
  try {
    const data = await request.json();
    const phoneNormalized = normalizePhone(data.phone || '');
    
    const existing = await sql`
      SELECT id FROM lead WHERE dedup_key = ${phoneNormalized}
    `;
    
    if (existing.length > 0) {
      return NextResponse.json({ status: 'duplicate', lead_id: existing[0].id });
    }
    
    const result = await sql`
      INSERT INTO lead (name, phone, email, address, course_interest, utm_source, utm_medium, utm_campaign, status, dedup_key)
      VALUES (${data.name}, ${data.phone}, ${data.email}, ${data.address}, ${data.course_interest}, ${data.utm_source}, ${data.utm_medium}, ${data.utm_campaign}, 'new', ${phoneNormalized})
      RETURNING id
    `;
    
    await sql`
      INSERT INTO audit_log (action, entity, payload)
      VALUES ('create', 'lead', ${'{"source": "website"}'})
    `;
    
    return NextResponse.json({ status: 'created', lead_id: result[0].id });
  } catch (error) {
    console.error('Lead ingestion error:', error);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}
