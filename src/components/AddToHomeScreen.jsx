import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'amazonfinder-a2hs-dismissed';
const STORAGE_EXPIRY_DAYS = 7;

function isDismissed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const { until } = JSON.parse(raw);
    return until && Date.now() < until;
  } catch {
    return false;
  }
}

function setDismissed() {
  try {
    const until = Date.now() + STORAGE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ until }));
  } catch {}
}

function isMobile() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window;
}

export function AddToHomeScreen() {
  const [visible, setVisible] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (!isMobile() || isDismissed()) return;
    const ua = navigator.userAgent || '';
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(ios);
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    setVisible(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      installPrompt.userChoice?.then(() => setInstallPrompt(null));
    }
    setDismissed();
    setVisible(false);
  };

  const handleDismiss = () => {
    setDismissed();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gray-900 text-white shadow-lg safe-area-pb"
      >
        <div className="max-w-lg mx-auto flex items-start gap-3">
          <span className="text-2xl shrink-0" aria-hidden>📱</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Adicione ao celular</p>
            <p className="text-xs text-gray-300 mt-0.5">
              {isIOS
                ? 'Toque em Compartilhar (ícone de seta para cima) e depois em "Adicionar à Tela de Início".'
                : installPrompt
                  ? 'Toque no botão abaixo para instalar e abrir como app.'
                  : 'Toque no menu do navegador (⋮) e escolha "Adicionar à tela inicial" ou "Instalar app".'}
            </p>
            <div className="flex gap-2 mt-2">
              {installPrompt && (
                <button
                  type="button"
                  onClick={handleInstall}
                  className="px-3 py-1.5 text-sm font-medium bg-[#0071e3] rounded-lg"
                >
                  Instalar
                </button>
              )}
              <button
                type="button"
                onClick={handleDismiss}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white"
              >
                Agora não
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 p-1 text-gray-400 hover:text-white"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
