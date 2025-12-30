import { useState } from "react";
import { ArrowRight, Check, Cpu, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/contexts/AuthContext";
import { startCheckout } from "@/api/stripe";
import { toast } from "@/components/ui/use-toast";

const tiers = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    tokenAllowance: "25k tokens / mo",
    audience: "Individuals and trials",
    cta: "Start free",
    ctaHref: "/",
    features: [
      "1 workspace",
      "SOP upload + step generation",
      "Annotation studio",
      "Community support",
      "No API access",
    ],
  },
  {
    name: "Starter",
    price: "$15",
    cadence: "per user / mo",
    tokenAllowance: "250k tokens / mo pooled",
    audience: "Small QA teams",
    cta: "Choose Starter",
    ctaHref: "/",
    priceKey: "starter",
    features: [
      "3 workspaces",
      "Shared templates",
      "Email support",
      "Review queue",
      "API dashboard add-on",
    ],
  },
  {
    name: "Team",
    price: "$39",
    cadence: "per user / mo",
    tokenAllowance: "2M tokens / mo pooled",
    audience: "Operational teams",
    cta: "Choose Team",
    ctaHref: "/",
    featured: true,
    priceKey: "team",
    features: [
      "SSO + audit logs",
      "Priority support",
      "Role-based access",
      "Advanced analytics",
      "API dashboard included",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "annual contracts",
    tokenAllowance: "50M+ tokens / mo pooled",
    audience: "Enterprise programs",
    cta: "Request quote",
    ctaHref: "#enterprise",
    features: [
      "Dedicated CSM + SLA",
      "Security review + compliance",
      "Private storage options",
      "Custom rate limits",
      "Premium API dashboard included",
    ],
  },
];

const apiAddon = [
  "Key rotation + scoped permissions",
  "Rate limits and budget alerts",
  "Usage analytics by workspace",
  "Invoice-friendly usage exports",
  "Org-wide spend controls",
];

const overages = [
  { tier: "Starter", rate: "$1.10 / 1M tokens" },
  { tier: "Team", rate: "$0.95 / 1M tokens" },
  { tier: "Enterprise", rate: "Negotiated volume rates" },
];

const usageRates = [
  {
    name: "Training compute",
    rate: "$0.45 / GPU-hour",
    detail: "Estimated per hour, varies by model size.",
  },
  {
    name: "Inference",
    rate: "$0.08 / 1k images",
    detail: "Batch and real-time tracked separately.",
  },
  {
    name: "Storage",
    rate: "$0.02 / GB-month",
    detail: "Datasets, SOPs, and artifacts.",
  },
];

const includedUsage = [
  { tier: "Free", training: "0.5 GPU-hr", inference: "1k images", storage: "2 GB" },
  { tier: "Starter", training: "5 GPU-hr", inference: "50k images", storage: "50 GB" },
  { tier: "Team", training: "25 GPU-hr", inference: "250k images", storage: "500 GB" },
  { tier: "Enterprise", training: "100 GPU-hr+", inference: "1M images+", storage: "2 TB+" },
];

