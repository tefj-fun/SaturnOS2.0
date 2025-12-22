import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/api/supabaseClient";

const REDIRECT_SECONDS = 7;

export default function Welcome() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking");
  const [email, setEmail] = useState("");
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    let isMounted = true;

    const setFromSession = (session) => {
      if (!session || !isMounted) return;
      setEmail(session.user?.email || "");
      setStatus("verified");
    };

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (data?.session) {
        setFromSession(data.session);
      } else {
        setStatus("missing");
      }
    };

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setFromSession(session);
    });

    init();
    return () => {
      isMounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (status !== "verified") return;
    setCountdown(REDIRECT_SECONDS);
    let remaining = REDIRECT_SECONDS;
    const interval = setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      setCountdown(remaining);
    }, 1000);
    const timeout = setTimeout(async () => {
      try {
        await supabase.auth.signOut();
      } finally {
        navigate("/", { replace: true });
      }
    }, REDIRECT_SECONDS * 1000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [status, navigate]);

  const handleGoToLogin = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      navigate("/", { replace: true });
    }
  };

  const copy = useMemo(() => {
    switch (status) {
      case "verified":
        return {
          eyebrow: "Email verified",
          title: "Welcome aboard.",
          body: "Your account is confirmed. We are redirecting you to the login page so you can sign in.",
          note: `Redirecting in ${countdown}s.`,
        };
      case "missing":
        return {
          eyebrow: "Verification not detected",
          title: "Open your email link.",
          body: "We could not find a verified session. Please open the verification link from your email or sign in again.",
          note: "You can return to login any time.",
        };
      default:
        return {
          eyebrow: "Checking status",
          title: "Finishing verification.",
          body: "We are confirming your email now. This should only take a moment.",
          note: "Hang tight.",
        };
    }
  }, [status, countdown]);

  const progress = status === "verified"
    ? Math.max(0, Math.min(100, (countdown / REDIRECT_SECONDS) * 100))
    : 100;

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#f6f1e8] text-[#1b1b1b] font-[IBM_Plex_Sans]">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
          :root {
            --sunrise: #f2b66d;
            --ember: #f36b3a;
            --horizon: #0f6fff;
            --ink: #1b1b1b;
            --paper: #fff8ee;
          }
          @keyframes floatSlow {
            0% { transform: translate3d(0, 0, 0) scale(1); }
            50% { transform: translate3d(-20px, 18px, 0) scale(1.04); }
            100% { transform: translate3d(0, 0, 0) scale(1); }
          }
          @keyframes drift {
            0% { transform: translate3d(0, 0, 0) rotate(0deg); }
            50% { transform: translate3d(18px, -14px, 0) rotate(3deg); }
            100% { transform: translate3d(0, 0, 0) rotate(0deg); }
          }
          @keyframes pulseGlow {
            0% { box-shadow: 0 0 0 0 rgba(243, 107, 58, 0.35); }
            70% { box-shadow: 0 0 0 18px rgba(243, 107, 58, 0); }
            100% { box-shadow: 0 0 0 0 rgba(243, 107, 58, 0); }
          }
        `}
      </style>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(243,107,58,0.18),_transparent_55%),radial-gradient(circle_at_80%_70%,_rgba(15,111,255,0.15),_transparent_55%)]" />
      <div className="absolute -top-24 -left-16 w-72 h-72 rounded-[40%] bg-[#f2b66d]/40 blur-[120px] animate-[floatSlow_18s_ease-in-out_infinite]" />
      <div className="absolute bottom-[-120px] right-[-40px] w-96 h-96 rounded-[40%] bg-[#0f6fff]/20 blur-[140px] animate-[floatSlow_22s_ease-in-out_infinite]" />
      <div className="absolute top-24 right-12 w-48 h-48 border border-black/10 rounded-3xl rotate-6 animate-[drift_16s_ease-in-out_infinite]" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-1 text-xs uppercase tracking-[0.3em] text-black/60">
              <Sparkles className="h-4 w-4" />
              SaturnOS 2.0
            </div>
            <h1 className="text-4xl lg:text-5xl font-[Fraunces] leading-tight text-[#1b1b1b]">
              Your space is ready. Your crew is waiting.
            </h1>
            <p className="text-base lg:text-lg text-black/70 max-w-xl">
              Thanks for confirming your email. We set up your workspace, preferences, and guardrails so you can jump right into guided annotation.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-black/50">SOP clarity</p>
                <p className="mt-2 text-sm font-medium text-black/80">Step by step guidance for every label task.</p>
              </div>
              <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-black/50">Smart reviews</p>
                <p className="mt-2 text-sm font-medium text-black/80">Keep accuracy high with quick review loops.</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-black/10 bg-white/80 shadow-2xl p-8 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-black/50">{copy.eyebrow}</p>
                <h2 className="mt-2 text-2xl font-[Fraunces] text-black">{copy.title}</h2>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-[#f36b3a]/15 flex items-center justify-center animate-[pulseGlow_3s_ease-in-out_infinite]">
                <span className="h-3 w-3 rounded-full bg-[#f36b3a]" />
              </div>
            </div>

            <p className="mt-4 text-sm text-black/70 leading-relaxed">{copy.body}</p>
            {email ? (
              <div className="mt-4 rounded-2xl bg-[#fff3e4] px-4 py-3 text-sm text-black/70">
                Verified for <span className="font-semibold text-black">{email}</span>
              </div>
            ) : null}

            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-black/50">
                <span>{copy.note}</span>
                <span>{status === "verified" ? `${countdown}s` : "Ready"}</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-black/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#f36b3a] via-[#f2b66d] to-[#0f6fff] transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleGoToLogin}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1b1b1b] text-white px-4 py-2.5 text-sm font-semibold hover:bg-black/90 transition"
              >
                Go to login now
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/", { replace: true })}
                className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-white/70 px-4 py-2.5 text-sm font-semibold text-black/70 hover:text-black transition"
              >
                Return to login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
