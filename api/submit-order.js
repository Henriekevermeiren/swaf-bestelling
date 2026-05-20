export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { date, notes, categories } = req.body;

  const RESEND_API_KEY   = process.env.RESEND_API_KEY;
  const NOTION_API_KEY   = process.env.NOTION_API_KEY;
  const NOTION_DB_ID     = process.env.NOTION_DB_ID;

  // ── 1. Send notification email via Resend ──
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Wijnbar SWAF <onboarding@resend.dev>',
        to: ['henrieke@consumerhouse.be', 'wijnbarswaf@gmail.com', 'dirk@consumerhouse.be'],
        subject: `🍷 Nieuwe bestelling ontvangen — ${date}`,
        html: `
          <div style="font-family:Georgia,serif;max-width:500px;margin:0 auto;background:#fff;">
            <div style="background:#1a0a00;padding:24px 32px;text-align:center;">
              <p style="color:#c9a96e;font-size:24px;margin:0">🍷</p>
              <h1 style="color:#c9a96e;font-size:18px;margin:8px 0 4px;font-weight:normal;letter-spacing:2px;">NIEUWE BESTELLING</h1>
              <p style="color:#a07850;font-size:12px;margin:0;">Ingediend op ${date}</p>
            </div>
            <div style="padding:24px 32px;text-align:center;">
              <p style="color:#3a2010;font-size:14px;line-height:1.7;">
                Er is een nieuwe weekbestelling ingediend via het bestelsysteem.<br>
                Bekijk de details in Notion om te beoordelen en goed te keuren.
              </p>
              <a href="https://notion.so" style="display:inline-block;margin-top:16px;background:#1a0a00;color:#c9a96e;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:12px;letter-spacing:2px;">OPEN NOTION →</a>
            </div>
            <div style="background:#fdf6f0;padding:12px 32px;text-align:center;border-top:1px solid #e8d5c4;">
              <p style="color:#a07850;font-size:11px;margin:0;">Wijnbar SWAF — automatisch bestelsysteem</p>
            </div>
          </div>
        `
      })
    });
  } catch (err) {
    console.error('Resend error:', err);
    // Don't block — still try to save to Notion
  }

  // ── 2. Create Notion page ──
  try {
    // Build the order title
    const title = `Bestelling ${date}`;

    // Format each category as a text block
    const formatCategory = (items) => items.length > 0 ? items.join('\n') : '—';

    const notionBody = {
      parent: { database_id: NOTION_DB_ID },
      properties: {
        Bestelling: { title: [{ text: { content: title } }] },
        Status: { select: { name: '⏳ Wacht op goedkeuring' } },
        Datum: { date: { start: new Date().toISOString().split('T')[0] } },
        Opmerkingen: { rich_text: [{ text: { content: notes || '' } }] },
        'Snacks & Frituur': { rich_text: [{ text: { content: formatCategory(categories['Snacks & Frituur'] || []) } }] },
        'Sauzen':           { rich_text: [{ text: { content: formatCategory(categories['Sauzen'] || []) } }] },
        'Drank & Koffie':   { rich_text: [{ text: { content: formatCategory(categories['Drank & Koffie'] || []) } }] },
        'Koffie Accessoires': { rich_text: [{ text: { content: formatCategory(categories['Koffie Accessoires'] || []) } }] },
        'Kaas':             { rich_text: [{ text: { content: formatCategory(categories['Kaas'] || []) } }] },
        'Charcuterie':      { rich_text: [{ text: { content: formatCategory(categories['Charcuterie'] || []) } }] },
        'Groenten & Overige': { rich_text: [{ text: { content: formatCategory(categories['Groenten & Overige'] || []) } }] },
        'Huishouden':       { rich_text: [{ text: { content: formatCategory(categories['Huishouden'] || []) } }] },
      }
    };

    const notionRes = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify(notionBody)
    });

    if (!notionRes.ok) {
      const err = await notionRes.json();
      console.error('Notion error:', err);
      return res.status(500).json({ error: 'Notion failed', details: err });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Notion error:', err);
    return res.status(500).json({ error: 'Failed to save to Notion' });
  }
}
