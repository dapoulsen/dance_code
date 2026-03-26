import { useEffect, useState } from "react";
import type { DragEvent } from "react";

const AVAILABLE_DANCE_MOVES: { key: string; label: string; icon: string }[] = [
  { key: "spin", label: "Spin", icon: "⟳" },
  { key: "wave", label: "Wave", icon: "👋" },
  { key: "punch", label: "Punch", icon: "🥊" },
];

type DanceMoveKey = "spin" | "wave" | "punch";

const UNLOCK_KEY = "microbit-dance-unlocks";
const BPM = 30; // Slow BPM
const BEAT_DURATION = (60 / BPM) * 1000; // Duration of one beat in milliseconds
const TIMELINE_SLOTS = 10; // Number of beat slots in the timeline

interface TimelineSlot {
  id: string;
  move: DanceMoveKey | null;
}

export default function CodingPage() {
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>({});
  const [timeline, setTimeline] = useState<TimelineSlot[]>(
    Array.from({ length: TIMELINE_SLOTS }, (_, i) => ({
      id: `slot-${i}`,
      move: null,
    }))
  );
  const [currentBeat, setCurrentBeat] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Load unlocks from localStorage
  useEffect(() => {
    try {
      const loaded = JSON.parse(localStorage.getItem(UNLOCK_KEY) ?? "{}") as Record<string, boolean>;
      setUnlocked(loaded);
    } catch {
      setUnlocked({});
    }
  }, []);

  // Metronome animation
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentBeat((prev) => (prev + 1) % TIMELINE_SLOTS);
    }, BEAT_DURATION);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleDragStart = (e: DragEvent<HTMLDivElement>, move: DanceMoveKey) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ move }));
  };

  const handleDropOnSlot = (slotIndex: number, e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const payload = e.dataTransfer.getData("application/json");
    if (!payload) return;

    try {
      const data = JSON.parse(payload);
      if (data.move) {
        setTimeline((prev) => {
          const next = [...prev];
          next[slotIndex] = { ...next[slotIndex], move: data.move };
          return next;
        });
      }
    } catch {
      // ignore
    }
  };

  const clearSlot = (slotIndex: number) => {
    setTimeline((prev) => {
      const next = [...prev];
      next[slotIndex] = { ...next[slotIndex], move: null };
      return next;
    });
  };

  const clearAllSlots = () => {
    setTimeline((prev) =>
      prev.map((slot) => ({
        ...slot,
        move: null,
      }))
    );
  };

  return (
    <>
      <h1>Dance Code Builder</h1>
      <p>Drag unlocked moves into the beat timeline to choreograph your dance.</p>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* BPM and Playback Controls */}
        <div style={{ marginBottom: "24px", textAlign: "center" }}>
          <div style={{ marginBottom: "12px" }}>
            <span style={{ fontSize: "1.1rem", fontWeight: 600, marginRight: "16px" }}>
              BPM: {BPM}
            </span>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                padding: "8px 16px",
                fontSize: "1rem",
                backgroundColor: isPlaying ? "rgba(46, 204, 113, 0.6)" : "rgba(56, 176, 255, 0.6)",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
          </div>

          {/* Visual Metronome */}
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              margin: "0 auto",
              backgroundColor: isPlaying ? "#2ecc71" : "rgba(100, 100, 100, 0.3)",
              transition: "all 0.1s",
              animation: isPlaying ? "pulse 0.5s ease-in-out infinite" : "none",
            }}
          />
        </div>

        {/* Unlocked Moves Palette */}
        <div style={{ marginBottom: "24px", padding: "16px", backgroundColor: "rgba(56, 176, 255, 0.1)", borderRadius: "8px", border: "1px solid rgba(56, 176, 255, 0.3)" }}>
          <h2 style={{ marginTop: 0, marginBottom: "12px" }}>Unlocked Moves</h2>
          <p style={{ fontSize: "0.9rem", color: "rgba(255, 255, 255, 0.7)", marginTop: 0, marginBottom: "12px" }}>
            Drag a move to a beat slot below to add it to your choreography.
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {AVAILABLE_DANCE_MOVES.map((move) => {
              const isUnlocked = Boolean(unlocked[move.key]);
              return (
                <div
                  key={move.key}
                  draggable={isUnlocked}
                  onDragStart={(e) => isUnlocked && handleDragStart(e, move.key as DanceMoveKey)}
                  style={{
                    padding: "12px 16px",
                    backgroundColor: isUnlocked ? "rgba(46, 204, 113, 0.2)" : "rgba(100, 100, 100, 0.2)",
                    border: "1px solid " + (isUnlocked ? "rgba(46, 204, 113, 0.4)" : "rgba(100, 100, 100, 0.3)"),
                    borderRadius: "8px",
                    cursor: isUnlocked ? "grab" : "not-allowed",
                    opacity: isUnlocked ? 1 : 0.5,
                    fontSize: "1.2rem",
                    fontWeight: 600,
                    userSelect: "none",
                  }}
                >
                  {move.icon} {move.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline Grid */}
        <div style={{ marginBottom: "24px" }}>
          <h2>Beat Timeline ({TIMELINE_SLOTS} beats)</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${TIMELINE_SLOTS}, 1fr)`,
              gap: "8px",
              padding: "16px",
              backgroundColor: "rgba(0, 0, 0, 0.2)",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            {timeline.map((slot, index) => (
              <div
                key={slot.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDropOnSlot(index, e)}
                style={{
                  aspectRatio: "1",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  padding: "8px",
                  backgroundColor:
                    currentBeat === index && isPlaying
                      ? "rgba(46, 204, 113, 0.4)"
                      : "rgba(56, 176, 255, 0.1)",
                  border:
                    currentBeat === index && isPlaying
                      ? "2px solid rgba(46, 204, 113, 0.8)"
                      : "1px solid rgba(56, 176, 255, 0.3)",
                  borderRadius: "8px",
                  cursor: "default",
                  transition: "all 0.1s",
                  position: "relative",
                }}
              >
                {/* Beat Number */}
                <div style={{ fontSize: "0.65rem", color: "rgba(255, 255, 255, 0.5)", fontWeight: 600 }}>
                  {index + 1}
                </div>

                {/* Move Display */}
                {slot.move ? (
                  <div
                    style={{
                      fontSize: "1.4rem",
                      fontWeight: 600,
                      color: "#fff",
                      textAlign: "center",
                      cursor: "pointer",
                      transition: "opacity 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.opacity = "0.7";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.opacity = "1";
                    }}
                    onClick={() => clearSlot(index)}
                    title="Click to remove"
                  >
                    {AVAILABLE_DANCE_MOVES.find((m) => m.key === slot.move)?.icon}
                  </div>
                ) : (
                  <div style={{ fontSize: "1rem", color: "rgba(255, 255, 255, 0.3)" }}>+</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            onClick={clearAllSlots}
            style={{
              padding: "10px 20px",
              fontSize: "1rem",
              backgroundColor: "rgba(200, 100, 100, 0.6)",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Clear All
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.2);
          }
        }
      `}</style>
    </>
  );
}
