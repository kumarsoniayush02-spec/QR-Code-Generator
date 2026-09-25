import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import {
  QrCode, Download, History, Sliders,
  Link, FileText, Mail, Phone, Wifi,
  AlertTriangle, Sparkles, Copy, Check,
  ChevronDown, Palette, Shield, Trash2,
  Sun, Moon, Image, ClipboardCopy, FileImage,
  X, Upload, Info, Maximize2, RotateCcw
} from 'lucide-react';

/* ─── Contrast Ratio Utility (WCAG) ─── */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 0, g: 0, b: 0 };
}

function getLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(hex1, hex2) {
  const l1 = getLuminance(hexToRgb(hex1));
  const l2 = getLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/* ─── Validation Helpers ─── */
function validateUrl(value) {
  if (!value.trim()) return 'URL is required';
  // Auto-prepend https:// if no protocol is provided
  let urlString = value.trim();
  if (!/^https?:\/\//i.test(urlString)) {
    urlString = 'https://' + urlString;
  }
  try {
    const url = new URL(urlString);
    if (!['http:', 'https:'].includes(url.protocol)) return 'URL must start with http:// or https://';
    return null;
  } catch {
    return 'Please enter a valid URL (e.g., https://example.com)';
  }
}

function validateEmail(value) {
  if (!value.email.trim()) return 'Email address is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value.email)) return 'Please enter a valid email address';
  return null;
}

function validatePhone(value) {
  if (!value.trim()) return 'Phone number is required';
  const phoneRegex = /^\+?[\d\s\-()]{7,20}$/;
  if (!phoneRegex.test(value)) return 'Please enter a valid phone number (e.g., +91 9876543210)';
  return null;
}

function validateWifi(value) {
  if (!value.ssid.trim()) return 'Network name (SSID) is required';
  if (value.encryption !== 'nopass' && !value.password.trim()) return 'Password is required for encrypted networks';
  return null;
}

function validateText(value) {
  if (!value.trim()) return 'Text content is required';
  if (value.length > 2000) return 'Text is too long — QR code may not be scannable';
  return null;
}

/* ─── Content Type Tabs Configuration ─── */
const CONTENT_TABS = [
  { id: 'url', label: 'URL', icon: Link, description: 'Website link' },
  { id: 'text', label: 'Text', icon: FileText, description: 'Plain text' },
  { id: 'email', label: 'Email', icon: Mail, description: 'Email message' },
  { id: 'phone', label: 'Phone', icon: Phone, description: 'Phone number' },
  { id: 'wifi', label: 'Wi-Fi', icon: Wifi, description: 'Network credentials' },
];

/* ─── Visual Presets ─── */
const PRESETS = [
  {
    name: 'Classic',
    fg: '#6366f1', bg: '#0f172a',
    fgLight: '#4f46e5', bgLight: '#f8fafc',
    ring: 'ring-indigo-500/30',
    bgStyleDark: 'bg-gradient-to-br from-slate-900 to-indigo-950',
    bgStyleLight: 'bg-gradient-to-br from-indigo-50 to-violet-100',
  },
  {
    name: 'Emerald',
    fg: '#10b981', bg: '#022c22',
    fgLight: '#059669', bgLight: '#f0fdf4',
    ring: 'ring-emerald-500/30',
    bgStyleDark: 'bg-gradient-to-br from-emerald-950 to-teal-950',
    bgStyleLight: 'bg-gradient-to-br from-emerald-50 to-teal-100',
  },
  {
    name: 'Sunset',
    fg: '#f59e0b', bg: '#451a03',
    fgLight: '#d97706', bgLight: '#fffbeb',
    ring: 'ring-amber-500/30',
    bgStyleDark: 'bg-gradient-to-br from-amber-950 to-orange-950',
    bgStyleLight: 'bg-gradient-to-br from-amber-50 to-orange-100',
  },
  {
    name: 'Fuchsia',
    fg: '#ec4899', bg: '#500724',
    fgLight: '#db2777', bgLight: '#fdf2f8',
    ring: 'ring-pink-500/30',
    bgStyleDark: 'bg-gradient-to-br from-pink-950 to-rose-950',
    bgStyleLight: 'bg-gradient-to-br from-pink-50 to-rose-100',
  },
  {
    name: 'Monochrome',
    fg: '#1e293b', bg: '#ffffff',
    fgLight: '#0f172a', bgLight: '#ffffff',
    ring: 'ring-slate-500/30',
    bgStyleDark: 'bg-gradient-to-br from-slate-800 to-slate-900',
    bgStyleLight: 'bg-gradient-to-br from-slate-50 to-gray-100',
  },
  {
    name: 'Ocean',
    fg: '#0ea5e9', bg: '#0c1929',
    fgLight: '#0284c7', bgLight: '#f0f9ff',
    ring: 'ring-sky-500/30',
    bgStyleDark: 'bg-gradient-to-br from-sky-950 to-cyan-950',
    bgStyleLight: 'bg-gradient-to-br from-sky-50 to-cyan-100',
  },
];

/* ─── Error Correction Levels ─── */
const EC_LEVELS = [
  { value: 'L', label: 'Low', detail: '~7% recovery', icon: '○' },
  { value: 'M', label: 'Medium', detail: '~15% recovery', icon: '◑' },
  { value: 'Q', label: 'Quartile', detail: '~25% recovery', icon: '◕' },
  { value: 'H', label: 'High', detail: '~30% recovery', icon: '●' },
];

export default function App() {
  /* ─── State ─── */
  const [recentCodes, setRecentCodes] = useState(() => {
    try {
      const saved = localStorage.getItem('recent_qrs');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [qrType, setQrType] = useState(() => localStorage.getItem('last_qr_type') || 'url');
  const [urlInput, setUrlInput] = useState(() => localStorage.getItem('last_url_input') || 'https://github.com');
  const [textInput, setTextInput] = useState(() => localStorage.getItem('last_text_input') || 'Hello GDG SRM!');
  const [emailInput, setEmailInput] = useState(() => {
    try {
      const saved = localStorage.getItem('last_email_input');
      return saved ? JSON.parse(saved) : { email: '', subject: '', body: '' };
    } catch { return { email: '', subject: '', body: '' }; }
  });
  const [phoneInput, setPhoneInput] = useState(() => localStorage.getItem('last_phone_input') || '');
  const [wifiInput, setWifiInput] = useState(() => {
    try {
      const saved = localStorage.getItem('last_wifi_input');
      return saved ? JSON.parse(saved) : { ssid: '', password: '', encryption: 'WPA' };
    } catch { return { ssid: '', password: '', encryption: 'WPA' }; }
  });

  const [fgColor, setFgColor] = useState(() => localStorage.getItem('qr_fg_color') || '#6366f1');
  const [bgColor, setBgColor] = useState(() => localStorage.getItem('qr_bg_color') || '#0f172a');
  const [errorLevel, setErrorLevel] = useState(() => localStorage.getItem('qr_error_level') || 'M');
  const [qrSize, setQrSize] = useState(() => parseInt(localStorage.getItem('qr_size')) || 240);
  const [qrMargin, setQrMargin] = useState(() => parseInt(localStorage.getItem('qr_margin') ?? '16'));
  const [activePreset, setActivePreset] = useState(() => localStorage.getItem('qr_active_preset') || null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('qr_theme') || 'dark');
  const [validationError, setValidationError] = useState(null);
  const [touched, setTouched] = useState(false);
  const [logoImage, setLogoImage] = useState(null);
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [copyImageSuccess, setCopyImageSuccess] = useState(false);
  const [svgDownloadSuccess, setSvgDownloadSuccess] = useState(false);

  const logoInputRef = useRef(null);

  /* ─── Apply theme class to root ─── */
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    localStorage.setItem('qr_theme', theme);

    // Auto-switch QR colors when a preset is active
    if (activePreset) {
      const preset = PRESETS.find(p => p.name === activePreset);
      if (preset) {
        setFgColor(theme === 'light' ? preset.fgLight : preset.fg);
        setBgColor(theme === 'light' ? preset.bgLight : preset.bg);
      }
    }
  }, [theme, activePreset]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  /* ─── Persist inputs ─── */
  useEffect(() => {
    localStorage.setItem('last_qr_type', qrType);
    localStorage.setItem('last_url_input', urlInput);
    localStorage.setItem('last_text_input', textInput);
    localStorage.setItem('last_email_input', JSON.stringify(emailInput));
    localStorage.setItem('last_phone_input', phoneInput);
    localStorage.setItem('last_wifi_input', JSON.stringify(wifiInput));
  }, [qrType, urlInput, textInput, emailInput, phoneInput, wifiInput]);

  /* ─── Persist customization ─── */
  useEffect(() => {
    localStorage.setItem('qr_fg_color', fgColor);
    localStorage.setItem('qr_bg_color', bgColor);
    localStorage.setItem('qr_error_level', errorLevel);
    localStorage.setItem('qr_size', String(qrSize));
    localStorage.setItem('qr_margin', String(qrMargin));
    if (activePreset) {
      localStorage.setItem('qr_active_preset', activePreset);
    } else {
      localStorage.removeItem('qr_active_preset');
    }
  }, [fgColor, bgColor, errorLevel, qrSize, qrMargin, activePreset]);

  /* ─── Payload computation ─── */
  const getPayload = useCallback(() => {
    switch (qrType) {
      case 'url': {
        let url = urlInput.trim() || 'https://example.com';
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        return url;
      }
      case 'text': return textInput || 'Hello World';
      case 'email': return `mailto:${emailInput.email}?subject=${encodeURIComponent(emailInput.subject)}&body=${encodeURIComponent(emailInput.body)}`;
      case 'phone': return `tel:${phoneInput}`;
      case 'wifi': return `WIFI:T:${wifiInput.encryption};S:${wifiInput.ssid};P:${wifiInput.password};;`;
      default: return 'https://example.com';
    }
  }, [qrType, urlInput, textInput, emailInput, phoneInput, wifiInput]);

  const currentPayload = useMemo(() => getPayload(), [getPayload]);

  /* ─── Validation ─── */
  useEffect(() => {
    if (!touched) { setValidationError(null); return; }
    let error = null;
    switch (qrType) {
      case 'url': error = validateUrl(urlInput); break;
      case 'text': error = validateText(textInput); break;
      case 'email': error = validateEmail(emailInput); break;
      case 'phone': error = validatePhone(phoneInput); break;
      case 'wifi': error = validateWifi(wifiInput); break;
    }
    setValidationError(error);
  }, [qrType, urlInput, textInput, emailInput, phoneInput, wifiInput, touched]);

  // Mark as touched once user starts typing
  const handleInputChange = useCallback((setter) => (e) => {
    setTouched(true);
    setter(e.target.value);
  }, []);

  /* ─── Contrast & scan-reliability checks ─── */
  const contrastRatio = useMemo(() => getContrastRatio(fgColor, bgColor), [fgColor, bgColor]);
  const isLowContrast = contrastRatio < 3;

  const scanWarnings = useMemo(() => {
    const warnings = [];
    if (isLowContrast) {
      warnings.push({
        level: 'error',
        message: `Foreground and background are too similar (ratio ${contrastRatio.toFixed(1)}:1) — scannability may fail.`
      });
    } else if (contrastRatio < 4.5) {
      warnings.push({
        level: 'warn',
        message: `Low contrast ratio (${contrastRatio.toFixed(1)}:1) — may cause issues with some scanners.`
      });
    }
    if (qrSize < 150) {
      warnings.push({
        level: 'warn',
        message: 'QR code is quite small — increase size for better scan reliability.'
      });
    }
    if (currentPayload.length > 500 && errorLevel === 'L') {
      warnings.push({
        level: 'warn',
        message: 'High data density with low error correction — consider using Medium or higher.'
      });
    }
    if (currentPayload.length > 1000) {
      warnings.push({
        level: 'warn',
        message: 'Very large payload — the QR code may become too dense to scan reliably.'
      });
    }
    if (logoDataUrl && errorLevel !== 'H') {
      warnings.push({
        level: 'warn',
        message: 'Logo overlay works best with High error correction — switch to "H" for best results.'
      });
    }
    return warnings;
  }, [isLowContrast, contrastRatio, qrSize, currentPayload, errorLevel, logoDataUrl]);

  /* ─── Logo upload handler ─── */
  const handleLogoUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setLogoDataUrl(reader.result);
      setLogoImage(file.name);
      // Auto-switch to H error correction for logo
      setErrorLevel('H');
    };
    reader.readAsDataURL(file);
  }, []);

  const removeLogo = useCallback(() => {
    setLogoImage(null);
    setLogoDataUrl(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  }, []);

  /* ─── Actions ─── */
  const saveToRecent = useCallback(() => {
    if (!currentPayload) return;
    const newItem = {
      type: qrType,
      value: currentPayload,
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fg: fgColor,
      bg: bgColor,
      errorLevel,
      qrSize,
      qrMargin,
      // Store raw inputs for restore
      rawInputs: {
        urlInput,
        textInput,
        emailInput,
        phoneInput,
        wifiInput,
      }
    };
    const updated = [newItem, ...recentCodes.filter(item => item.value !== currentPayload)].slice(0, 8);
    setRecentCodes(updated);
    localStorage.setItem('recent_qrs', JSON.stringify(updated));
  }, [currentPayload, qrType, fgColor, bgColor, errorLevel, qrSize, qrMargin, recentCodes, urlInput, textInput, emailInput, phoneInput, wifiInput]);

  const restoreFromRecent = useCallback((item) => {
    setQrType(item.type);
    setFgColor(item.fg);
    setBgColor(item.bg);
    if (item.errorLevel) setErrorLevel(item.errorLevel);
    if (item.qrSize) setQrSize(item.qrSize);
    if (item.qrMargin !== undefined) setQrMargin(item.qrMargin);
    setActivePreset(null);
    setTouched(false);

    // Restore raw inputs if available
    if (item.rawInputs) {
      setUrlInput(item.rawInputs.urlInput || '');
      setTextInput(item.rawInputs.textInput || '');
      setEmailInput(item.rawInputs.emailInput || { email: '', subject: '', body: '' });
      setPhoneInput(item.rawInputs.phoneInput || '');
      setWifiInput(item.rawInputs.wifiInput || { ssid: '', password: '', encryption: 'WPA' });
    } else {
      // Legacy fallback — set value directly
      switch (item.type) {
        case 'url': setUrlInput(item.value); break;
        case 'text': setTextInput(item.value); break;
        case 'phone': setPhoneInput(item.value.replace('tel:', '')); break;
      }
    }
  }, []);

  const downloadQRCode = useCallback(() => {
    const canvas = document.getElementById('qr-canvas');
    if (!canvas) return;

    // Create a high-res export canvas
    const exportSize = 1024;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportSize;
    exportCanvas.height = exportSize;
    const ctx = exportCanvas.getContext('2d');

    // Draw background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, exportSize, exportSize);

    // Draw QR code scaled up
    ctx.drawImage(canvas, 0, 0, exportSize, exportSize);

    const pngUrl = exportCanvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    downloadLink.download = `qrcode-${qrType}-${Date.now()}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    saveToRecent();
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  }, [bgColor, qrType, saveToRecent]);

  const downloadSVG = useCallback(() => {
    const svgEl = document.getElementById('qr-svg');
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `qrcode-${qrType}-${Date.now()}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
    saveToRecent();
    setSvgDownloadSuccess(true);
    setTimeout(() => setSvgDownloadSuccess(false), 2000);
  }, [qrType, saveToRecent]);

  const copyQRImageToClipboard = useCallback(async () => {
    const canvas = document.getElementById('qr-canvas');
    if (!canvas) return;
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      setCopyImageSuccess(true);
      setTimeout(() => setCopyImageSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy image:', err);
    }
  }, []);

  const applyPreset = useCallback((preset) => {
    setFgColor(theme === 'light' ? preset.fgLight : preset.fg);
    setBgColor(theme === 'light' ? preset.bgLight : preset.bg);
    setActivePreset(preset.name);
  }, [theme]);

  const copyToClipboard = useCallback((text, index) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    });
  }, []);

  const deleteFromRecent = useCallback((index) => {
    const updated = recentCodes.filter((_, i) => i !== index);
    setRecentCodes(updated);
    localStorage.setItem('recent_qrs', JSON.stringify(updated));
  }, [recentCodes]);

  const clearAllRecent = useCallback(() => {
    setRecentCodes([]);
    localStorage.setItem('recent_qrs', JSON.stringify([]));
  }, []);

  /* ─── Logo settings for QRCodeCanvas ─── */
  const logoSettings = useMemo(() => {
    if (!logoDataUrl) return {};
    const logoSize = Math.floor(qrSize * 0.22);
    return {
      imageSettings: {
        src: logoDataUrl,
        height: logoSize,
        width: logoSize,
        excavate: true,
      }
    };
  }, [logoDataUrl, qrSize]);

  // Compute actual margin in QR code modules
  const marginModules = Math.round(qrMargin / 4);

  /* ─── Render ─── */
  return (
    <div className="min-h-screen bg-midnight text-text-primary flex flex-col font-display relative overflow-x-hidden">
      {/* ── Background Ambient Glows ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/8 rounded-full blur-[128px] animate-float-glow" />
        <div className="absolute bottom-[-15%] right-[-8%] w-[500px] h-[500px] bg-violet-600/6 rounded-full blur-[128px] animate-float-glow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[40%] left-[50%] w-[400px] h-[400px] bg-purple-600/4 rounded-full blur-[128px] animate-float-glow" style={{ animationDelay: '4s' }} />
      </div>

      {/* ── Header ── */}
      <header className="border-b border-border/60 bg-midnight/80 backdrop-blur-xl sticky top-0 z-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between py-4">
          <div className="flex items-center gap-3.5">
            <div className="relative group">
              <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-xl group-hover:bg-indigo-500/30 transition-all duration-500" />
              <div className="relative bg-gradient-to-br from-indigo-500 to-violet-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-500/25">
                <QrCode size={22} strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <h1 className={`text-lg font-bold tracking-tight bg-clip-text text-transparent ${
                theme === 'light'
                  ? 'bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600'
                  : 'bg-gradient-to-r from-white via-indigo-200 to-violet-300'
              }`}>
                QR Craft & Designer
              </h1>
              <p className="text-[11px] text-indigo-400/80 font-medium flex items-center gap-1.5 tracking-wide">
                <Sparkles size={11} className="animate-pulse-soft" />
                ~AYUSH KUMAR SONI
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleTheme}
              className="theme-toggle-btn"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <div className="relative w-5 h-5">
                <Sun
                  size={18}
                  className={`absolute inset-0 transition-all duration-300 ${
                    theme === 'light'
                      ? 'opacity-100 rotate-0 scale-100'
                      : 'opacity-0 rotate-90 scale-50'
                  }`}
                />
                <Moon
                  size={18}
                  className={`absolute inset-0 transition-all duration-300 ${
                    theme === 'dark'
                      ? 'opacity-100 rotate-0 scale-100'
                      : 'opacity-0 -rotate-90 scale-50'
                  }`}
                />
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Dashboard ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start relative z-10">

        {/* ═══ Left Column: Controls ═══ */}
        <div className="lg:col-span-7 space-y-6 animate-fade-in">

          {/* ── Content Type Card ── */}
          <section className="glass-card rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-indigo-400 flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse-soft" />
                Content Type
              </h2>
              <span className="text-[10px] font-mono text-text-muted bg-surface px-2 py-1 rounded-md border border-border">
                {qrType.toUpperCase()}
              </span>
            </div>

            {/* Tab Selector */}
            <div className="grid grid-cols-5 gap-1.5 bg-midnight/60 p-1.5 rounded-2xl border border-border/50">
              {CONTENT_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = qrType === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setQrType(tab.id); setTouched(false); setValidationError(null); }}
                    className={`tab-btn ${isActive ? 'active' : ''}`}
                    title={tab.description}
                  >
                    <Icon size={16} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Dynamic Input Fields */}
            <div className="animate-fade-in" key={qrType}>
              {qrType === 'url' && (
                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                    Target URL
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
                      <Link size={14} />
                    </div>
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => { setTouched(true); setUrlInput(e.target.value); }}
                      onBlur={() => setTouched(true)}
                      placeholder="https://example.com"
                      className={`input-field pl-10 ${touched && validationError ? 'input-error' : ''}`}
                    />
                  </div>
                </div>
              )}

              {qrType === 'text' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                      Plain Text Message
                    </label>
                    <span className={`text-[10px] font-mono ${textInput.length > 1500 ? 'text-amber-400' : 'text-text-muted'}`}>
                      {textInput.length} / 2000
                    </span>
                  </div>
                  <textarea
                    value={textInput}
                    onChange={(e) => { setTouched(true); setTextInput(e.target.value); }}
                    onBlur={() => setTouched(true)}
                    placeholder="Enter your custom message here..."
                    rows={3}
                    className={`input-field resize-none ${touched && validationError ? 'input-error' : ''}`}
                  />
                </div>
              )}

              {qrType === 'email' && (
                <div className="space-y-3">
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                    Email Parameters
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
                      <Mail size={14} />
                    </div>
                    <input
                      type="email"
                      placeholder="Recipient email address"
                      value={emailInput.email}
                      onChange={(e) => { setTouched(true); setEmailInput({ ...emailInput, email: e.target.value }); }}
                      onBlur={() => setTouched(true)}
                      className={`input-field pl-10 ${touched && validationError ? 'input-error' : ''}`}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Subject line (optional)"
                    value={emailInput.subject}
                    onChange={(e) => setEmailInput({ ...emailInput, subject: e.target.value })}
                    className="input-field"
                  />
                  <textarea
                    placeholder="Body message (optional)"
                    value={emailInput.body}
                    onChange={(e) => setEmailInput({ ...emailInput, body: e.target.value })}
                    rows={2}
                    className="input-field resize-none"
                  />
                </div>
              )}

              {qrType === 'phone' && (
                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                    Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
                      <Phone size={14} />
                    </div>
                    <input
                      type="tel"
                      placeholder="+91 9876543210"
                      value={phoneInput}
                      onChange={(e) => { setTouched(true); setPhoneInput(e.target.value); }}
                      onBlur={() => setTouched(true)}
                      className={`input-field pl-10 ${touched && validationError ? 'input-error' : ''}`}
                    />
                  </div>
                </div>
              )}

              {qrType === 'wifi' && (
                <div className="space-y-3">
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                    Wi-Fi Network Details
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
                      <Wifi size={14} />
                    </div>
                    <input
                      type="text"
                      placeholder="Network SSID (Name)"
                      value={wifiInput.ssid}
                      onChange={(e) => { setTouched(true); setWifiInput({ ...wifiInput, ssid: e.target.value }); }}
                      onBlur={() => setTouched(true)}
                      className={`input-field pl-10 ${touched && validationError ? 'input-error' : ''}`}
                    />
                  </div>
                  <input
                    type="password"
                    placeholder="Password"
                    value={wifiInput.password}
                    onChange={(e) => { setTouched(true); setWifiInput({ ...wifiInput, password: e.target.value }); }}
                    className={`input-field ${touched && validationError && wifiInput.encryption !== 'nopass' && !wifiInput.password.trim() ? 'input-error' : ''}`}
                  />
                  <div className="relative">
                    <select
                      value={wifiInput.encryption}
                      onChange={(e) => setWifiInput({ ...wifiInput, encryption: e.target.value })}
                      className="input-field appearance-none pr-10"
                    >
                      <option value="WPA">WPA / WPA2</option>
                      <option value="WEP">WEP</option>
                      <option value="nopass">No Password (Open)</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Validation Error Message */}
              {touched && validationError && (
                <div className="mt-3 flex items-center gap-2 text-red-400 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-2.5 text-xs font-medium animate-fade-in">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}
            </div>
          </section>

          {/* ── Customization Card ── */}
          <section className="glass-card rounded-3xl p-6 space-y-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-indigo-400 flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse-soft" />
              Customization & Style
            </h2>

            {/* Visual Presets */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                <Palette size={12} />
                Visual Presets
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    className={`preset-btn border ${theme === 'light' ? preset.bgStyleLight : preset.bgStyleDark} ${
                      activePreset === preset.name
                        ? `ring-2 ${preset.ring} border-transparent active`
                        : 'border-border hover:border-border-glow'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full ring-1 ring-black/10 dark:ring-white/20 shadow-inner"
                        style={{ backgroundColor: theme === 'light' ? preset.fgLight : preset.fg }}
                      />
                      <span className="text-text-primary">{preset.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Color Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="color-picker-wrapper">
                <div className="space-y-0.5">
                  <label className="block text-xs font-semibold text-text-primary">Foreground</label>
                  <span className="text-[11px] text-indigo-400 font-mono tracking-wider">{fgColor.toUpperCase()}</span>
                </div>
                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-xl shadow-lg ring-2 ring-black/10 cursor-pointer"
                    style={{ backgroundColor: fgColor }}
                  />
                  <input
                    type="color"
                    value={fgColor}
                    onChange={(e) => {
                      setFgColor(e.target.value);
                      setActivePreset(null);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              <div className="color-picker-wrapper">
                <div className="space-y-0.5">
                  <label className="block text-xs font-semibold text-text-primary">Background</label>
                  <span className="text-[11px] text-indigo-400 font-mono tracking-wider">{bgColor.toUpperCase()}</span>
                </div>
                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-xl shadow-lg ring-2 ring-black/10 cursor-pointer"
                    style={{ backgroundColor: bgColor }}
                  />
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => {
                      setBgColor(e.target.value);
                      setActivePreset(null);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* QR Size Slider */}
            <div className="space-y-3">
              <label className="flex items-center justify-between text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                <span className="flex items-center gap-2">
                  <Maximize2 size={12} />
                  QR Code Size
                </span>
                <span className="font-mono text-indigo-400 normal-case">{qrSize}px</span>
              </label>
              <input
                type="range"
                min="128"
                max="512"
                step="8"
                value={qrSize}
                onChange={(e) => setQrSize(parseInt(e.target.value))}
                className="range-slider"
              />
              <div className="flex justify-between text-[9px] text-text-muted font-mono">
                <span>128px</span>
                <span>320px</span>
                <span>512px</span>
              </div>
            </div>

            {/* Margin / Padding Slider */}
            <div className="space-y-3">
              <label className="flex items-center justify-between text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                <span className="flex items-center gap-2">
                  <Sliders size={12} />
                  Margin / Padding
                </span>
                <span className="font-mono text-indigo-400 normal-case">{qrMargin}px</span>
              </label>
              <input
                type="range"
                min="0"
                max="50"
                step="2"
                value={qrMargin}
                onChange={(e) => setQrMargin(parseInt(e.target.value))}
                className="range-slider"
              />
              <div className="flex justify-between text-[9px] text-text-muted font-mono">
                <span>0px</span>
                <span>25px</span>
                <span>50px</span>
              </div>
            </div>

            {/* Error Correction Level */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                <Shield size={12} />
                Error Correction Level
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {EC_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => setErrorLevel(level.value)}
                    className={`relative flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-xs transition-all cursor-pointer ${
                      errorLevel === level.value
                        ? `bg-indigo-500/15 border-indigo-500/40 ${theme === 'light' ? 'text-indigo-600' : 'text-indigo-300'} shadow-lg shadow-indigo-500/10`
                        : 'bg-midnight/40 border-border text-text-muted hover:border-border-glow hover:text-text-secondary'
                    }`}
                  >
                    <span className="text-base">{level.icon}</span>
                    <span className="font-bold">{level.label}</span>
                    <span className="text-[9px] opacity-60">{level.detail}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Logo Upload */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                <Image size={12} />
                Center Logo (Optional)
              </label>
              {logoDataUrl ? (
                <div className="flex items-center gap-3 bg-midnight/40 border border-border rounded-xl px-4 py-3">
                  <img src={logoDataUrl} alt="Logo preview" className="w-10 h-10 rounded-lg object-cover ring-2 ring-indigo-500/30" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-primary font-medium truncate">{logoImage}</p>
                    <p className="text-[10px] text-text-muted">Error correction set to High for logo support</p>
                  </div>
                  <button
                    onClick={removeLogo}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                    title="Remove logo"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => logoInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl border-2 border-dashed border-border hover:border-indigo-500/40 bg-midnight/30 hover:bg-indigo-500/5 text-text-muted hover:text-indigo-400 transition-all text-xs font-medium cursor-pointer"
                >
                  <Upload size={16} />
                  Upload Logo Image
                </button>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </div>
          </section>
        </div>

        {/* ═══ Right Column: Live Preview & History ═══ */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
          <section className="glass-card-preview rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center animate-slide-up" style={{ animationDelay: '0.15s' }}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/40" />
              <h2 className={`text-xs font-bold uppercase tracking-[0.2em] ${theme === 'light' ? 'text-indigo-500' : 'text-indigo-300/80'}`}>
                Live Preview
              </h2>
            </div>

            {/* Scan Reliability Warnings */}
            {scanWarnings.length > 0 && (
              <div className="mb-5 w-full space-y-2 animate-fade-in">
                {scanWarnings.map((w, i) => (
                  <div
                    key={i}
                    className={`w-full px-4 py-3 rounded-xl text-xs flex items-start gap-2.5 font-medium ${
                      w.level === 'error'
                        ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                        : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                    }`}
                  >
                    <AlertTriangle size={14} className="shrink-0 mt-0.5 animate-pulse-soft" />
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* QR Code Display */}
            <div className="qr-container mb-6 w-full flex items-center justify-center">
              <div className={`rounded-2xl overflow-hidden ${theme === 'light' ? 'bg-white shadow-xl' : 'bg-white/[0.06] ring-1 ring-white/[0.08]'}`} style={{ display: 'inline-block', padding: `${qrMargin}px` }}>
                <QRCodeCanvas
                  key={`canvas-${currentPayload}-${fgColor}-${bgColor}-${errorLevel}-${qrSize}-${qrMargin}-${logoDataUrl}`}
                  id="qr-canvas"
                  value={currentPayload}
                  size={qrSize}
                  fgColor={fgColor}
                  bgColor={bgColor}
                  level={errorLevel}
                  includeMargin={false}
                  {...logoSettings}
                />
                {/* Hidden SVG for SVG download */}
                <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                  <QRCodeSVG
                    id="qr-svg"
                    value={currentPayload}
                    size={qrSize}
                    fgColor={fgColor}
                    bgColor={bgColor}
                    level={errorLevel}
                    includeMargin={marginModules > 0}
                    {...logoSettings}
                  />
                </div>
              </div>
            </div>

            {/* Payload Preview */}
            <div className="w-full mb-5 bg-midnight/50 border border-border rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-[11px] text-text-muted font-mono truncate flex-1 text-left">
                {currentPayload}
              </p>
              <button
                onClick={() => copyToClipboard(currentPayload, 'payload')}
                className="shrink-0 text-text-muted hover:text-indigo-400 transition-colors"
                title="Copy payload"
              >
                {copiedIndex === 'payload' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="w-full space-y-3">
              {/* Download PNG */}
              <button onClick={downloadQRCode} className="btn-download" disabled={!!validationError && touched}>
                {downloadSuccess ? (
                  <>
                    <Check size={18} />
                    Downloaded Successfully!
                  </>
                ) : (
                  <>
                    <Download size={18} />
                    Download High-Res PNG
                  </>
                )}
              </button>

              {/* Secondary action row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Download SVG */}
                <button onClick={downloadSVG} className="btn-secondary">
                  {svgDownloadSuccess ? (
                    <>
                      <Check size={14} />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <>
                      <FileImage size={14} />
                      <span>Download SVG</span>
                    </>
                  )}
                </button>

                {/* Copy Image to Clipboard */}
                <button onClick={copyQRImageToClipboard} className="btn-secondary">
                  {copyImageSuccess ? (
                    <>
                      <Check size={14} />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <ClipboardCopy size={14} />
                      <span>Copy Image</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* ── History Panel ── */}
            <div className="w-full mt-8 pt-6 border-t border-border/50 text-left">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-text-muted flex items-center gap-2">
                  <History size={13} />
                  Recent QR Codes
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-text-muted bg-surface px-2 py-0.5 rounded border border-border">
                    {recentCodes.length} / 8
                  </span>
                  {recentCodes.length > 0 && (
                    <button
                      onClick={clearAllRecent}
                      className="text-[10px] text-text-muted hover:text-red-400 transition-colors font-medium"
                      title="Clear all"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {recentCodes.length === 0 ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface border border-border mb-3">
                    <QrCode size={20} className="text-text-muted" />
                  </div>
                  <p className="text-xs text-text-muted">No codes generated yet.</p>
                  <p className="text-[10px] text-text-muted/60 mt-1">Download a QR code to save it here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentCodes.map((item, index) => (
                    <div
                      key={index}
                      className="history-item group"
                    >
                      <div
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                        onClick={() => restoreFromRecent(item)}
                        title="Click to restore this QR code"
                      >
                        <span className="shrink-0 text-[9px] uppercase font-bold bg-indigo-500/15 text-indigo-400 px-2 py-1 rounded-md border border-indigo-500/20 tracking-wider">
                          {item.type}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-text-secondary font-mono text-[11px] truncate">{item.value}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex gap-1 items-center">
                          <div className="w-2.5 h-2.5 rounded-full ring-1 ring-black/10" style={{ backgroundColor: item.fg }} />
                          <div className="w-2.5 h-2.5 rounded-full ring-1 ring-black/10" style={{ backgroundColor: item.bg }} />
                        </div>
                        <span className="text-[10px] text-text-muted hidden sm:block">{item.date}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            restoreFromRecent(item);
                          }}
                          className="text-text-muted hover:text-indigo-400 transition-colors cursor-pointer p-0.5"
                          title="Restore"
                        >
                          <RotateCcw size={11} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(item.value, index);
                          }}
                          className="text-text-muted hover:text-indigo-400 transition-colors cursor-pointer p-0.5"
                          title="Copy payload"
                        >
                          {copiedIndex === index ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteFromRecent(index);
                          }}
                          className="text-text-muted hover:text-red-400 transition-colors cursor-pointer p-0.5"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>


    </div>
  );
}