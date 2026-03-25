import { useEffect, useMemo, useState } from "react";

const patterns: Record<string, string[]> = {
  spin: ["A", "D", "S"],
  wave: ["A", "D", "A", "D"],
  punch: ["S", "S", "D"],
};

const danceNames: { key: string; label: string; icon: string }[] = [
  { key: "spin", label: "Spin", icon: "⟳" },
  { key: "wave", label: "Wave", icon: "👋" },
  { key: "punch", label: "Punch", icon: "🥊" },
];

const UNLOCK_KEY = "microbit-dance-unlocks";

export default function UnlockPage() {
  const [, setMovements] = useState<string[]>([]);
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem(UNLOCK_KEY) ?? "{}") as Record<string, boolean>;
    } catch {
      return {};
    }
  });
  const [log, setLog] = useState<string[]>([]);

  const addLog = (text: string) => {
    setLog((previous) => [text, ...previous].slice(0, 30));
  };

  const unlockDance = (name: string) => {
    setUnlocked((prev) => {
      const next = { ...prev, [name]: true };
      try {
        localStorage.setItem(UNLOCK_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    addLog(`Unlocked: ${name}`);
  };

  const checkPatterns = (nextMovements: string[]) => {
    for (const dance of Object.keys(patterns)) {
      if (unlocked[dance]) continue;
      const pattern = patterns[dance];
      if (nextMovements.slice(-pattern.length).join() === pattern.join()) {
        unlockDance(dance);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toUpperCase();
      if (!["A", "D", "S"].includes(key)) return;
      setMovements((prev) => {
        const next = [...prev, key];
        checkPatterns(next);
        return next;
      });
      addLog(`Movement: ${key}`);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [unlocked]);

  const danceCards = useMemo(
    () =>
      danceNames.map((dance) => {
        const isUnlocked = Boolean(unlocked[dance.key]);
        return (
          <div
            key={dance.key}
            className={`dance ${isUnlocked ? "unlocked" : "locked"}`}
            aria-label={dance.label}
          >
            {isUnlocked ? dance.icon : "?"}
            <p>{dance.label}</p>
          </div>
        );
      }),
    [unlocked]
  );

  return (
    <>
      <h1>Dance Unlock</h1>
      <p>Press the keys <strong>A</strong>, <strong>D</strong>, and <strong>S</strong> to unlock dances.</p>

      <div className="dance-grid">{danceCards}</div>

      <h3>Movement Log</h3>
      <div id="log" aria-live="polite">
        {log.map((entry, index) => (
          <div key={index}>{entry}</div>
        ))}
      </div>
    </>
  );
}
