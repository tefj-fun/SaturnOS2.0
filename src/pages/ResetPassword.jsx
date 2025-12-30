import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, KeyRound, ShieldAlert } from "lucide-react";
import { supabase } from "@/api/supabaseClient";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPassword() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking");
  const [sessionEmail, setSessionEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const syncSession = (session) => {
      if (!isMounted) return;
      setSessionEmail(session?.user?.email || "");
      setStatus(session ? "ready" : "missing");
    };

    const init = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (sessionError) {
        setStatus("missing");
        return;
      }
      syncSession(data?.session || null);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session);
    });

    init();
    return () => {
      isMounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
    } else {
      setNotice("Password updated. You can continue to SaturnOS.");
      setPassword("");
      setConfirmPassword("");
    }
    setIsSubmitting(false);
  };

  const copy = useMemo(() => {
    switch (status) {
      case "ready":
        return {
          eyebrow: "Reset ready",
          title: "Set a new password.",
          body: "Choose a strong password to get back into SaturnOS.",
        };
      case "missing":
        return {
          eyebrow: "Link missing",
          title: "Open the reset email.",
          body: "We could not find a recovery session. Please use the reset link from your inbox.",
        };
      default:
        return {
          eyebrow: "Checking",
          title: "Verifying your reset link.",
          body: "Hang tight while we check your recovery session.",
        };
    }
  }, [status]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0b0f1a] text-white font-[Space_Grotesk]">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
          @keyframes floatSlow {
            0% { transform: translate3d(0, 0, 0) scale(1); }
            50% { transform: translate3d(30px, -20px, 0) scale(1.05); }
            100% { transform: translate3d(0, 0, 0) scale(1); }
          }
          @keyframes drift {
            0% { transform: translate3d(0, 0, 0) rotate(0deg); }
            50% { transform: translate3d(-20px, 18px, 0) rotate(2deg); }
            100% { transform: translate3d(0, 0, 0) rotate(0deg); }
          }
        `}
      </style>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(31,93,255,0.35),_transparent_55%),radial-gradient(circle_at_70%_80%,_rgba(59,130,246,0.25),_transparent_50%)]" />
      <div className="absolute -top-32 -left-24 w-72 h-72 bg-blue-600/30 blur-3xl rounded-full animate-[floatSlow_18s_ease-in-out_infinite]" />
      <div className="absolute bottom-[-120px] right-[-60px] w-96 h-96 bg-blue-500/20 blur-[140px] rounded-full animate-[floatSlow_22s_ease-in-out_infinite]" />
      <div className="absolute top-1/3 right-1/4 w-48 h-48 border border-white/10 rounded-3xl rotate-12 animate-[drift_16s_ease-in-out_infinite]" />

      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 py-16 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs tracking-[0.2em] uppercase text-white/70">
              SaturnOS 2.0
            </div>
            <h1 className="text-4xl lg:text-5xl font-semibold leading-tight">
              {status === "missing" ? "Recovery link needed." : "Secure your workspace again."}
            </h1>
            <p className="text-white/70 text-base lg:text-lg max-w-xl">
              {status === "missing"
                ? "Return to the email we sent and open the password reset link."
                : "Reset your password in one step and keep your annotation workflow moving."}
            </p>
            <div className="flex items-center gap-4 text-sm text-white/60">
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Secure sessions
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Verified email recovery
              </span>
            </div>
          </div>

          <div className="bg-white text-gray-900 shadow-2xl rounded-3xl p-8 border border-white/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg bg-white border border-blue-100">
                {status === "ready" ? (
                  <KeyRound className="w-6 h-6 text-blue-600" />
                ) : (
                  <ShieldAlert className="w-6 h-6 text-blue-600" />
                )}
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-lg">{copy.title}</h2>
                <p className="text-xs text-gray-500 font-medium">{copy.eyebrow}</p>
              </div>
            </div>

            <p className="text-sm text-gray-600">{copy.body}</p>

            {status === "ready" ? (
              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                {sessionEmail ? (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
                    Resetting access for <span className="font-semibold">{sessionEmail}</span>
                  </div>
                ) : null}
                <div>
                  <label className="text-sm font-medium text-gray-700">New password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">Use at least {MIN_PASSWORD_LENGTH} characters.</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Confirm password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                {notice && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {notice}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {isSubmitting ? "Updating..." : "Update password"}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/", { replace: true })}
                  className="w-full border border-gray-200 text-gray-700 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Continue to SaturnOS
                </button>
              </form>
            ) : (
              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => navigate("/", { replace: true })}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                >
                  Return to sign in
                </button>
                <p className="text-xs text-gray-500">
                  If you need a new link, use the forgot password option on the sign in page.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
