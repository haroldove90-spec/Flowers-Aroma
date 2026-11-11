import React, { useEffect, useState } from 'react';
import { Download, CheckCircle2, Smartphone, X, Sparkles, ShieldCheck } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showFallbackModal, setShowFallbackModal] = useState(false);

  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#535B28] bg-[#f7f8f2] rounded-lg border border-[#dce4bf]">
        <CheckCircle2 className="w-3.5 h-3.5 text-[#535B28]" />
        <span className="hidden sm:inline">App Instalada</span>
      </div>
    );
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      setShowFallbackModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        title="Instalar Aroma Flower en tu dispositivo"
        className={`flex items-center gap-1.5 rounded-lg bg-[#5C1125] text-white font-medium shadow-sm hover:bg-[#430c1b] active:scale-95 transition-all border border-[#C3A25D]/40 ${
          compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-1.5 text-xs sm:text-sm'
        }`}
      >
        <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C3A25D] shrink-0" />
        <span>Instalar App</span>
      </button>

      {/* iOS Instructions Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5 text-[#5C1125] font-bold">
                <img
                  src="https://daloocomercializadora.com.mx/aromaflowericono.png"
                  alt="Aroma Flower"
                  className="w-7 h-7 object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/aromaflowericono.png'; }}
                />
                <h3 className="text-base text-[#000000]">Instalar en iPhone / iPad</h3>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="rounded-full p-1 text-stone-400 hover:bg-stone-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs sm:text-sm text-stone-700">
              <p className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5C1125] text-white text-[11px] font-bold">
                  1
                </span>
                <span>Toca el botón <strong>Compartir</strong> (icono de cuadrado con flecha hacia arriba) en la barra inferior de Safari.</span>
              </p>
              <p className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5C1125] text-white text-[11px] font-bold">
                  2
                </span>
                <span>Desplázate hacia abajo y pulsa <strong>&quot;Agregar al inicio&quot;</strong>.</span>
              </p>
              <p className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#535B28] text-white text-[11px] font-bold">
                  3
                </span>
                <span>Listo. Accede a <strong>Aroma Flower</strong> como aplicación a pantalla completa incluso sin cobertura en invernadero.</span>
              </p>
            </div>
            <button
              onClick={() => setShowIOSModal(false)}
              className="mt-6 w-full rounded-xl bg-[#5C1125] py-2.5 text-sm font-semibold text-white hover:bg-[#430c1b] transition shadow-md"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Desktop / Android Chrome fallback when prompt not yet fired */}
      {showFallbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5 text-[#5C1125] font-bold">
                <img
                  src="https://daloocomercializadora.com.mx/aromaflowericono.png"
                  alt="Aroma Flower"
                  className="w-7 h-7 object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/aromaflowericono.png'; }}
                />
                <h3 className="text-base text-[#000000]">Instalación de Aroma Flower</h3>
              </div>
              <button
                onClick={() => setShowFallbackModal(false)}
                className="rounded-full p-1 text-stone-400 hover:bg-stone-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 text-xs sm:text-sm text-stone-600 space-y-2.5">
              <p>
                Para instalar <strong>Aroma Flower</strong> en tu teléfono o computadora:
              </p>
              <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-[#C3A25D]/30 text-xs text-stone-800 leading-relaxed">
                En Chrome o Edge, abre el menú de tres puntos (<strong>⋮</strong>) y presiona <strong>&quot;Instalar aplicación&quot;</strong> o <strong>&quot;Agregar a la pantalla principal&quot;</strong>.
              </div>
            </div>
            <button
              onClick={() => setShowFallbackModal(false)}
              className="mt-5 w-full rounded-xl bg-[#5C1125] py-2.5 text-sm font-semibold text-white hover:bg-[#430c1b] transition shadow-md"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
};

/**
 * Mobile and Desktop Home Banner to ensure 1-click PWA installation
 */
export const PWAHomeInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) {
    return null;
  }

  const handleAction = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      setShowIOSModal(true);
    }
  };

  return (
    <>
      <div className="w-full max-w-xl mx-auto mb-6 p-3 sm:p-4 rounded-2xl bg-white border border-[#C3A25D]/40 shadow-sm flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="https://daloocomercializadora.com.mx/aromaflowericono.png"
            alt="Aroma Flower App"
            className="w-11 h-11 rounded-xl object-contain shrink-0"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/aromaflowericono.png'; }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs sm:text-sm text-[#000000] truncate">
                Instalar App Aroma Flower
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#535B28]/15 text-[#535B28]">
                Móvil & PWA
              </span>
            </div>
            <p className="text-[11px] text-stone-500 truncate">
              Acceso rápido desde tu pantalla de inicio y trabajo offline en campo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleAction}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#5C1125] text-white text-xs font-bold hover:bg-[#430c1b] transition shadow-xs cursor-pointer active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-[#C3A25D]" />
            <span>Instalar</span>
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100"
            title="Ocultar sugerencia"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2 text-[#5C1125] font-bold">
                <Smartphone className="w-5 h-5 text-[#5C1125]" />
                <h3 className="text-base text-[#000000]">Instalar en tu Móvil</h3>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="rounded-full p-1 text-stone-400 hover:bg-stone-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs sm:text-sm text-stone-700">
              <p className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5C1125] text-white text-[11px] font-bold">
                  1
                </span>
                <span>En tu navegador (Safari en iPhone o Chrome en Android), pulsa el botón <strong>Compartir</strong> o el menú de tres puntos (<strong>⋮</strong>).</span>
              </p>
              <p className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5C1125] text-white text-[11px] font-bold">
                  2
                </span>
                <span>Selecciona la opción <strong>&quot;Agregar a la pantalla principal&quot;</strong> o <strong>&quot;Instalar app&quot;</strong>.</span>
              </p>
              <p className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#535B28] text-white text-[11px] font-bold">
                  3
                </span>
                <span>Abre Aroma Flower con icono propio y experiencia de app nativa sin barras del navegador.</span>
              </p>
            </div>
            <button
              onClick={() => setShowIOSModal(false)}
              className="mt-6 w-full rounded-xl bg-[#5C1125] py-2.5 text-sm font-semibold text-white hover:bg-[#430c1b] transition shadow-md"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};

