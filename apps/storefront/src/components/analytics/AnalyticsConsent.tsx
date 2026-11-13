"use client";

import { useEffect, useRef, useState } from "react";
import { CONSENT_CHANGED, CONSENT_KEY, readConsent, setConsent } from "@/lib/analytics/consent";

const choiceClass = "min-h-12 rounded-lg border border-[var(--border)] bg-[var(--card)] px-5 py-3 text-base font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

/** Native modal provides focus trapping and Escape; preferences stay keyboard reachable. */
export function AnalyticsConsent() {
  const dialog = useRef<HTMLDialogElement>(null);
  const preferences = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (readConsent() === "pending") dialog.current?.showModal();
    const onStorage = (event: StorageEvent) => {
      if (event.key === CONSENT_KEY || event.key === null) window.dispatchEvent(new Event(CONSENT_CHANGED));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function choose(choice: "granted" | "denied") {
    const result = setConsent(choice);
    if (choice === "granted" && result !== "granted") {
      setError("Uw keuze kon niet worden bewaard. Analytische cookies blijven uitgeschakeld.");
      return;
    }
    setError("");
    dialog.current?.close();
    preferences.current?.focus();
  }

  return (
    <>
      <button ref={preferences} type="button" aria-haspopup="dialog" aria-controls="hs-cookie-preferences"
        className={`${choiceClass} fixed bottom-3 left-3 z-40 shadow-sm`}
        onClick={() => dialog.current?.showModal()}>
        Cookievoorkeuren wijzigen
      </button>
      <dialog ref={dialog} id="hs-cookie-preferences" aria-labelledby="hs-cookie-title" aria-describedby="hs-cookie-description"
        className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 text-[var(--foreground)] backdrop:bg-black/40">
        <h2 id="hs-cookie-title" className="mb-3 text-xl font-bold">Analytische cookies</h2>
        <p id="hs-cookie-description" className="mb-5 text-base leading-relaxed">
          Met uw toestemming gebruiken we Google Analytics om openbare pagina’s en gebruik van Hobbysalon te meten.
          Zonder toestemming laden we Google Analytics niet. Advertentiecookies blijven uitgeschakeld.
          Uw keuze geldt alleen voor deze website en kan altijd worden gewijzigd.
        </p>
        <a href="/privacy" className="mb-5 inline-block underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Lees ons privacybeleid</a>
        {error && <p role="alert" className="mb-4 text-base">{error}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="button" className={choiceClass} onClick={() => choose("granted")}>Toestaan</button>
          <button type="button" className={choiceClass} onClick={() => choose("denied")}>Weigeren</button>
        </div>
        <button type="button" className="mt-4 min-h-11 px-2 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={() => dialog.current?.close()}>Sluiten zonder wijziging</button>
      </dialog>
    </>
  );
}
