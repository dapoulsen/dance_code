import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";

const AVAILABLE_DANCE_MOVES: { key: string; label: string }[] = [
  { key: "spin", label: "Spin" },
  { key: "wave", label: "Wave" },
  { key: "punch", label: "Punch" },
];

type DanceMoveKey = "spin" | "wave" | "punch";

type RoutineBlock =
  | { id: string; kind: "move"; move: DanceMoveKey }
  | { id: string; kind: "loop"; count: number; body: RoutineBlock[] };

const UNLOCK_KEY = "microbit-dance-unlocks";

export default function CodePage() {
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>({});
  const [routine, setRoutine] = useState<RoutineBlock[]>([]);
  const [loopCount, setLoopCount] = useState(2);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const loaded = JSON.parse(localStorage.getItem(UNLOCK_KEY) ?? "{}") as Record<string, boolean>;
      setUnlocked(loaded);
    } catch {
      setUnlocked({});
    }
  }, []);

  const unlockedMoves = useMemo(
    () => AVAILABLE_DANCE_MOVES.filter((m) => unlocked[m.key]),
    [unlocked]
  );

  const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;


  const addMove = (move: DanceMoveKey) => {
    const block: RoutineBlock = { id: generateId(), kind: "move", move };
    setRoutine((prev) => [...prev, block]);
  };

  const clearRoutine = () => setRoutine([]);

  const wrapRoutineInLoop = () => {
    if (routine.length === 0) return;
    const loopBlock: RoutineBlock = {
      id: generateId(),
      kind: "loop",
      count: loopCount,
      body: routine,
    };
    setRoutine([loopBlock]);
  };

  const jumpToMicrobit = async () => {
    const flatten = (blocks: RoutineBlock[]): string[] => {
      return blocks.flatMap((block) => {
        if (block.kind === "move") return [block.move.toUpperCase()];
        if (block.kind === "loop") {
          const inner = flatten(block.body);
          return Array(block.count).fill(inner).flat();
        }
        return [];
      });
    };

    const code = flatten(routine).join(" -> ");
    alert(`Generated dance routine:\n${code}\n(Implement micro:bit execution logic in your firmware.)`);
  };

  const moveBlock = (fromIndex: number, toIndex: number) => {
    setRoutine((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length || toIndex < 0 || toIndex > prev.length) return prev;
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
  };

  const handleDropOnRoutine = (index: number, e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDraggingId(null);

    const payload = e.dataTransfer.getData("application/json");
    if (!payload) return;

    try {
      const data = JSON.parse(payload);
      if (data.source === "palette" && data.move) {
        const block: RoutineBlock = { id: generateId(), kind: "move", move: data.move };
        setRoutine((prev) => {
          const next = [...prev];
          next.splice(index, 0, block);
          return next;
        });
      } else if (data.source === "routine" && data.id) {
        const sourceIndex = routine.findIndex((item) => item.id === data.id);
        if (sourceIndex !== -1) {
          const insertAt = sourceIndex < index ? index - 1 : index;
          moveBlock(sourceIndex, insertAt);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleDropOnEnd = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDraggingId(null);

    const payload = e.dataTransfer.getData("application/json");
    if (!payload) return;

    try {
      const data = JSON.parse(payload);
      if (data.source === "palette" && data.move) {
        addMove(data.move);
      } else if (data.source === "routine" && data.id) {
        const sourceIndex = routine.findIndex((item) => item.id === data.id);
        if (sourceIndex !== -1) {
          moveBlock(sourceIndex, routine.length - 1);
        }
      }
    } catch {
      // ignore
    }
  };

  return (
    <>
      <h1>Dance Code Builder</h1>
      <p>Use unlocked moves to build a dance routine as block commands.</p>

      <div className="card" style={{ maxWidth: 680, margin: "0 auto" }}>
        <h2>Unlocked Moves (drag into routine)</h2>
        <p>If you don’t have any unlocked moves, go to Unlock page and press A/D/S combos.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {AVAILABLE_DANCE_MOVES.map((move) => {
            const isUnlocked = Boolean(unlocked[move.key]);
            return (
              <button
                key={move.key}
                disabled={!isUnlocked}
                draggable={isUnlocked}
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    "application/json",
                    JSON.stringify({ source: "palette", move: move.key })
                  );
                }}
                onClick={() => addMove(move.key as DanceMoveKey)}
                style={{ padding: "10px 14px", opacity: isUnlocked ? 1 : 0.4 }}
              >
                {move.label}
              </button>
            );
          })}
        </div>

        <h2 style={{ marginTop: 16 }}>Routine (blocks)</h2>
        <div
          style={{ minHeight: 90, border: "1px solid #ccc", borderRadius: 8, padding: 12 }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropOnEnd}
        >
          {routine.length > 0 ? (
            routine.map((block, i) => {
              const isDragging = draggingId === block.id;
              const label = block.kind === "move" ? block.move : `Loop x${block.count}`;

              return (
                <div key={block.id} style={{ marginBottom: 4 }}>
                  <div
                    draggable
                    onDragStart={(event) => {
                      setDraggingId(block.id);
                      event.dataTransfer.setData("application/json", JSON.stringify({ source: "routine", id: block.id }));
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropOnRoutine(i, e)}
                    style={{
                      padding: 8,
                      border: "1px solid #666",
                      borderRadius: 4,
                      background: isDragging ? "#def" : "#fff",
                      color: "#111",
                      fontWeight: 600,
                      cursor: "grab",
                    }}
                  >
                    {label}
                    {block.kind === "loop" && (
                      <div style={{ paddingLeft: 12, marginTop: 4, color: "#444" }}>
                        {block.body.map((sub) => (sub.kind === "move" ? sub.move : "(nested loop) "))
                          .join(" -> ")}
                      </div>
                    )}
                  </div>
                  <div
                    style={{ height: 6 }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropOnRoutine(i + 1, e)}
                  >
                    &nbsp;
                  </div>
                </div>
              );
            })
          ) : (
            <em>No steps yet</em>
          )}
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            Loop count:
            <input
              type="number"
              min={2}
              value={loopCount}
              onChange={(e) => setLoopCount(Number(e.target.value))}
              style={{ width: 60, marginLeft: 6 }}
            />
          </label>
          <button onClick={wrapRoutineInLoop} disabled={routine.length === 0}>
            Wrap routine in loop
          </button>
          <button onClick={clearRoutine} disabled={routine.length === 0}>
            Clear routine
          </button>
          <button onClick={jumpToMicrobit} disabled={routine.length === 0 || unlockedMoves.length === 0}>
            Send to micro:bit (demo)
          </button>
        </div>

        <h3 style={{ marginTop: 18 }}>Debug / Code output</h3>
        <pre style={{ background: "#fafafa", padding: 10, border: "1px solid #eee" }}>
          {routine.length > 0 ? formatRoutine(routine) : "No code generated yet."}
        </pre>
      </div>
    </>
  );
}

function formatRoutine(blocks: RoutineBlock[], indent = ""): string {
  return blocks
    .map((block) => {
      if (block.kind === "move") {
        return `${indent}${block.move}`;
      }
      return `${indent}LOOP x${block.count}:\n${formatRoutine(block.body, indent + "  ")}`;
    })
    .join("\n");
}

