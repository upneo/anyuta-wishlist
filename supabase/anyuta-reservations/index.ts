const items = new Set([
  "shirt", "cosmetics", "pancho", "shrek", "deepins", "instax", "action-camera",
  "minion-plush", "minion-mug", "minion-keychain", "minion-accessories",
  "minion-slippers", "minion-bottle",
]);

const cors = {
  "Access-Control-Allow-Origin": "https://upneo.github.io",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: cors });
}

async function hash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, "0")).join("");
}

async function payload(request: Request) {
  try {
    const body = await request.json();
    return body && typeof body.itemKey === "string" && items.has(body.itemKey) ? body : null;
  } catch {
    return null;
  }
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const url = Deno.env.get("SUPABASE_URL");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !secret) return json({ error: "Бронь временно недоступна" }, 503);

  const endpoint = `${url}/rest/v1/anyuta_reservations`;
  const headers = {
    apikey: secret,
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  };

  try {
    if (request.method === "GET") {
      const response = await fetch(`${endpoint}?select=item_key`, { headers, cache: "no-store" });
      if (!response.ok) throw new Error(`Read failed: ${response.status}`);
      const rows = await response.json() as { item_key: string }[];
      return json({ reserved: rows.map(row => row.item_key) });
    }

    if (request.method === "POST") {
      const body = await payload(request);
      if (!body) return json({ error: "Неизвестный подарок" }, 400);
      const token = crypto.randomUUID() + crypto.randomUUID();
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ item_key: body.itemKey, token_hash: await hash(token) }),
      });
      if (response.status === 409) return json({ error: "Подарок уже занят" }, 409);
      if (!response.ok) throw new Error(`Insert failed: ${response.status}`);
      return json({ itemKey: body.itemKey, token }, 201);
    }

    if (request.method === "DELETE") {
      const body = await payload(request);
      if (!body || typeof body.token !== "string" || body.token.length < 20 || body.token.length > 150)
        return json({ error: "Не удалось подтвердить бронь" }, 400);
      const query = `?item_key=eq.${encodeURIComponent(body.itemKey)}&token_hash=eq.${await hash(body.token)}&select=item_key`;
      const response = await fetch(endpoint + query, {
        method: "DELETE",
        headers: { ...headers, Prefer: "return=representation" },
      });
      if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
      const deleted = await response.json() as { item_key: string }[];
      if (!deleted.length) return json({ error: "Бронь не найдена на этом устройстве" }, 403);
      return json({ itemKey: body.itemKey, released: true });
    }

    return json({ error: "Метод не поддерживается" }, 405);
  } catch (error) {
    console.error(error);
    return json({ error: "Не удалось связаться с бронями" }, 503);
  }
});
