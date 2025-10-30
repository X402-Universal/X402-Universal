"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import "./globals.css";

// Simple Chain Badge (text-based so you can swap easily)
function ChainBadge({ label }: { label: string }) {
  return (
    <div className="px-3 py-1 rounded-full border border-white/20 bg-white/5 backdrop-blur text-xs text-white/90 shadow-sm">
      {label}
    </div>
  );
}

// Orbiting chains around a core node
function Orbit({
  radius = 140,
  duration = 18,
  reverse = false,
  items = [],
}: {
  radius?: number;
  duration?: number;
  reverse?: boolean;
  // Accept strings (fallback to text badge) or logo objects { src, alt }
  items: Array<string | { src: string; alt: string }>;
}) {
  // Precompute equally spaced angles for items
  const angles = useMemo(() => {
    return items.map((_, i) => (i / items.length) * Math.PI * 2);
  }, [items.length]);

  return (
    <div
      className="pointer-events-none absolute inset-0 m-auto"
      style={{ width: radius * 2, height: radius * 2 }}
    >
      {/* Orbit ring */}
      <div className="absolute inset-0 rounded-full border border-white/10" />
      {/* Rotating container */}
      <div className="absolute inset-0">
        <motion.div
          style={{ width: "100%", height: "100%", transformOrigin: "50% 50%" }}
          animate={{ rotate: reverse ? -360 : 360 }}
          transition={{ repeat: Infinity, ease: "linear", duration }}
        >
        {angles.map((a, idx) => {
          const item = items[idx];
          const isLogo = typeof item !== "string" && item && "src" in item;
          const size = isLogo ? 40 : 56; // width for positioning; height ~ size for icons
          const halfW = size / 2;
          const halfH = isLogo ? 20 : 14;
          return (
            <div
              key={idx}
              className="absolute"
              style={{
                left: radius + Math.cos(a) * radius - halfW,
                top: radius + Math.sin(a) * radius - halfH,
              }}
            >
              <motion.div
                style={{ transformOrigin: "50% 50%" }}
                animate={{ rotate: reverse ? 360 : -360 }}
                transition={{ repeat: Infinity, ease: "linear", duration }}
              >
                {isLogo ? (
                  <div className="size-10 rounded-full border border-white/20 bg-white/5 backdrop-blur flex items-center justify-center shadow-sm">
                    <img
                      src={(item as { src: string; alt: string }).src}
                      alt={(item as { src: string; alt: string }).alt}
                      className="w-6 h-6 object-contain"
                      draggable={false}
                    />
                  </div>
                ) : (
                  <ChainBadge label={item as string} />
                )}
              </motion.div>
            </div>
          );
        })}
        </motion.div>
      </div>
    </div>
  );
}

