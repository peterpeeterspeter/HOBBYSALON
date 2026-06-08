"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function safeNextPath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function ConfirmAccountPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = fragment.get("access_token");
    const refreshToken = fragment.get("refresh_token");

    if (!accessToken || !refreshToken) {
      setError("Deze bevestigingslink is ongeldig of verlopen.");
      return;
    }

    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    void fetch("/api/auth/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accessToken, refreshToken }),
    }).then(async (response) => {
      if (!response.ok) {
        setError("Je account kon niet worden bevestigd. Vraag een nieuwe link aan.");
        return;
      }

      const query = new URLSearchParams(window.location.search);
      router.replace(safeNextPath(query.get("next")));
      router.refresh();
    });
  }, [router]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl items-center px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold">Account bevestigen</h1>
        <p className="mt-4 text-neutral-600">
          {error ?? "Je bevestiging wordt verwerkt..."}
        </p>
      </div>
    </main>
  );
}
