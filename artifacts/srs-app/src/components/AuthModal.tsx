import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: Props) {
  const { register } = useAuth();
  const [tab, setTab] = useState<"register" | "login">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (tab === "register") {
        await register(email, password);
      } else {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        });

        let data: any = null;
        try {
          data = await res.json();
        } catch {
          // ignore JSON parse errors; handle below via status code
        }

        if (!res.ok) throw new Error(data?.error || "登录失败");
        window.location.reload();
      }
      setDone(true);
      setTimeout(onClose, 900);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed z-50 inset-0 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-sm bg-white rounded-xl shadow-2xl shadow-black/10 border border-gray-100 overflow-hidden"
              style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4">
                <div>
                  <h2 className="text-base font-semibold text-[#37352f]">
                    {tab === "register" ? "创建账号" : "登录"}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">学习数据将与你的账号绑定</p>
                </div>
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tab switch */}
              <div className="flex mx-6 mb-5 bg-gray-50 rounded-lg p-0.5 gap-0.5">
                {(["register", "login"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); setError(""); }}
                    className={[
                      "flex-1 py-1.5 rounded-md text-xs font-medium transition-all duration-150",
                      tab === t ? "bg-white text-[#6366f1] shadow-sm" : "text-gray-400 hover:text-gray-600",
                    ].join(" ")}
                  >
                    {t === "register" ? "注册" : "登录"}
                  </button>
                ))}
              </div>

              {/* Form */}
              {done ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <CheckCircle className="w-10 h-10 text-[#6366f1]" />
                  <p className="text-sm font-medium text-[#37352f]">
                    {tab === "register" ? "注册成功，已自动登录！" : "登录成功！"}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">邮箱</label>
                    <input
                      type="email"
                      required
                      autoFocus
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all bg-white text-[#37352f] placeholder-gray-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">密码</label>
                    <input
                      type="password"
                      required
                      placeholder="至少 6 位"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/10 transition-all bg-white text-[#37352f] placeholder-gray-300"
                    />
                  </div>

                  {error && (
                    <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 mt-1 rounded-lg text-sm font-semibold bg-[#6366f1] text-white hover:bg-[#5254cc] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {tab === "register" ? "注册并自动登录" : "登录"}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
