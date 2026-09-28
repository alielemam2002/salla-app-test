/**
 * Vercel Serverless Function - Storefront Coupon & Announcement Settings
 * Called by the storefront App Snippet to get active banner & coupon cards.
 */

export const config = {
  runtime: 'edge',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const storeId = url.searchParams.get('store_id');

  // Default fallback settings or read from KV/storage if configured
  const settings = {
    active: true,
    show_announcement_bar: true,
    announcement_text: 'عروض خاصة بدأت الآن · شحن مجاني للطلبات المميزة · كود الخصم متوفر بالأسفل',
    announcement_bg: '#e59b2d',
    announcement_color: '#1a1a1a',

    display_product_page: true,
    display_cart_page: true,
    display_products_catalog: true,

    coupon_code: 'ZAWWID10',
    card_title: 'كوبون لك',
    card_subtitle: 'خصم 10% على أول طلب',
    card_bg: '#092d27',
  };

  return Response.json(settings, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
