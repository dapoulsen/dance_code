import { useEffect, useMemo, useState } from "react";
import { useConnectStatus , ConnectionStatus } from "../connect-status-hooks"
import { useConnectionStage } from "../connection-stage-hooks";
import { createWebBluetoothConnection } from "@microbit/microbit-connection";

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
      <ConnectionStatusIndicator />
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

function ConnectionStatusIndicator() {
  const [status, setStatus] = useConnectStatus();
  const [isConnecting, setIsConnecting] = useState(false);
  const isConnected = status === ConnectionStatus.Connected;
  
  const handleConnectBluetooth = async () => {
    setIsConnecting(true);
    try {
      const bluetooth = createWebBluetoothConnection();
      const connectionStatus = await bluetooth.connect();

      if (connectionStatus !== "CONNECTED") {
        console.error("Connection failed:", connectionStatus);
        setIsConnecting(false);
        return;
      }
      
      // Update the global connection status
      setStatus(ConnectionStatus.Connected);
      setIsConnecting(false);
    } catch (err) {
      console.error("Bluetooth connection error:", err);
      setIsConnecting(false);
    }
  };
  
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      marginBottom: "16px",
      padding: "8px 12px",
      backgroundColor: isConnected ? "rgba(46, 204, 113, 0.2)" : "rgba(255, 100, 100, 0.2)",
      borderRadius: "8px",
      border: `1px solid ${isConnected ? "rgba(46, 204, 113, 0.4)" : "rgba(255, 100, 100, 0.4)"}`,
      width: "fit-content",
      margin: "0 auto 16px"
    }}>
      <div style={{
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        backgroundColor: isConnected ? "#2ecc71" : "#ff6464"
      }} />
      <span style={{ fontSize: "0.9rem" }}>
        Micro:bit: {isConnected ? "Connected ✓" : "Not connected"}
      </span>
      {!isConnected && (
        <button
          onClick={handleConnectBluetooth}
          disabled={isConnecting}
          style={{
            padding: "6px 12px",
            fontSize: "0.85rem",
            backgroundColor: "rgba(56, 176, 255, 0.6)",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: isConnecting ? "not-allowed" : "pointer",
            marginLeft: "8px",
            opacity: isConnecting ? 0.6 : 1
          }}
        >
          {isConnecting ? "Connecting..." : "Connect via Bluetooth"}
        </button>
      )}
    </div>
  );
}
