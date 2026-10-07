import {
  CheckCircle2,
  Download,
  ExternalLink,
  PackageCheck,
  QrCode,
  RefreshCw,
  Share2,
  Smartphone,
} from "lucide-react";
import { Button } from "../ui/index.js";

export default function MobileAppSuccessCard({
  appName = "متجر سلة",
  packageName = "sa.salla.app.store",
  latestBuild = null,
  onRebuild,
}) {
  const apkUrl = latestBuild?.apkUrl || "#";
  const aabUrl = latestBuild?.aabUrl || "#";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    apkUrl,
  )}`;

  return (
    <div className="mobile-app-success-card">
      <div className="success-card-banner">
        <div className="success-badge-icon">
          <PackageCheck size={32} />
        </div>
        <div className="success-banner-text">
          <span className="success-pill">
            <CheckCircle2 size={13} /> جاهز للتحميل والتثبيت
          </span>
          <h3>🎉 تهانينا! تم إنشاء وتوقيع تطبيق {appName} بنجاح</h3>
          <p>
            تطبيق الأندرويد الخاص بمتجرك تم بناؤه وتوقيعه رقمياً وهو جاهز للتجربة
            والنشر على Google Play
          </p>
        </div>
      </div>

      <div className="success-actions-grid">
        {/* APK Card */}
        <div className="download-box apk-box">
          <div className="download-box-header">
            <Smartphone size={24} className="box-icon" />
            <div>
              <h4>ملف التثبيت المباشر (APK)</h4>
              <span className="file-format-badge">.APK للأجهزة الذكية</span>
            </div>
          </div>
          <p>
            ثبّت التطبيق مباشرة على أي هاتف أندرويد لتجربة متجرك ورؤية كيف يتفاعل
            العميل معه.
          </p>
          <a
            href={apkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-download"
          >
            <Download size={16} /> تحميل ملف APK
          </a>
        </div>

        {/* AAB Card */}
        <div className="download-box aab-box">
          <div className="download-box-header">
            <PackageCheck size={24} className="box-icon" />
            <div>
              <h4>حزمة متجر جوجل بلاي (AAB)</h4>
              <span className="file-format-badge">.AAB للنشر الرسمي</span>
            </div>
          </div>
          <p>
            الحزمة الرسمية الموقعة رقمياً والمجهزة للرفع المباشر على حساب Google
            Play Console.
          </p>
          <a
            href={aabUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-download"
          >
            <Download size={16} /> تحميل ملف AAB
          </a>
        </div>
      </div>

      {/* QR Code Quick Install Section */}
      <div className="qr-quick-install-box">
        <div className="qr-image-wrapper">
          <img src={qrUrl} alt="QR Code لتحميل التطبيق" className="qr-img" />
        </div>
        <div className="qr-details">
          <div className="qr-title-row">
            <QrCode size={18} />
            <h4>التثبيت السريع عبر الجوال</h4>
          </div>
          <p>
            افتح كاميرا هاتفك الأندرويد وامسح الرمز أعلاه لتحميل ملف الـ APK
            مباشرة على جهازك دون الحاجة لنقله عبر الكمبيوتر.
          </p>
          <div className="qr-meta" dir="ltr">
            <span>Package ID: {packageName}</span>
          </div>
        </div>
      </div>

      {/* Rebuild Action */}
      <div className="success-card-footer">
        <Button
          variant="secondary"
          icon={RefreshCw}
          onClick={onRebuild}
        >
          تعديل الهوية أو إعادة البناء
        </Button>
      </div>
    </div>
  );
}
