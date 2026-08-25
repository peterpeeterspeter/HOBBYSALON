"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

/**
 * Cloudflare Turnstile widget.
 *
 * Uses the official implicit rendering flow: a container div with a
 * data-sitekey attribute is picked up automatically by the Turnstile script,
 * which replaces its content with an iframe. This avoids the explicit-API
 * race with React's hydration (render into a node React may replace).
 *
 * The token is read from the hidden input that Turnstile manages and pushed
 * to onTokenChange so server actions can pass it to Supabase.
 *
 * Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set (local/dev).
 */

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        options?: Record<string, unknown>
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
  const callbackRef = useRef(onTokenChange);
  const [scriptReady, setScriptReady] = useState(
    typeof window !== "undefined" && Boolean(window.turnstile)
  );
  const [scriptFailed, setScriptFailed] = useState(false);
  const elementId = useId();

  const pushToken = useCallback(() => {
    const input = containerRef.current?.querySelector<HTMLInputElement>(
      'input[name="cf-turnstile-response"]'
    );
    const value = input?.value ?? "";
    // Turnstile writes "" when expired/reset — normalise to null.
    callbackRef.current(value.length > 0 ? value : null);
  }, []);

  useEffect(() => {
    callbackRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    if (!siteKey || scriptReady) return;

    function handleLoad() {
      setScriptReady(true);
    }

    if (document.querySelector(`script[src^="${SCRIPT_SRC}"]`)) {
      window.onTurnstileLoad = handleLoad;
      if (window.turnstile) handleLoad();
      return;
    }

    window.onTurnstileLoad = handleLoad;
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
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

  // After the script is ready, render explicitly but into a container that
  // this component owns and never re-renders (no state changes touch it).
  // Poll the managed hidden input so tokens flow regardless of callbacks.
  useEffect(() => {
    if (!siteKey || !scriptReady || !containerRef.current || !window.turnstile)
      return;

    const widgetId = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: "light",
      language: "nl",
      callback: () => pushToken(),
      "expired-callback": () => callbackRef.current(null),
      "error-callback": () => callbackRef.current(null),
    });

    const interval = window.setInterval(pushToken, 500);

    return () => {
      window.clearInterval(interval);
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          // Widget already gone — ignore.
        }
      }
    };
  }, [siteKey, scriptReady, pushToken]);

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
