"use client";

import React, { useMemo, useRef, useState } from "react";

/**
 * Cross-Chain AI/Computation as a Service (402 + Hyperbridge)
 * -----------------------------------------------------------
 * A single-file React demo that simulates the full client-side flow:
 *   1) dApp requests AI inference from a Polkadot parachain service
 *   2) Service responds with HTTP 402 Payment Required (simulated)
 *   3) User pays via Hyperbridge in a local token (simulated)
 *   4) Request is retried and the result is returned
 *
 * Design Notes
 * - Dark, elegant UI with soft glass panels and subtle animations
 * - No external UI libraries required; Tailwind classes assumed
 * - All logic is mocked locally so you can drop-in to any project
 */

// -------------------------------
// Mocked Service & Hyperbridge SDK
// -------------------------------

type FeeQuote = {
  amount: number; // e.g. 0.25
  token: string; // e.g. "USDC"
  acceptedChains: Array<"Polkadot" | "Ethereum" | "BSC" | "Solana">;
  paymentMemo: string; // e.g. payment channel ID or reference
};

type InferenceResponse = {
  ok: boolean;
  status: number; // 200 | 402 | 500
  result?: string;
  fee?: FeeQuote;
  error?: string;
};

// In a real build, you would call your parachain RPC / gateway.
// Here we simulate the 402 then success after payment.
const mockedPolkadotAIService = (() => {
  let hasCredit = false; // toggled true after Hyperbridge payment

  return {
    async infer(prompt: string): Promise<InferenceResponse> {
      await sleep(800);
      if (!prompt.trim()) {
        return { ok: false, status: 500, error: "Empty prompt" };
      }
      if (!hasCredit) {
        return {
          ok: false,
          status: 402,
          fee: {
            amount: 0.25,
            token: "USDC",
            acceptedChains: ["Polkadot", "Ethereum", "BSC", "Solana"],
            paymentMemo: `SESSION-${Math.random()
              .toString(36)
              .slice(2, 8)
              .toUpperCase()}`,
          },
        };
      }
      // Consume the credit and return a fake result
      hasCredit = false;
      return {
        ok: true,
        status: 200,
        result: generateMockedAnswer(prompt),
      };
    },

    // The Hyperbridge settlement will notify this function in real life.
    creditOnce() {
      hasCredit = true;
    },
  };
})();

// Simulated Hyperbridge client
async function hyperbridgePay({
  fromChain,
  token,
  amount,
  memo,
}: {
  fromChain: "Polkadot" | "Ethereum" | "BSC" | "Solana";
  token: string;
  amount: number;
  memo: string;
}) {
  // 1) Open channel / route
  await sleep(600);
  // 2) Confirm allowlist / route quoting
  await sleep(600);
  // 3) Finalize and emit settlement event
  await sleep(900);
  // Notify our mocked service that credit has arrived
  mockedPolkadotAIService.creditOnce();
  return { txHash: mockTxHash(fromChain), settled: true } as const;
}

function mockTxHash(chain: string) {
  return `${chain.toUpperCase()}-0x${Math.random()
    .toString(16)
    .slice(2, 10)}${Math.random().toString(16).slice(2, 10)}`;
}

