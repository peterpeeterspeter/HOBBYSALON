"use client";

import { useState, useEffect } from "react";
import { CalculatorCard } from "./CalculatorCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Project = {
  id: string;
  name: string;
  yarn: string;
  needles: string;
  gauge: string;
  progress: string;
};

const STORAGE_KEY = "hobbysalon-projects";

export function Projectplanner() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [yarn, setYarn] = useState("");
  const [needles, setNeedles] = useState("");
  const [gauge, setGauge] = useState("");
  const [progress, setProgress] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setProjects(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    }
  }, [projects]);

  const addProject = () => {
    if (!name.trim()) return;
    setProjects((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        yarn: yarn.trim(),
        needles: needles.trim(),
        gauge: gauge.trim(),
        progress: progress.trim(),
      },
    ]);
    setName("");
    setYarn("");
    setNeedles("");
    setGauge("");
    setProgress("");
  };

  const removeProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <CalculatorCard title="Projectplanner">
      <div className="space-y-6">
        <p className="text-sm text-[var(--muted)]">
          Sla garens, naalden, stekenproef en voortgang op per project. Data
          blijft lokaal in je browser.
        </p>

        <div className="space-y-4 rounded-lg border border-[var(--border)] p-4">
          <h3 className="font-medium text-[var(--foreground)]">
            Nieuw project
          </h3>
          <Input
            label="Projectnaam"
            placeholder="bijv. Wintertrui"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Garen"
            placeholder="Merk, kleur, aantal bollen"
            value={yarn}
            onChange={(e) => setYarn(e.target.value)}
          />
          <Input
            label="Naalden"
            placeholder="bijv. 4 mm rondbreinaald"
            value={needles}
            onChange={(e) => setNeedles(e.target.value)}
          />
          <Input
            label="Stekenproef"
            placeholder="bijv. 20 st x 28 r = 10 cm"
            value={gauge}
            onChange={(e) => setGauge(e.target.value)}
          />
          <Input
            label="Voortgang"
            placeholder="bijv. Achterpand klaar"
            value={progress}
            onChange={(e) => setProgress(e.target.value)}
          />
          <Button type="button" onClick={addProject}>
            Toevoegen
          </Button>
        </div>

        {projects.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium text-[var(--foreground)]">
              Mijn projecten
            </h3>
            {projects.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-[var(--border)] p-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-[var(--foreground)]">
                      {p.name}
                    </p>
                    {p.yarn && (
                      <p className="text-sm text-[var(--muted)]">
                        Garen: {p.yarn}
                      </p>
                    )}
                    {p.needles && (
                      <p className="text-sm text-[var(--muted)]">
                        Naalden: {p.needles}
                      </p>
                    )}
                    {p.gauge && (
                      <p className="text-sm text-[var(--muted)]">
                        Gauge: {p.gauge}
                      </p>
                    )}
                    {p.progress && (
                      <p className="text-sm text-[var(--accent)] mt-1">
                        {p.progress}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => removeProject(p.id)}
                  >
                    Verwijder
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CalculatorCard>
  );
}
