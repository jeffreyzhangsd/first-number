"use client";

import { useEffect, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type ResultBody =
  | { result: "first"; firstsCount: number }
  | { result: "taken"; attemptsBefore: number }
  | { error: string };

type HistoryEntry = {
  number: string;
  result: "first" | "taken";
  firstsCount?: number;
  attemptsBefore?: number;
  timestamp: number;
};

const FORMAT = /^[1-9]\d*$/;
const HISTORY_KEY = "first-number:history";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          execution?: "render" | "execute";
        },
      ) => string;
      execute: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

export default function Page() {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ResultBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const widgetIdRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pendingNumberRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;
    const tryRender = () => {
      if (cancelled) return;
      if (!window.turnstile || !containerRef.current || widgetIdRef.current)
        return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        execution: "execute",
        callback: (token) => {
          const num = pendingNumberRef.current;
          pendingNumberRef.current = null;
          if (num) void send(num, token);
        },
        "error-callback": () => {
          pendingNumberRef.current = null;
          setSubmitting(false);
          setError("Bot check failed, refresh and retry.");
        },
      });
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };
    tryRender();
    if (!widgetIdRef.current) {
      intervalId = window.setInterval(tryRender, 200);
    }
    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, []);

  const inputValid =
    value.length > 0 && value.length <= 1000 && FORMAT.test(value);

  function pushHistory(entry: HistoryEntry) {
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, 100);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  }

  async function send(number: string, token: string) {
    setError(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ number, turnstileToken: token }),
      });
      const data = (await res.json()) as ResultBody;
      if (!res.ok || "error" in data) {
        const err = "error" in data ? data.error : "server_error";
        if (res.status >= 500) setError("Server hiccup, try again.");
        else if (err === "bot_check_failed")
          setError("Bot check failed, refresh and retry.");
        else if (err === "invalid_format")
          setError("Positive whole numbers only.");
        else if (err === "too_long") setError("Too long.");
        else setError("Something went wrong.");
      } else {
        setResult(data);
        pushHistory({
          number,
          result: data.result,
          firstsCount: data.result === "first" ? data.firstsCount : undefined,
          attemptsBefore:
            data.result === "taken" ? data.attemptsBefore : undefined,
          timestamp: Date.now(),
        });
      }
    } catch {
      setError("Network error, try again.");
    } finally {
      setSubmitting(false);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValid || submitting) return;
    setSubmitting(true);
    setResult(null);
    setError(null);
    pendingNumberRef.current = value;
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.execute(widgetIdRef.current);
    } else {
      pendingNumberRef.current = null;
      setSubmitting(false);
      setError("Bot check not ready, try again in a moment.");
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-center text-4xl font-bold tracking-tight">
        first number
      </h1>
      <p className="mt-2 text-center text-neutral-600">
        Pick a number. See if you&apos;re the first.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-10 flex flex-col items-center gap-4"
      >
        <input
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value.trim())}
          className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-4 text-center text-3xl font-mono shadow-sm focus:border-neutral-500 focus:outline-none"
          placeholder="42"
        />
        <button
          type="submit"
          disabled={!inputValid || submitting}
          className="rounded-lg bg-neutral-900 px-6 py-3 text-white font-medium disabled:opacity-40"
        >
          {submitting ? "Checking…" : "Submit"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <div ref={containerRef} className="hidden" />

      {result && "result" in result && (
        <div
          className={`mt-8 rounded-lg p-5 text-center ${
            result.result === "first"
              ? "bg-emerald-50 border border-emerald-200"
              : "bg-neutral-100 border border-neutral-200"
          }`}
        >
          {result.result === "first" ? (
            <>
              <p className="text-xl font-semibold text-emerald-900">FIRST!</p>
              <p className="mt-1 text-sm text-emerald-800">
                You&apos;re the {result.firstsCount}
                {ordinal(result.firstsCount)} unique number ever submitted.
              </p>
            </>
          ) : (
            <>
              <p className="text-xl font-semibold text-neutral-900">Taken.</p>
              <p className="mt-1 text-sm text-neutral-700">
                {result.attemptsBefore}{" "}
                {result.attemptsBefore === 1 ? "other tried" : "others tried"}{" "}
                that number before you.
              </p>
            </>
          )}
        </div>
      )}

      {history.length > 0 && (
        <section className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Your history
          </h2>
          <ul className="mt-3 divide-y divide-neutral-200 border-t border-b border-neutral-200">
            {history.map((h) => (
              <li
                key={`${h.timestamp}-${h.number}`}
                className="flex items-center justify-between py-2 font-mono text-sm"
              >
                <span className="truncate">{h.number}</span>
                <span
                  className={
                    h.result === "first"
                      ? "text-emerald-700"
                      : "text-neutral-500"
                  }
                >
                  {h.result === "first"
                    ? "FIRST"
                    : `TAKEN (${h.attemptsBefore})`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}
