// Yemek fotoğrafından porsiyon (gram), kalori ve makro tahmini.
// Çağıran: Bulut uygulaması (anonim Supabase kullanıcısı, JWT doğrulanır).
// Gizli anahtar: ANTHROPIC_API_KEY (supabase secrets set ile; uygulamaya asla girmez).

import { withSupabase } from '@supabase/server';
import Anthropic from '@anthropic-ai/sdk';

const GUNLUK_LIMIT = Number(Deno.env.get('FOTO_GUNLUK_LIMIT') ?? '30');
const MAKS_BASE64 = 5 * 1024 * 1024; // Claude görsel limiti 5 MB
const IZINLI_TURLER = ['image/jpeg', 'image/png', 'image/webp'] as const;

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

const SISTEM = `Sen bir beslenme uzmanısın. Kullanıcı bir yemek fotoğrafı gönderir; tabaktaki her yiyeceği ayrı ayrı belirleyip porsiyonunu ve besin değerlerini tahmin edersin.

- Yemek adlarını Türkçe ve yaygın kullanılan haliyle yaz (ör. "Mercimek çorbası", "Izgara köfte", "Bulgur pilavı").
- Gramajı görsel ipuçlarından tahmin et: tabak (standart yemek tabağı ~26 cm), çatal-kaşık, bardak, ekmek dilimi gibi referansları kullan. Görünen porsiyonu tahmin et, standart porsiyonu değil.
- Kalori ve makroları (protein, karbonhidrat, yağ; gram cinsinden) o gramaj için ver. Pişirme yöntemini (kızartma, yağ, sos) hesaba kat.
- İçecekleri de dahil et; su ve şekersiz çay/kahve 0 kcal'dir.
- Kullanıcı not eklediyse (ör. "yarısını yedim", "zeytinyağlı") ona göre düzelt.
- Fotoğrafta yiyecek yoksa "yemekler" listesini boş bırak ve "not" alanında açıkla.
- "guven": görüntü net ve yiyecekler belirginse "yuksek", porsiyon veya içerik belirsizse "orta", çok tahmine dayalıysa "dusuk".
- "not": kullanıcıya tek cümlelik kısa bir açıklama (ör. gizli yağ/sos uyarısı). Gerekmiyorsa boş bırak.`;

const SEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['yemekler', 'guven', 'not'],
  properties: {
    yemekler: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['ad', 'gram', 'kcal', 'protein', 'karb', 'yag'],
        properties: {
          ad: { type: 'string' },
          gram: { type: 'number' },
          kcal: { type: 'number' },
          protein: { type: 'number' },
          karb: { type: 'number' },
          yag: { type: 'number' },
        },
      },
    },
    guven: { type: 'string', enum: ['dusuk', 'orta', 'yuksek'] },
    not: { type: 'string' },
  },
} as const;

type Yemek = { ad: string; gram: number; kcal: number; protein: number; karb: number; yag: number };
type Sonuc = { yemekler: Yemek[]; guven: 'dusuk' | 'orta' | 'yuksek'; not: string };

function hata(durum: number, mesaj: string) {
  return Response.json({ hata: mesaj }, { status: durum });
}

function sinirla(n: unknown, maks: number) {
  const x = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return Math.round(Math.min(Math.max(x, 0), maks) * 10) / 10;
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return hata(405, 'Yalnızca POST');

    const kullanici = ctx.userClaims?.id;
    if (!kullanici) return hata(401, 'Oturum gerekli');

    let govde: { gorsel?: unknown; tur?: unknown; not?: unknown };
    try {
      govde = await req.json();
    } catch {
      return hata(400, 'Geçersiz istek');
    }
    const gorsel = typeof govde.gorsel === 'string' ? govde.gorsel : '';
    const tur = IZINLI_TURLER.find((t) => t === govde.tur) ?? 'image/jpeg';
    const not = typeof govde.not === 'string' ? govde.not.slice(0, 300) : '';
    if (!gorsel || gorsel.length > MAKS_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(gorsel)) {
      return hata(400, 'Görsel eksik, çok büyük ya da hatalı');
    }

    // Günlük limit (kötüye kullanım ve maliyet koruması)
    const { data: adet, error: limitHatasi } = await ctx.supabaseAdmin.rpc('foto_kullanim_artir', {
      p_user: kullanici,
    });
    if (limitHatasi) {
      console.error('limit', limitHatasi);
      return hata(500, 'Sunucu hatası');
    }
    if (typeof adet === 'number' && adet > GUNLUK_LIMIT) {
      return hata(429, `Günlük fotoğraf analizi limitine (${GUNLUK_LIMIT}) ulaştın. Yarın tekrar dene.`);
    }

    try {
      const yanit = await client.beta.messages.create({
        model: 'claude-opus-5-5',
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: {
          effort: 'medium',
          format: { type: 'json_schema', schema: SEMA },
        },
        system: SISTEM,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: tur, data: gorsel } },
              { type: 'text', text: not ? `Kullanıcı notu: ${not}` : 'Bu öğünü analiz et.' },
            ],
          },
        ],
      });

      if (yanit.stop_reason === 'refusal') {
        return hata(422, 'Bu fotoğraf analiz edilemedi. Başka bir fotoğraf dene.');
      }
      if (yanit.stop_reason === 'max_tokens') {
        return hata(502, 'Yanıt tamamlanamadı, tekrar dene.');
      }
      const metin = yanit.content.find((b) => b.type === 'text');
      if (!metin || metin.type !== 'text') return hata(502, 'Boş yanıt');

      const ham = JSON.parse(metin.text) as Sonuc;
      const sonuc: Sonuc = {
        guven: ham.guven,
        not: String(ham.not ?? '').slice(0, 300),
        yemekler: (ham.yemekler ?? []).slice(0, 20).map((y) => ({
          ad: String(y.ad).slice(0, 80),
          gram: sinirla(y.gram, 3000),
          kcal: sinirla(y.kcal, 5000),
          protein: sinirla(y.protein, 500),
          karb: sinirla(y.karb, 800),
          yag: sinirla(y.yag, 400),
        })),
      };
      return Response.json(sonuc);
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return hata(503, 'Servis yoğun, biraz sonra tekrar dene.');
      if (e instanceof Anthropic.BadRequestError) {
        console.error('anthropic 400', e.message);
        return hata(400, 'Görsel işlenemedi.');
      }
      if (e instanceof Anthropic.APIError) {
        console.error('anthropic', e.status, e.message);
        return hata(502, 'Analiz servisine ulaşılamadı.');
      }
      if (e instanceof SyntaxError) return hata(502, 'Yanıt çözümlenemedi, tekrar dene.');
      console.error(e);
      return hata(500, 'Sunucu hatası');
    }
  }),
};