const faqs = [
  {
    question: "Are tokens pooled across the team?",
    answer: "Yes. Every paid plan shares a single token pool across all workspaces and projects.",
  },
  {
    question: "What is included in the API dashboard?",
    answer: "Usage analytics, per-key controls, alerting, and billing exports for procurement.",
  },
  {
    question: "Can we cap spend?",
    answer: "Yes. Set monthly hard caps and alert thresholds on Team and Enterprise.",
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeCheckout, setActiveCheckout] = useState(null);

  const handleCheckout = async (tier) => {
    if (!tier.priceKey) {
      toast({
        title: "Pricing not configured",
        description: "Missing plan mapping for this tier.",
      });
      return;
    }
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to start a subscription.",
      });
      navigate("/");
      return;
    }
    setActiveCheckout(tier.name);
    try {
      const { url } = await startCheckout({ plan: tier.priceKey });
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      toast({
        title: "Checkout failed",
        description: error?.message || "Unable to start Stripe checkout.",
      });
    } finally {
      setActiveCheckout(null);
    }
  };

  return (
    <div className="pricing-shell min-h-screen bg-[#f5f7ff] text-[#1b1c20] relative overflow-hidden">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap');
          .pricing-shell {
            font-family: "DM Sans", system-ui, sans-serif;
            --ink: #1b1c20;
            --muted: #5d6678;
            --sea: #2563eb;
            --sun: #fbbf24;
            --coral: #f59e0b;
            --paper: #f8fbff;
          }
          .pricing-shell .font-display {
            font-family: "Sora", system-ui, sans-serif;
          }
          @keyframes floatSlow {
            0% { transform: translate3d(0, 0, 0) scale(1); }
            50% { transform: translate3d(-18px, 14px, 0) scale(1.03); }
            100% { transform: translate3d(0, 0, 0) scale(1); }
          }
          @keyframes drift {
            0% { transform: translate3d(0, 0, 0) rotate(0deg); }
            50% { transform: translate3d(16px, -10px, 0) rotate(2deg); }
            100% { transform: translate3d(0, 0, 0) rotate(0deg); }
          }
          @keyframes pulseSoft {
            0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.25); }
            70% { box-shadow: 0 0 0 18px rgba(37, 99, 235, 0); }
            100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
          }
        `}
      </style>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.12),_transparent_55%),radial-gradient(circle_at_80%_70%,_rgba(245,158,11,0.12),_transparent_52%)]" />
      <div className="absolute -top-24 -left-20 w-72 h-72 rounded-[40%] bg-[#fbbf24]/40 blur-[120px] animate-[floatSlow_20s_ease-in-out_infinite]" />
      <div className="absolute bottom-[-120px] right-[-50px] w-96 h-96 rounded-[40%] bg-[#2563eb]/25 blur-[140px] animate-[floatSlow_24s_ease-in-out_infinite]" />
      <div className="absolute top-24 right-14 w-44 h-44 border border-black/10 rounded-3xl rotate-6 animate-[drift_18s_ease-in-out_infinite]" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16 lg:py-24 space-y-16">
        <section className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-1 text-xs uppercase tracking-[0.3em] text-black/60">
              <Sparkles className="h-4 w-4" />
              Pricing
            </div>
            <h1 className="text-4xl lg:text-5xl font-display leading-tight text-[#1b1c20]">
              Simple, low-cost plans with <span className="text-[#2563eb]">enterprise control.</span>
            </h1>
            <p className="text-base lg:text-lg text-[#5d6678] max-w-xl">
              Pooled AI tokens, predictable overages, and a premium API dashboard when you need it.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1d4ed8] transition"
              >
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#tiers"
                className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white/70 px-5 py-3 text-sm font-semibold text-[#1b1c20] hover:bg-white transition"
              >
                Compare tiers
              </a>
            </div>
            <p className="text-xs text-black/50">
              Already a customer?{" "}
              <Link to={createPageUrl("Billing")} className="font-semibold text-[#2563eb] hover:underline">
                View usage dashboard
              </Link>
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Blended token cost", value: "~$0.50 / 1M tokens" },
                { label: "Tokens pooled", value: "Across workspaces" },
                { label: "API access", value: "Premium add-on" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-black/10 bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-black/50">{stat.label}</p>
                  <p className="mt-2 text-sm font-semibold text-[#1b1c20]">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-black/10 bg-white/80 shadow-2xl p-8 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-black/50">Usage guardrails</p>
                <h2 className="mt-2 text-2xl font-display text-black">Predictable spend, every month.</h2>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-[#2563eb]/15 flex items-center justify-center animate-[pulseSoft_3s_ease-in-out_infinite]">
                <Cpu className="h-5 w-5 text-[#2563eb]" />
              </div>
            </div>
            <p className="mt-4 text-sm text-black/70 leading-relaxed">
              Pool tokens per org, set caps, and track usage by workspace. Overages only kick in when you scale past the
              included allowance.
            </p>
            <div className="mt-6 space-y-3">
              {overages.map((item) => (
                <div key={item.tier} className="flex items-center justify-between text-sm text-black/70">
                  <span className="font-semibold text-black">{item.tier}</span>
                  <span>{item.rate} (tokens)</span>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-[#f5f7ff] px-4 py-3 text-xs text-black/60">
              All paid tiers include spend alerts, token usage exports, and pooled billing.
            </div>
          </div>
        </section>

        <section id="tiers" className="space-y-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-black/50">Plans</p>
              <h2 className="mt-2 text-3xl font-display text-black">Choose a plan that scales with your team.</h2>
            </div>
            <span className="text-sm text-black/60">
              Low per-seat pricing. Tokens pooled for maximum flexibility.
            </span>
          </div>

            <div className="grid gap-6 lg:grid-cols-4">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative rounded-3xl border p-6 shadow-xl backdrop-blur ${
                  tier.featured
                    ? "border-[#2563eb]/60 bg-white shadow-2xl"
                    : "border-black/10 bg-white/70"
                }`}
              >
                {tier.featured && (
                  <div className="absolute -top-4 left-6 rounded-full bg-[#2563eb] px-3 py-1 text-xs font-semibold text-white">
                    Most popular
                  </div>
                )}
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-black/50">{tier.audience}</p>
                    <h3 className="mt-2 text-xl font-display text-black">{tier.name}</h3>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-display text-black">{tier.price}</span>
                    <span className="text-xs text-black/50">{tier.cadence}</span>
                  </div>
                  <p className="text-sm font-semibold text-[#2563eb]">{tier.tokenAllowance}</p>
                </div>

                <ul className="mt-6 space-y-3 text-sm text-black/70">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-[#2563eb]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {tier.priceKey ? (
                  <button
                    type="button"
                    onClick={() => handleCheckout(tier)}
                    disabled={activeCheckout === tier.name}
                    className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      tier.featured
                        ? "bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
                        : "border border-black/10 bg-white/80 text-black hover:bg-white"
                    } ${activeCheckout === tier.name ? "opacity-70 cursor-not-allowed" : ""}`}
                  >
                    {activeCheckout === tier.name
                      ? "Redirecting..."
                      : user
                        ? tier.cta
                        : "Sign in to subscribe"}
                  </button>
                ) : tier.ctaHref.startsWith("#") ? (
                  <a
                    href={tier.ctaHref}
                    className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      tier.featured
                        ? "bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
                        : "border border-black/10 bg-white/80 text-black hover:bg-white"
                    }`}
                  >
                    {tier.cta}
                  </a>
                ) : (
                  <Link
                    to={tier.ctaHref}
                    className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                      tier.featured
                        ? "bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
                        : "border border-black/10 bg-white/80 text-black hover:bg-white"
                    }`}
                  >
                    {tier.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] items-start">
          <div className="rounded-3xl border border-black/10 bg-white/80 p-8 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-[#f59e0b]/15 flex items-center justify-center">
                <Zap className="h-5 w-5 text-[#f59e0b]" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-black/50">Premium API</p>
                <h3 className="text-2xl font-display text-black">API dashboard add-on</h3>
              </div>
            </div>
            <p className="mt-4 text-sm text-black/70">
              Add API access only when you need it. Keep core product pricing low and unlock enterprise-grade controls.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 text-sm text-black/70">
              {apiAddon.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-[#f59e0b]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-[#fff7ed] px-4 py-3 text-sm text-black/70">
              Starter add-on: <span className="font-semibold text-black">$49 / org / mo</span> + $1.00 per 1M tokens.
            </div>
          </div>

          <div className="rounded-3xl border border-black/10 bg-[#1b1c20] text-white p-8 shadow-2xl" id="enterprise">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Enterprise</p>
                <h3 className="text-2xl font-display text-white">Security-first procurement</h3>
              </div>
            </div>
            <p className="mt-4 text-sm text-white/70">
              Custom token pools, compliance reviews, and private storage deployments. Perfect for regulated QA teams.
            </p>
            <div className="mt-6 space-y-3 text-sm text-white/80">
              {[
                "Dedicated CSM and onboarding",
                "SSO + audit logs",
                "Custom retention policies",
                "Volume token discounts",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-[#fbbf24]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <Link
              to="/"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white text-black px-4 py-2.5 text-sm font-semibold hover:bg-white/90 transition"
            >
              Talk to sales
            </Link>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-[#f59e0b]/15 flex items-center justify-center">
              <Cpu className="h-4 w-4 text-[#f59e0b]" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-black/50">Token guide</p>
              <h3 className="text-2xl font-display text-black">What tokens cover</h3>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "What counts",
                body: "Tokens are the unit for AI text usage. Both input and output count toward your pool.",
              },
              {
                title: "Common actions",
                body: "SOP parsing, step generation, chat assist, and QA summaries use tokens. Regular annotation actions do not.",
              },
              {
                title: "Typical ranges",
                body: "Short prompts can be under 1k tokens. Multi-page SOP extractions can be 5k-20k+ tokens.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-black/10 bg-white/70 p-5">
                <p className="text-sm font-semibold text-black">{item.title}</p>
                <p className="mt-2 text-sm text-black/70">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-[#fff7ed] px-4 py-3 text-xs text-black/60">
            Tokens cover AI text usage only. Training, inference, and storage are metered separately.
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-[#2563eb]/15 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-[#2563eb]" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-black/50">Compute + storage</p>
              <h3 className="text-2xl font-display text-black">Training, inference, and storage</h3>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {usageRates.map((item) => (
              <div key={item.name} className="rounded-2xl border border-black/10 bg-white/70 p-5">
                <p className="text-sm font-semibold text-black">{item.name}</p>
                <p className="mt-2 text-sm font-semibold text-[#2563eb]">{item.rate}</p>
                <p className="mt-2 text-sm text-black/70">{item.detail}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-black/10 bg-white/80 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-black/50">Included usage</p>
            <div className="mt-4 grid gap-3 text-sm text-black/70">
              {includedUsage.map((item) => (
                <div key={item.tier} className="grid gap-2 md:grid-cols-4 md:items-center">
                  <span className="font-semibold text-black">{item.tier}</span>
                  <span>Training: {item.training}</span>
                  <span>Inference: {item.inference}</span>
                  <span>Storage: {item.storage}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-[#f5f7ff] px-4 py-3 text-xs text-black/60">
            Training, inference, and storage appear as separate line items so finance can approve them independently.
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-2xl bg-[#2563eb]/15 flex items-center justify-center">
              <Zap className="h-4 w-4 text-[#2563eb]" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-black/50">FAQ</p>
              <h3 className="text-2xl font-display text-black">Common questions</h3>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {faqs.map((faq) => (
              <div key={faq.question} className="rounded-2xl border border-black/10 bg-white/70 p-5">
                <p className="text-sm font-semibold text-black">{faq.question}</p>
                <p className="mt-2 text-sm text-black/70">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