function generateMockedAnswer(prompt: string) {
  const trimmed = prompt.trim();
  const summary =
    trimmed.length > 180 ? trimmed.slice(0, 177) + "..." : trimmed;
  const hash = btoa(unescape(encodeURIComponent(summary))).slice(0, 10);
  return [
    `Inference OK \u2014 Polkadot Parachain Compute`,
    `Prompt Hash: ${hash}`,
    `Latency: ~1.4s  |  Cost: 0.25 USDC`,
    "\nAnswer:",
    `\u2022 ${summary}`,
    "\n(This is a simulated response. Wire your own model output here.)",
  ].join("\n");
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

// -------------------------------
// UI Helpers
// -------------------------------

const CHAINS = ["Ethereum", "Solana", "BSC", "Polkadot"] as const;

type Stage =
  | "idle"
  | "requesting"
  | "payment_required"
  | "paying"
  | "executing"
  | "done"
  | "error";

function clsx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

// -------------------------------
// App Component
// -------------------------------

export default function CrossChainAIServiceDemo() {
  const [prompt, setPrompt] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<string>("");
  const [fee, setFee] = useState<FeeQuote | null>(null);
  const [payChain, setPayChain] = useState<(typeof CHAINS)[number]>("Ethereum");
  const [token, setToken] = useState("USDC");
  const [txHash, setTxHash] = useState<string | null>(null);

  const canRequest = useMemo(
    () =>
      prompt.trim().length > 0 && stage !== "requesting" && stage !== "paying",
    [prompt, stage]
  );

  const onRequest = async () => {
    setStage("requesting");
    setResult("");
    setTxHash(null);
    pushLog("Request → Polkadot AI Parachain");
    const res = await mockedPolkadotAIService.infer(prompt);

    if (res.status === 402 && res.fee) {
      setFee(res.fee);
      setStage("payment_required");
      pushLog(
        `402 Payment Required → ${res.fee.amount} ${res.fee.token} (memo: ${res.fee.paymentMemo})`
      );
      return;
    }

    if (res.ok && res.status === 200 && res.result) {
      pushLog("200 OK → Inference ready");
      setStage("done");
      setResult(res.result);
    } else {
      setStage("error");
      pushLog(`Error ${res.status}: ${res.error ?? "Unknown"}`);
    }
  };

  const onPay = async () => {
    if (!fee) return;
    setStage("paying");
    pushLog(`Hyperbridge: paying ${fee.amount} ${fee.token} from ${payChain}`);

    try {
      const { txHash, settled } = await hyperbridgePay({
        fromChain: payChain,
        token,
        amount: fee.amount,
        memo: fee.paymentMemo,
      });
      setTxHash(txHash);
      pushLog(`Hyperbridge settled ✓  tx: ${txHash}`);

      // Retry request now that service has credit
      setStage("executing");
      pushLog("Retry → Polkadot AI Parachain");
      const res = await mockedPolkadotAIService.infer(prompt);
      if (res.ok && res.status === 200 && res.result) {
        setResult(res.result);
        setStage("done");
        pushLog("200 OK → Inference ready");
      } else {
        setStage("error");
        pushLog(`Error ${res.status}: ${res.error ?? "Unknown"}`);
      }
    } catch (e) {
      setStage("error");
      pushLog("Hyperbridge payment failed");
    }
  };

  const onReset = () => {
    setStage("idle");
    setResult("");
    setLog([]);
    setFee(null);
    setTxHash(null);
  };

  function pushLog(msg: string) {
    setLog((l) => [timestamp(), msg, ...l]);
  }

  return (
    <div className="min-h-[100dvh] w-full bg-[radial-gradient(1200px_600px_at_70%_-10%,#0b1220_0%,#05070d_40%,#03040a_70%,#000_100%)] text-neutral-200">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-black/30 border-b border-white/5">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <div className="text-sm uppercase tracking-widest text-white/70">
              Polkadot Compute Hub
            </div>
          </div>
          <div className="text-xs text-white/50">402 + Hyperbridge Demo</div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Prompt Panel */}
        <section className="rounded-2xl border border-white/10 bg-white/5 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.6)] overflow-hidden">
          <div className="border-b border-white/10 px-5 py-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-white/90">
              AI Inference Request
            </h2>
            <StatusPill stage={stage} />
          </div>

          <div className="p-5 flex flex-col gap-4">
            <label className="text-xs text-white/60">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask the Polkadot parachain to run inference (e.g. summarize this text, classify sentiment, run a small code snippet, etc.)"
              className={clsx(
                "min-h-[140px] rounded-xl bg-black/40 focus:outline-none placeholder:text-white/30",
                "border border-white/10 px-4 py-3 text-sm leading-6",
                "focus:ring-2 focus:ring-purple-400/30 focus:border-white/20"
              )}
            />

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <ModelSelect />
              <LatencyBadge />
              <CostBadge />
              <div className="flex-1" />
              <button
                disabled={!canRequest}
                onClick={onRequest}
                className={clsx(
                  "px-4 py-2 rounded-xl text-sm font-semibold",
                  "bg-gradient-to-br from-fuchsia-500/80 to-indigo-500/80 text-white",
                  "shadow hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                {stage === "requesting" ? "Requesting…" : "Request Inference"}
              </button>
              {stage !== "idle" && (
                <button
                  onClick={onReset}
                  className="px-3 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/10"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Payment Required Banner */}
          {stage === "payment_required" && fee && (
            <div className="border-t border-white/10 bg-amber-500/10">
              <div className="p-5 flex flex-col lg:flex-row items-start lg:items-center gap-4">
                <div className="flex items-center gap-2 text-amber-300">
                  <ShieldIcon />
                  <span className="text-sm font-semibold">
                    402 Payment Required
                  </span>
                </div>
                <div className="text-sm text-white/80">
                  Fee quoted:{" "}
                  <span className="font-semibold">
                    {fee.amount} {fee.token}
                  </span>{" "}
                  · Memo:{" "}
                  <span className="font-mono text-white/70">
                    {fee.paymentMemo}
                  </span>
                </div>
                <div className="flex-1" />
                <button
                  onClick={onPay}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/15 border border-white/10"
                >
                  Pay with Hyperbridge
                </button>
              </div>

              {/* Chain & Token Controls */}
              <div className="px-5 pb-5 flex flex-col lg:flex-row gap-3 lg:items-center">
                <div className="text-xs text-white/60">Pay From Chain</div>
                <div className="flex flex-wrap gap-2">
                  {CHAINS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setPayChain(c)}
                      className={clsx(
                        "px-3 py-1.5 rounded-lg text-xs border",
                        c === payChain
                          ? "border-fuchsia-400/40 bg-fuchsia-500/10 text-white"
                          : "border-white/10 bg-white/5 hover:bg-white/10 text-white/80"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="h-px w-full lg:h-6 lg:w-px bg-white/10 lg:mx-2" />
                <div className="text-xs text-white/60">Token</div>
                <div className="flex gap-2">
                  {"USDC,USDT,DOT".split(",").map((t) => (
                    <button
                      key={t}
                      onClick={() => setToken(t)}
                      className={clsx(
                        "px-3 py-1.5 rounded-lg text-xs border",
                        t === token
                          ? "border-indigo-400/40 bg-indigo-500/10 text-white"
                          : "border-white/10 bg-white/5 hover:bg-white/10 text-white/80"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Paying State */}
          {stage === "paying" && (
            <div className="border-t border-white/10 p-5 flex items-center gap-3 text-white/80">
              <Spinner />
              <div className="text-sm">
                Hyperbridge is routing your payment…
              </div>
            </div>
          )}

          {/* Executing State */}
          {stage === "executing" && (
            <div className="border-t border-white/10 p-5 flex items-center gap-3 text-white/80">
              <Spinner />
              <div className="text-sm">
                Compute credits received ✓ Executing inference on Polkadot…
              </div>
            </div>
          )}

          {/* Result */}
          {stage === "done" && (
            <div className="border-t border-white/10 p-5">
              <h3 className="text-sm font-semibold text-white/90 mb-2">
                Result
              </h3>
              <pre className="text-xs leading-6 whitespace-pre-wrap p-4 rounded-xl bg-black/50 border border-white/10 text-white/80 overflow-auto max-h-[40vh]">
                {result}
              </pre>
            </div>
          )}

          {/* Error */}
          {stage === "error" && (
            <div className="border-t border-white/10 p-5 text-red-300 text-sm">
              Something went wrong. Try resetting and submitting again.
            </div>
          )}
        </section>

        {/* Right: Activity & Receipts */}
        <section className="rounded-2xl border border-white/10 bg-white/5 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.6)] overflow-hidden">
          <div className="border-b border-white/10 px-5 py-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-white/90">
              Activity
            </h2>
            <div className="text-xs text-white/50">Client-side log</div>
          </div>

          <div className="p-5">
            {txHash && (
              <div className="mb-5">
                <div className="text-xs text-white/60 mb-1">Last Payment</div>
                <div className="rounded-xl border border-white/10 bg-black/40 p-4 text-xs">
                  <div className="flex items-center gap-2">
                    <ChainIcon chain={payChain} />
                    <div className="font-mono text-white/80">{txHash}</div>
                  </div>
                  <div className="mt-2 text-white/60">
                    Settled via Hyperbridge • Token: {token}
                  </div>
                </div>
              </div>
            )}

            <div className="text-xs text-white/60 mb-1">Timeline</div>
            <ul className="space-y-2 max-h-[60vh] overflow-auto pr-1">
              {log.length === 0 && (
                <li className="text-white/40 text-sm">
                  No activity yet. Submit an inference request to begin.
                </li>
              )}
              {log.map((l, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs whitespace-pre-wrap"
                >
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-white/40">
        Demo only. Replace mocked service + Hyperbridge call with your real
        endpoints.
      </footer>
    </div>
  );
}

// -------------------------------
// Small UI Bits
// -------------------------------

function StatusPill({ stage }: { stage: Stage }) {
  const map: Record<Stage, { label: string; tone: string }> = {
    idle: { label: "Idle", tone: "bg-white/5 text-white/70 border-white/10" },
    requesting: {
      label: "Requesting",
      tone: "bg-sky-500/10 text-sky-300 border-sky-300/20",
    },
    payment_required: {
      label: "402 Payment Required",
      tone: "bg-amber-500/10 text-amber-300 border-amber-300/20",
    },
    paying: {
      label: "Paying (Hyperbridge)",
      tone: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-300/20",
    },
    executing: {
      label: "Executing",
      tone: "bg-indigo-500/10 text-indigo-300 border-indigo-300/20",
    },
    done: {
      label: "Done",
      tone: "bg-emerald-500/10 text-emerald-300 border-emerald-300/20",
    },
    error: {
      label: "Error",
      tone: "bg-red-500/10 text-red-300 border-red-300/20",
    },
  };
  const s = map[stage];
  return (
    <span className={clsx("px-3 py-1 rounded-lg text-[11px] border", s.tone)}>
      {s.label}
    </span>
  );
}

function ModelSelect() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/60">Model</span>
      <div className="flex overflow-hidden rounded-xl border border-white/10">
        {[
          { k: "S", label: "S" },
          { k: "M", label: "M" },
          { k: "L", label: "L" },
        ].map((m, i) => (
          <button
            key={m.k}
            className={clsx(
              "px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white/80",
              i !== 0 && "border-l border-white/10"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LatencyBadge() {
  return (
    <span className="text-[11px] text-white/60 px-2 py-1 rounded-lg border border-white/10 bg-white/5">
      ~1.4s est.
    </span>
  );
}
function CostBadge() {
  return (
    <span className="text-[11px] text-white/60 px-2 py-1 rounded-lg border border-white/10 bg-white/5">
      0.25 USDC est.
    </span>
  );
}

function Logo() {
  return (
    <div className="relative h-7 w-7 grid place-items-center rounded-xl bg-[conic-gradient(from_180deg,rgba(217,70,239,.25),rgba(99,102,241,.25))] border border-white/10">
      <span className="text-white/80 text-xs font-black">AI</span>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d="M12 2l7 3v6c0 5-3.4 9.3-7 11-3.6-1.7-7-6-7-11V5l7-3z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="size-4 animate-spin text-white/70"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

function ChainIcon({ chain }: { chain: string }) {
  const letter = chain.slice(0, 1);
  return (
    <div className="size-5 rounded-md grid place-items-center border border-white/10 bg-white/5 text-[10px] font-semibold text-white/80">
      {letter}
    </div>
  );
}

function timestamp() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `[${hh}:${mm}:${ss}]`;
}
