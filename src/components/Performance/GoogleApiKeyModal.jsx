import React, { useState } from 'react';
import { X, Key, ShieldCheck, ExternalLink, Check, Trash2 } from 'lucide-react';

const API_KEY_STORAGE_KEY = 'salla_perf_google_api_key';

export function getStoredGoogleApiKey() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return '';
    return window.localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveStoredGoogleApiKey(key) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (key && key.trim()) {
      window.localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
    } else {
      window.localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('Failed to save Google API key to localStorage', err);
  }
}

export default function GoogleApiKeyModal({ isOpen, onClose, onKeySaved }) {
  const [apiKeyInput, setApiKeyInput] = useState(() => getStoredGoogleApiKey());
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    saveStoredGoogleApiKey(apiKeyInput);
    setIsSaved(true);
    if (typeof onKeySaved === 'function') {
      onKeySaved(apiKeyInput.trim());
    }
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 600);
  };

  const handleClear = () => {
    saveStoredGoogleApiKey('');
    setApiKeyInput('');
    if (typeof onKeySaved === 'function') {
      onKeySaved('');
    }
  };

  return (
    <div
      className="perf-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-key-modal-title"
      onClick={onClose}
    >
      <div
        className="perf-modal-content"
        style={{ maxWidth: '520px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="perf-modal-header">
          <div className="perf-modal-title-group">
            <div className="perf-badge-label">
              <Key size={14} aria-hidden="true" />
              <span>Google PageSpeed API Key</span>
            </div>
            <h3 id="api-key-modal-title" className="perf-modal-title">
              إعداد مفتاح Google API المجاني
            </h3>
          </div>
          <button
            type="button"
            className="perf-modal-close-btn"
            onClick={onClose}
            aria-label="إغلاق"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="perf-modal-body">
          <p className="perf-block-text">
            يمنحك مفتاح Google API الشخصي <strong>25,000 فحص يومياً مجاناً</strong> بدون التعرض لحدود الاستخدام العامة (429 Quota Exceeded)، ويضمن سرعة فحص متجرك في ثوانٍ معدودة.
          </p>

          <div className="perf-section-block">
            <label htmlFor="google-api-key-input" className="perf-stat-label">
              مفتاح API الخاص بك (API Key):
            </label>
            <input
              id="google-api-key-input"
              type="text"
              className="perf-url-input"
              placeholder="AIzaSy..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              dir="ltr"
            />
            <span className="perf-cat-tag-sm" style={{ marginTop: '4px' }}>
              يتم حفظ المفتاح بأمان في متصفحك وإرساله لخادم الفحص لتفويض طلبات Google فقط.
            </span>
          </div>

          <div className="perf-savings-callout" style={{ background: 'var(--bg-primary)' }}>
            <span className="perf-callout-title">كيف تستخرج المفتاح مجاناً في دقيقة؟</span>
            <ol className="perf-steps-list" style={{ gap: '6px', fontSize: '0.82rem' }}>
              <li>ادخل على الرابط السريع: <a href="https://developers.google.com/speed/docs/insights/v5/get-started" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-secondary)' }}>Get a Key <ExternalLink size={11} style={{ display: 'inline' }} /></a></li>
              <li>اختر اسماً للمشروع واضغط <strong>Next</strong>.</li>
              <li>انسخ المفتاح الذي يظهر لك وضعه هنا.</li>
            </ol>
          </div>

          <div className="perf-modal-footer" style={{ padding: '0', border: 'none', gap: '8px' }}>
            {apiKeyInput && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleClear}
                style={{ marginLeft: 'auto' }}
              >
                <Trash2 size={14} />
                <span>حذف المفتاح</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              {isSaved ? (
                <>
                  <Check size={16} />
                  <span>تم الحفظ بنجاح!</span>
                </>
              ) : (
                <span>حفظ المفتاح</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
