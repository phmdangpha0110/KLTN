import { createContext, useContext, useEffect, useRef, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));

    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  };

  const showToast = (message, type = "info") => {
    const id = Date.now() + Math.random();

    setToasts([
      {
        id,
        message: String(message || ""),
        type,
      },
    ]);

    timersRef.current[id] = setTimeout(() => {
      removeToast(id);
    }, 3000);
  };

  useEffect(() => {
    const oldAlert = window.alert;

    window.alert = (message) => {
      const text = String(message || "");

      const isError =
        text.toLowerCase().includes("lỗi") ||
        text.toLowerCase().includes("thất bại") ||
        text.toLowerCase().includes("không thể") ||
        text.toLowerCase().includes("error") ||
        text.toLowerCase().includes("failed");

      showToast(text, isError ? "error" : "success");
    };

    return () => {
      window.alert = oldAlert;
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center bg-transparent px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto w-full max-w-xl rounded-3xl border px-8 py-7 text-center shadow-2xl backdrop-blur-md ${
              toast.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : toast.type === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-blue-200 bg-blue-50 text-blue-700"
            }`}
          >
            <button
              onClick={() => removeToast(toast.id)}
              className="absolute right-5 top-4 text-2xl leading-none opacity-50 transition hover:opacity-100"
            >
              ×
            </button>

            <div className="mb-4 text-5xl">
              {toast.type === "error"
                ? "❌"
                : toast.type === "success"
                ? "✅"
                : "ℹ️"}
            </div>

            <div className="text-xl font-bold leading-8">{toast.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}