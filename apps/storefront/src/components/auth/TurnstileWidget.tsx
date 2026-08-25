"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Cloudflare Turnstile widget (managed mode).
 * Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set (local/dev).
 *
 * If the script fails to load within a few seconds (adblockers commonly block
 * challenges.cloudflare.com), the user sees a clear explanation instead of a
 * silent missing checkbox. The server still enforces the captcha, so users in
 * that state are told how to proceed.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        options: Record<string, unknown>
      ) => string | undefined;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
/** ms to wait for the Turnstile script before showing the blocked notice. */
const SCRIPT_TIMEOUT_MS = 6000;

type TurnstileWidgetProps = {
  /** Called with the token whenever the widget produces/resets one. */
  onTokenChange: (token: string | null) => void;
};

export function TurnstileWidget({ onTokenChange }: TurnstileWidgetProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const callbackRef = useRef(onTokenChange);
  const [scriptReady, setScriptReady] = useState(
    typeof window !== "undefined" && Boolean(window.turnstile)
  );
  const [scriptFailed, setScriptFailed] = useState(false);
  const elementId = useId();

  callbackRef.current = onTokenChange;

  useEffect(() => {
    if (!siteKey || scriptReady) return;

    function handleLoad() {
      setScriptReady(true);
    }

    if (document.querySelector(`script[src^="${SCRIPT_SRC}"]`)) {
      window.onTurnstileLoad = handleLoad;
      // Script may already be loaded and executed.
      if (window.turnstile) handleLoad();
      return;
    }

    window.onTurnstileLoad = handleLoad;
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    // Detect total load failure (blocked by extension / network).
    script.onerror = () => setScriptFailed(true);
    document.head.appendChild(script);

    const timeout = window.setTimeout(() => {
      if (!window.turnstile) setScriptFailed(true);
    }, SCRIPT_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeout);
      delete window.onTurnstileLoad;
    };
  }, [siteKey, scriptReady]);

  useEffect(() => {
    if (!siteKey || !scriptReady || !containerRef.current) return;
    const el = containerRef.current;
    const turnstile = window.turnstile;
    if (!turnstile) return;

    const widgetId = turnstile.render(el, {
      sitekey: siteKey,
      callback: (token: string) => callbackRef.current(token),
      "expired-callback": () => callbackRef.current(null),
      "error-callback": () => callbackRef.current(null),
      theme: "light",
      language: "nl",
    });
    widgetIdRef.current = widgetId ?? null;

    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Widget already gone — ignore.
        }
      }
      widgetIdRef.current = null;
    };
  }, [siteKey, scriptReady]);

  if (!siteKey) return null;

  if (scriptFailed && !scriptReady) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900"
      >
        De beveiligingscontrole kan niet laden. Dit komt meestal door een
        adblocker of privacy-extensie die Cloudflare blokkeert. Schakel deze
        uit voor hobbysalon.be of gebruik een incognitovenster, en herlaad de
        pagina.
      </p>
    );
  }

  return (
    <div>
      <div id={elementId} ref={containerRef} />
      <noscript>
        <p className="text-sm text-red-700">
          Schakel JavaScript in om de beveiligingscontrole te voltooien.
        </p>
      </noscript>
    </div>
  );
}
