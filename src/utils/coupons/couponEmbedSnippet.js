/**
 * Generates ready-to-use Salla Twilight Twig / HTML snippet for the coupon banner
 * matching the user's design (Image 1 and Image 2).
 */
export function generateCouponTwigSnippet(code, settings = {}) {
  const c = code || "ZAWWID10";
  const badge = settings.card_badge_title || "كوبون لك";
  const headline = settings.card_headline_text || "خصم 10% على أول طلب";
  const cardBg = settings.card_bg_color || "#092d27";
  const cardText = settings.card_text_color || "#67e8f9";

  const announcementText = settings.announcement_text || `عروض حصرية بدأت · كود الخصم: ${c}`;
  const annBg = settings.announcement_bg_color || "#f59e0b";
  const annColor = settings.announcement_text_color || "#1c1917";

  return `{# ================================================================ #}
{# 1. الشريط الإعلاني أعلى المتجر (Announcement Bar - مثل الصورة 2)     #}
{# ضعه في: src/views/components/header/header.twig أو أعلى master.twig  #}
{# ================================================================ #}
{% if theme.settings.get('show_coupon_announcement', true) %}
<div dir="rtl" class="w-full py-2.5 px-4 text-center font-bold text-sm tracking-wide transition-all" style="background-color: ${annBg}; color: ${annColor};">
  <span>${announcementText}</span>
</div>
{% endif %}

{# ================================================================ #}
{# 2. بطاقة الكوبون في الصفحات (Coupon Promo Card - مثل الصورة 1)     #}
{# ضعها في:                                                         #}
{# - صفحة المنتج: src/views/pages/product/single.twig (تحت السعر)     #}
{# - صفحة السلة: src/views/pages/cart.twig (فوق salla-cart-coupons)   #}
{# - قائمة المنتجات: src/views/pages/product/index.twig                #}
{# ================================================================ #}
<div dir="rtl" class="my-4 flex items-center justify-between rounded-xl px-4 py-3 shadow-sm border transition-all" style="background-color: ${cardBg}; border-color: rgba(34, 211, 238, 0.25);">
  <!-- جهة اليمين: النصوص والخصم -->
  <div class="flex flex-col text-right">
    <span class="text-xs font-semibold" style="color: ${cardText}; opacity: 0.85;">${badge}</span>
    <span class="text-base font-bold" style="color: ${cardText};">${headline}</span>
  </div>

  <!-- جهة اليسار: كود الكوبون مع إطار متقطع وقابل للنسخ بنقرة واحدة -->
  <button 
    type="button" 
    onclick="copyStoreCoupon('${c}', this)"
    title="اضغط لنسخ الكود"
    class="relative inline-flex items-center justify-center rounded-lg border border-dashed px-3.5 py-1.5 font-mono text-sm font-bold tracking-wider transition-all hover:brightness-125 active:scale-95 cursor-pointer"
    style="color: ${cardText}; border-color: ${cardText};"
  >
    <span class="c-code">${c}</span>
    <span class="c-done hidden text-xs font-sans text-emerald-300">تم النسخ ✔</span>
  </button>
</div>

<script>
function copyStoreCoupon(code, btn) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code);
  } else {
    var i = document.createElement('input');
    i.value = code;
    document.body.appendChild(i);
    i.select();
    document.execCommand('copy');
    document.body.removeChild(i);
  }
  var codeEl = btn.querySelector('.c-code');
  var doneEl = btn.querySelector('.c-done');
  if (codeEl && doneEl) {
    codeEl.classList.add('hidden');
    doneEl.classList.remove('hidden');
    setTimeout(function() {
      codeEl.classList.remove('hidden');
      doneEl.classList.add('hidden');
    }, 1800);
  }
}
</script>`;
}
