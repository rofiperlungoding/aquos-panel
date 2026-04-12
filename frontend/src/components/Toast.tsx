import React, { useState, useCallback } from 'react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

interface ToastContextType {
  addToast: (type: Toast['type'], title: string, message?: string) => void;
}

export const ToastContext = React.createContext<ToastContextType>({
  addToast: () => {},
});

export function useToast() {
  return React.useContext(ToastContext);
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast['type'], title: string, message?: string) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const typeStyles: Record<string, { bg: string; border: string; icon: string; dot: string }> = {
    success: { bg: 'bg-[#e6f4ea]', border: 'border-[#34a853]/20', icon: '✓', dot: 'bg-[#34a853]' },
    error: { bg: 'bg-[#fde9e9]', border: 'border-[#ea4335]/20', icon: '✕', dot: 'bg-[#ea4335]' },
    info: { bg: 'bg-[#e8f0fe]', border: 'border-[#1a73e8]/20', icon: 'ℹ', dot: 'bg-[#1a73e8]' },
    warning: { bg: 'bg-[#fef7e0]', border: 'border-[#fbbc04]/20', icon: '⚠', dot: 'bg-[#fbbc04]' },
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-[999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => {
          const style = typeStyles[toast.type];
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto ${style.bg} border ${style.border} px-5 py-4 rounded-[20px] shadow-xl min-w-[300px] max-w-[400px] animate-[slideUp_0.3s_ease-out] cursor-pointer transition-all hover:scale-[1.02]`}
              onClick={() => removeToast(toast.id)}
            >
              <div className="flex items-start gap-3">
                <div className={`w-6 h-6 ${style.dot} rounded-full flex items-center justify-center text-white text-[10px] font-black flex-shrink-0 mt-0.5`}>
                  {style.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-extrabold text-[#202124] leading-tight">{toast.title}</p>
                  {toast.message && <p className="text-[11px] font-bold text-[#5f6368] mt-1 leading-snug">{toast.message}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
