import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import * as Blockly from "blockly/core";
import "blockly/blocks";
import "blockly/javascript";

const AVAILABLE_DANCE_MOVES: { key: string; label: string }[] = [
  { key: "spin", label: "Spin" },
  { key: "wave", label: "Wave" },
  { key: "punch", label: "Punch" },
];

type DanceMoveKey = "spin" | "wave" | "punch";

type RoutineBlock =
  | { id: string; kind: "move"; move: DanceMoveKey }
  | { id: string; kind: "function"; name: string; count: number; body: RoutineBlock[] }
  | { id: string; kind: "call"; name: string };

const UNLOCK_KEY = "microbit-dance-unlocks";

export default function CodePage() {
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>({});
  const [routine, setRoutine] = useState<RoutineBlock[]>([]);
  const [loopCount, setLoopCount] = useState(2);
  const [functionName, setFunctionName] = useState("myFunction");
  const [callFunctionName, setCallFunctionName] = useState("");
  const [blocklyCode, setBlocklyCode] = useState("");
  const [blocklyXml, setBlocklyXml] = useState("");
  const blocklyWorkspace = useRef<Blockly.WorkspaceSvg | null>(null);
  const blocklyDivRef = useRef<HTMLDivElement | null>(null);
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

  const functionNames = useMemo(
    () => routine.filter((block): block is Extract<RoutineBlock, { kind: "function" }> => block.kind === "function").map((fn) => fn.name),
    [routine]
  );

  useEffect(() => {
    if (functionNames.length > 0 && !functionNames.includes(callFunctionName)) {
      setCallFunctionName(functionNames[0]);
    }
  }, [functionNames, callFunctionName]);

  useEffect(() => {
    if (Blockly.Blocks["move_spin"]) return;

    Blockly.defineBlocksWithJsonArray([
      {
        type: "move_spin",
        message0: "Spin",
        previousStatement: null,
        nextStatement: null,
        colour: 160,
      },
      {
        type: "move_wave",
        message0: "Wave",
        previousStatement: null,
        nextStatement: null,
        colour: 160,
      },
      {
        type: "move_punch",
        message0: "Punch",
        previousStatement: null,
        nextStatement: null,
        colour: 160,
      },
      {
        type: "function_def",
        message0: "function %1 x %2",
        args0: [
          { type: "field_input", name: "NAME", text: "myFunction" },
          { type: "field_number", name: "COUNT", value: 1, min: 1 },
        ],
        message1: "do %1",
        args1: [{ type: "input_statement", name: "DO" }],
        previousStatement: null,
        nextStatement: null,
        colour: 230,
      },
      {
        type: "function_call",
        message0: "call %1",
        args0: [{ type: "field_input", name: "NAME", text: "myFunction" }],
        previousStatement: null,
        nextStatement: null,
        colour: 20,
      },
    ]);

    const jsGen = (Blockly as any).JavaScript || (Blockly as any).javaScript;
    if (!jsGen) {
      console.error("Blockly JavaScript generator not available");
      return;
    }

    jsGen["move_spin"] = () => "SPIN;\n";
    jsGen["move_wave"] = () => "WAVE;\n";
    jsGen["move_punch"] = () => "PUNCH;\n";
    jsGen["function_def"] = (block: any) => {
      const name = block.getFieldValue("NAME");
      const count = block.getFieldValue("COUNT");
      const body = jsGen.statementToCode(block, "DO");
      return `FUNCTION ${name} x${count} {\n${body}}\n`;
    };
    jsGen["function_call"] = (block: any) => {
      const name = block.getFieldValue("NAME");
      return `CALL ${name};\n`;
    };
  }, []);

  useEffect(() => {
    if (!blocklyDivRef.current || blocklyWorkspace.current) return;

    const toolbox = `
      <xml xmlns="http://www.w3.org/1999/xhtml" id="toolbox" style="display: none">
        <category name="Moves" colour="160">
          <block type="move_spin" />
          <block type="move_wave" />
          <block type="move_punch" />
        </category>
        <category name="Functions" colour="230">
          <block type="function_def" />
          <block type="function_call" />
        </category>
      </xml>
    `;

    const workspace = Blockly.inject(blocklyDivRef.current, {
      toolbox,
      grid: { spacing: 20, length: 3, colour: "#ccc", snap: true },
      zoom: { controls: true, wheel: true, startScale: 1.0, maxScale: 3, minScale: 0.5, scaleSpeed: 1.2 },
    });

    blocklyWorkspace.current = workspace;

    const updateCode = () => {
      const xml = Blockly.Xml.workspaceToDom(workspace);
      setBlocklyXml(Blockly.Xml.domToPrettyText(xml));
      const jsGen = (Blockly as any).JavaScript || (Blockly as any).javaScript;
      const generated = jsGen?.workspaceToCode ? jsGen.workspaceToCode(workspace) : "";
      setBlocklyCode(generated);
      Blockly.svgResize(workspace);
    };

    workspace.addChangeListener(updateCode);

    // initial call after injection (avoid initial blank/black canvas)
    setTimeout(updateCode, 0);

    return () => {
      workspace.dispose();
      blocklyWorkspace.current = null;
    };
  }, []);

  const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;


  const addMove = (move: DanceMoveKey) => {
    const block: RoutineBlock = { id: generateId(), kind: "move", move };
    setRoutine((prev) => [...prev, block]);
  };

  const clearRoutine = () => setRoutine([]);

  const wrapRoutineInFunction = () => {
    if (routine.length === 0) return;
    const functionBlock: RoutineBlock = {
      id: generateId(),
      kind: "function",
      name: functionName.trim() || "myFunction",
      count: loopCount,
      body: routine,
    };
    setRoutine([functionBlock]);
  };

  const addFunctionCall = () => {
    if (!callFunctionName) return;
    const callBlock: RoutineBlock = {
      id: generateId(),
      kind: "call",
      name: callFunctionName,
    };
    setRoutine((prev) => [...prev, callBlock]);
  };

  const generateBlocklyMicrobit = () => {
    if (!blocklyWorkspace.current) return "";
    const jsGen = (Blockly as any).JavaScript || (Blockly as any).javaScript;
    if (!jsGen?.workspaceToCode) return "";
    const code = jsGen.workspaceToCode(blocklyWorkspace.current);
    return code;
  };

  const jumpToMicrobit = async () => {
    if (blocklyWorkspace.current) {
      const code = generateBlocklyMicrobit();
      alert(`Generated dance routine from Blockly:\n${code}\n(Implement micro:bit execution logic in your firmware.)`);
      return;
    }

    const functionMap = new Map(
      routine
        .filter((block): block is Extract<RoutineBlock, { kind: "function" }> => block.kind === "function")
        .map((fn) => [fn.name, fn])
    );

    const flatten = (blocks: RoutineBlock[]): string[] => {
      return blocks.flatMap((block) => {
        if (block.kind === "move") return [block.move.toUpperCase()];
        if (block.kind === "call") {
          const fn = functionMap.get(block.name);
          if (!fn) return [`CALL ${block.name} (missing)`];
          const expanded = flatten(fn.body);
          return Array(fn.count).fill(expanded).flat();
        }
        if (block.kind === "function") {
          return [`FUNCTION ${block.name} (x${block.count})`];
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

      <div className="card" style={{ maxWidth: 980, margin: "0 auto" }}>
        <h2>Dance Code Builder</h2>
        <p>Use unlocked moves to build a dance routine as block commands; the routine is treated like the <strong>on start</strong> function.</p>

        <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: "0 0 280px", border: "1px solid #ddd", borderRadius: 8, padding: 12, background: "#fafafa" }}>
            <h3>Palette</h3>
            <p style={{ fontSize: 14, margin: "0 0 8px" }}>Drag or click moves into routine blocks.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
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

            <h4 style={{ marginTop: 14 }}>Function tools</h4>
            <label style={{ display: "block", marginBottom: 6 }}>
              Function name:
              <input
                type="text"
                value={functionName}
                onChange={(e) => setFunctionName(e.target.value)}
                style={{ width: "100%", marginTop: 4 }}
              />
            </label>
            <label style={{ display: "block", marginBottom: 6 }}>
              Run count:
              <input
                type="number"
                min={1}
                value={loopCount}
                onChange={(e) => setLoopCount(Number(e.target.value))}
                style={{ width: "100%", marginTop: 4 }}
              />
            </label>
            <button onClick={wrapRoutineInFunction} disabled={routine.length === 0} style={{ width: "100%", marginBottom: 8 }}>
              Wrap routine in function
            </button>

            <label style={{ display: "block", marginBottom: 6 }}>
              Call function:
              <select
                value={callFunctionName}
                onChange={(e) => setCallFunctionName(e.target.value)}
                style={{ width: "100%", marginTop: 4 }}
              >
                <option value="">-- select function --</option>
                {functionNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={addFunctionCall}
              disabled={!callFunctionName}
              style={{ width: "100%", marginBottom: 0 }}
            >
              Add function call to routine
            </button>
          </div>
          <div style={{ flex: 1 }}>
            <h3>Routine (blocks)</h3>
            <div
              ref={blocklyDivRef}
              style={{
                width: "100%",
                height: 440,
                minHeight: 320,
                border: "1px solid #ccc",
                borderRadius: 8,
                background: "#fff",
                marginBottom: 12,
                overflow: "hidden",
              }}
            />
            <div
              style={{
                minHeight: 120,
                border: "1px solid #ccc",
                borderRadius: 8,
                padding: 12,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 8,
                background: "#fff",
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropOnEnd}
            >
              {routine.length > 0 ? (
                routine.map((block, i) => {
                  const isDragging = draggingId === block.id;
                  const label =
                    block.kind === "move"
                      ? block.move
                      : block.kind === "function"
                      ? `Function ${block.name} x${block.count}`
                      : `Call ${block.name}`;

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
                          background: isDragging ? "#def" : "#fefefe",
                          color: "#111",
                          fontWeight: 600,
                          cursor: "grab",
                        }}
                      >
                        {label}
                        {block.kind === "function" && (
                          <div style={{ paddingLeft: 12, marginTop: 4, color: "#444" }}>
                            {block.body
                              .map((sub) =>
                                sub.kind === "move"
                                  ? sub.move
                                  : sub.kind === "function"
                                  ? `(nested function ${sub.name})`
                                  : `(call ${sub.name})`
                              )
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
              <button onClick={clearRoutine} disabled={routine.length === 0}>
                Clear routine
              </button>
              <button onClick={jumpToMicrobit} disabled={routine.length === 0 || unlockedMoves.length === 0}>
                Send to micro:bit (demo)
              </button>
            </div>

            <h3 style={{ marginTop: 18 }}>Debug / Code output</h3>
            <pre style={{ background: "#fafafa", padding: 10, border: "1px solid #eee" }}>
              {blocklyCode
                ? blocklyCode
                : routine.length > 0
                ? formatRoutine(routine)
                : "No code generated yet."}
            </pre>
            <details style={{ marginTop: 8 }}>
              <summary>Blockly XML</summary>
              <pre style={{ background: "#fff", padding: 8, border: "1px solid #f0f0f0", marginTop: 4 }}>
                {blocklyXml || "No XML generated yet."}
              </pre>
            </details>
          </div>
        </div>
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
      if (block.kind === "call") {
        return `${indent}CALL ${block.name}`;
      }
      if (block.kind === "function") {
        return `${indent}FUNCTION ${block.name} x${block.count}:\n${formatRoutine(block.body, indent + "  ")}`;
      }
      return "";
    })
    .join("\n");
}