function Constellation() {
  // Detect small screens to simplify the number of rings
  const [isSmall, setIsSmall] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 640px)");
    const update = () => setIsSmall(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return (
    <div className="relative w-full aspect-square sm:aspect-[3/2] max-w-[90vw] sm:max-w-4xl mx-auto origin-center scale-100 sm:scale-[0.9] md:scale-100">
      {/* Glow */}
      <div className="absolute inset-0 blur-3xl bg-[radial-gradient(circle_at_center,rgba(0,153,255,0.25),transparent_60%)]" />

      {/* Core node */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="relative">
          <div className="size-20 sm:size-24 rounded-full bg-white/10 border border-white/20 backdrop-blur flex items-center justify-center shadow-2xl overflow-hidden">
            <img src="/micropay.png" alt="MicroPay" className="w-12 h-12 sm:w-14 sm:h-14 object-contain rounded-xl" draggable={false} />
          </div>
          {/* Pulse */}
          <div className="absolute inset-0 rounded-full border border-sky-400/30 animate-ping" />
        </div>
      </div>

      {/* Orbits */}
      {isSmall ? (
        <>
          <Orbit
            radius={95}
            duration={30}
            items={[
              { src: "/base.png", alt: "Base" },
              { src: "/arbitrum.svg", alt: "Arbitrum" },
              { src: "/optimism.svg", alt: "Optimism" },
              { src: "/polygon.svg", alt: "Polygon"}
            ]}
          />
          <Orbit
            radius={150}
            duration={44}
            reverse
            items={[
              { src: "/ethereum.svg", alt: "Ethereum" },
              { src: "/polkadot.svg", alt: "Polkadot" },
              { src: "/bsc.svg", alt: "BSC" },
            ]}
          />
        </>
      ) : (
        <>
          <Orbit
            radius={110}
            duration={28}
            items={[
              { src: "/base.png", alt: "Base" },
              { src: "/arbitrum.svg", alt: "Arbitrum" },
              { src: "/optimism.svg", alt: "Optimism" },
            ]}
          />
          <Orbit
            radius={170}
            duration={40}
            reverse
            items={[
              { src: "/ethereum.svg", alt: "Ethereum" },
              { src: "/polkadot.svg", alt: "Polkadot" },
              { src: "/bsc.svg", alt: "BSC" },
            ]}
          />
          <Orbit radius={230} duration={56} items={[{ src: "/polygon.svg", alt: "Polygon" }]} />
        </>
      )}

      {/* Connection rays */}
      <svg className="absolute inset-0" viewBox="0 0 800 800">
        <defs>
          <linearGradient id="ray" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(56,189,248,0.0)" />
            <stop offset="50%" stopColor="rgba(56,189,248,0.45)" />
            <stop offset="100%" stopColor="rgba(56,189,248,0.0)" />
          </linearGradient>
        </defs>
        {[...Array(24)].map((_, i) => (
          <line
            key={i}
            x1="400"
            y1="400"
            x2={400 + Math.cos((i / 24) * Math.PI * 2) * 360}
            y2={400 + Math.sin((i / 24) * Math.PI * 2) * 360}
            stroke="url(#ray)"
            strokeWidth="1"
          />
        ))}
      </svg>
    </div>
  );
}

function Section({ id, title, subtitle, children }: any) {
  return (
    <section id={id} className="relative py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-6">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-white">{title}</h2>
          {subtitle && (
            <p className="mt-3 text-white/70 max-w-3xl">{subtitle}</p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}

export default function Page() {
  useEffect(() => {
    document.body.classList.add("bg-slate-950");
    return () => document.body.classList.remove("bg-slate-950");
  }, []);

  return (
    <div className="min-h-screen text-white selection:bg-sky-500/30 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 backdrop-blur bg-slate-950/70">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/micropay.png" alt="MicroPay" className="w-6 h-6 rounded-sm object-contain" draggable={false} />
            <span className="font-bold tracking-tight">MicroPay</span>
          </div>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-white/70">
            <a href="#problem" className="hover:text-white">Problem</a>
            <a href="#solution" className="hover:text-white">Solution</a>
            <a href="#how" className="hover:text-white">How it Works</a>
            <a href="#ecosystem" className="hover:text-white">Ecosystem</a>
            <a href="#docs" className="px-3 py-1.5 rounded-md bg-white/10 border border-white/15 hover:bg-white/15 text-white">Docs</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden min-h-[600px] sm:min-h-[650px]">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.20),transparent_40%),radial-gradient(ellipse_at_bottom,rgba(99,102,241,0.15),transparent_45%)]" />

        <div className="max-w-6xl mx-auto px-6 pt-16 pb-28 sm:pt-24 sm:pb-36 md:pb-32">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full border border-white/20 bg-white/5 mb-4">
                <span className="size-1.5 rounded-full bg-sky-400" />
                Interoperability for x402
              </div>
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold leading-tight">
                The <span className="text-sky-400">Interoperability</span> Layer for x402
              </h1>
              <p className="mt-5 text-white/70 max-w-xl">
                Enable truly cross-chain micropayments so users and agents can pay with any token, on any chain,
                while services receive seamlessly where they are.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href="#docs" className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium">Read Whitepaper</a>
                <a href="#join" className="px-4 py-2.5 rounded-xl border border-white/20 hover:bg-white/5">Join Testnet</a>
              </div>
            </div>

            <div className="flex justify-center mt-8 sm:mt-0">
              <Constellation />
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <Section
        id="problem"
        title="The Multi‑Chain Payment Problem"
        subtitle="Payments are siloed within single chains. Even with x402 enabling agentic micropayments, there is no seamless, trustless way to pay on one chain and settle on another."
      >
        <div className="grid md:grid-cols-3 gap-6">
          {[{
            h: "Fragmentation",
            p: "Each chain has its own tokens, liquidity, and tooling, forcing users to stay within one ecosystem.",
          },{
            h: "Manual Workarounds",
            p: "Developers build custom bridges or use custodial relays to move value across chains — slow, costly, risky.",
          },{
            h: "Stalled Agentic UX",
            p: "AI agents can initiate payments, but not seamlessly across networks; cross‑chain subscriptions and pay‑per‑use remain clunky.",
          }].map((card, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-lg font-medium text-white">{card.h}</h3>
              <p className="mt-2 text-sm text-white/70">{card.p}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Solution */}
      <Section
        id="solution"
        title="MicroPay Bridges Every Chain"
        subtitle="A non‑custodial, programmable routing layer on top of x402 that handles cross‑chain conversion and settlement."
      >
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6">
            <ul className="space-y-3 text-white/80 text-sm">
              <li>• Pay on Chain A, receive on Chain B — automatically.</li>
              <li>• Route stablecoin flows across ecosystems without custodial bridges.</li>
              <li>• Programmable hooks for agents (refunds, metering, usage‑based caps).</li>
              <li>• Works with x402 flows; we add the cross‑chain plumbing.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <ol className="list-decimal list-inside text-sm text-white/80 space-y-2">
              <li>Sender (user/agent) attaches payment via x402 on Chain A.</li>
              <li>MicroPay Router performs trust‑minimized cross‑chain route.</li>
              <li>Service receives on its preferred chain; receipts emitted for audit.</li>
            </ol>
          </div>
        </div>
      </Section>

      {/* How it works */}
      <Section id="how" title="How It Works">
        <div className="grid md:grid-cols-3 gap-6">
          {[{
            h: "Send",
            p: "Attach an x402 payment from any supported chain or token.",
          },{
            h: "Route",
            p: "MicroPay selects a path across bridges/routers with on‑chain proofs.",
          },{
            h: "Settle",
            p: "Funds land on the destination chain; service unlocks resource.",
          }].map((s, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-lg font-medium">{s.h}</h3>
              <p className="mt-2 text-sm text-white/70">{s.p}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Use cases */}
      <Section id="usecases" title="Use Cases">
        <div className="grid md:grid-cols-3 gap-6">
          {["AI agents paying compute & data APIs","Cross‑chain SaaS subscriptions","Pay‑per‑call web services","Usage‑metered dApps","Multi‑chain marketplaces","Programmatic refunds & credits"].map((u, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-white/80">
              • {u}
            </div>
          ))}
        </div>
      </Section>

      {/* Ecosystem */}
      <Section id="ecosystem" title="Ecosystem & Integrations" subtitle="Designed to work alongside x402 + your favorite chains and bridges.">
        <div className="flex flex-wrap gap-3 text-xs text-white/80">
          {["x402","Polkadot","Hyperbridge","Base","Arbitrum","Optimism","Ethereum","Polygon","Solana","BSC","Avalanche"].map((e, i) => (
            <ChainBadge key={i} label={e} />
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section id="join" title="Build with MicroPay" subtitle="Join the early builder cohort and help shape the cross‑chain agentic economy.">
        <div className="flex flex-wrap gap-3">
          <a href="#docs" className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium">Get Started</a>
          <a href="#contact" className="px-4 py-2.5 rounded-xl border border-white/20 hover:bg-white/5">Contact Team</a>
        </div>
      </Section>

      <footer className="py-10 border-t border-white/10 text-center text-xs text-white/50">
        © {new Date().getFullYear()} MicroPay. Built for the agentic internet.
      </footer>
    </div>
  );
}
