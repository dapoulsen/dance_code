import { useMemo, useState } from "react";
import { useConnectStatus, ConnectionStatus } from "../connect-status-hooks";
import { useConnectionStage } from "../connection-stage-hooks";
import { predict } from "../ml";
import { useStore } from "../store";
import { useBufferedData } from "../buffered-data-hooks";
import ConnectionFlowDialogs from "../components/ConnectionFlowDialogs";

const danceNames: { key: string; label: string; icon: string }[] = [
  { key: "spin", label: "Spin", icon: "⟳" },
  { key: "wave", label: "Wave", icon: "👋" },
  { key: "punch", label: "Punch", icon: "🥊" },
];

const UNLOCK_KEY = "microbit-dance-unlocks";
const CONFIDENCE_THRESHOLD = 0.75;

export default function UnlockPage() {
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem(UNLOCK_KEY) ?? "{}") as Record<string, boolean>;
    } catch {
      return {};
    }
  });
  const [log, setLog] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [failedCard, setFailedCard] = useState<string | null>(null);

  const [status] = useConnectStatus();
  const isConnected = status === ConnectionStatus.Connected;
  const { actions: connectionActions } = useConnectionStage();

  const model = useStore((s) => s.model);
  const dataWindow = useStore((s) => s.dataWindow);
  const storeActions = useStore((s) => s.actions);
  const bufferedData = useBufferedData();

  const addLog = (text: string) => {
    setLog((previous) => [text, ...previous].slice(0, 30));
  };

  const resetUnlocks = () => {
    setUnlocked({});
    try {
      localStorage.removeItem(UNLOCK_KEY);
    } catch {
      // ignore
    }
    addLog("🔄 All unlocks reset");
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
    addLog(`✓ Unlocked: ${name}`);
  };

  const captureAccelerometerData = async (danceName: string, danceKey: string) => {
    if (!isConnected) {
      addLog("⚠️ Micro:bit not connected");
      return;
    }

    if (!model) {
      addLog("⚠️ No ML model trained yet");
      return;
    }

    setIsCapturing(true);
    addLog(`Recording ${danceName}...`);

    const startTime = Date.now();
    const captureDuration = 5000; // 5 seconds

    // Wait for capture period
    await new Promise((resolve) => setTimeout(resolve, captureDuration));

    setIsCapturing(false);

    // Get buffered data from the last 5 seconds
    const endTime = Date.now();
    const accelData = bufferedData.getSamples(startTime, endTime);

    if (accelData.x.length === 0) {
      addLog("⚠️ No accelerometer data captured");
      return;
    }

    try {
      const classificationIds = storeActions.map((a) => a.ID);
      const result = predict({ model, data: accelData, classificationIds }, dataWindow);

      if (result.error) {
        addLog("⚠️ Prediction failed");
        return;
      }

      const confidences = result.confidences;
      console.log("Confidences:", confidences);

      let maxConfidence = -1;
      let maxActionId: number | null = null;

      for (const [idStr, conf] of Object.entries(confidences)) {
        if (conf > maxConfidence) {
          maxConfidence = conf as number;
          maxActionId = Number(idStr);
        }
      }

      const predictedAction = storeActions.find((a) => a.ID === maxActionId);
      const predictedActionKey = predictedAction?.name.toLowerCase() || "unknown";

      addLog(
        `Predicted: ${predictedActionKey} (${(maxConfidence * 100).toFixed(1)}%) vs target: ${danceKey}`
      );

      if (maxConfidence >= CONFIDENCE_THRESHOLD && predictedActionKey === danceKey) {
        unlockDance(danceKey);
        addLog(`✓ Detected ${danceName}! (${(maxConfidence * 100).toFixed(1)}% confidence)`);
      } else {
        setFailedCard(danceKey);
        addLog(
          `✗ Failed ${danceName}. Got: ${predictedActionKey} (${(maxConfidence * 100).toFixed(1)}%)`
        );

        setTimeout(() => {
          setFailedCard(null);
        }, 3000);
      }
    } catch (err) {
      console.error("Prediction error:", err);
      addLog("⚠️ Error during prediction");
    }
  };

  const danceCards = useMemo(
    () =>
      danceNames.map((dance) => {
        const isUnlocked = Boolean(unlocked[dance.key]);
        const isFailed = failedCard === dance.key;

        return (
          <div
            key={dance.key}
            className={`dance ${isUnlocked ? "unlocked" : "locked"}`}
            aria-label={dance.label}
            style={{
              backgroundColor: isFailed ? "rgba(255, 100, 100, 0.3)" : undefined,
              transition: "background-color 0.3s",
            }}
          >
            {isUnlocked ? dance.icon : "?"}
            <p>{dance.label}</p>
            <button
              onClick={() => captureAccelerometerData(dance.label, dance.key)}
              disabled={isCapturing || !isConnected || !model}
              style={{
                width: "100%",
                padding: "8px",
                marginTop: "8px",
                fontSize: "0.85rem",
                backgroundColor:
                  isCapturing || !isConnected || !model
                    ? "rgba(100, 100, 100, 0.4)"
                    : "rgba(56, 176, 255, 0.6)",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: isCapturing || !isConnected || !model ? "not-allowed" : "pointer",
                opacity: isCapturing || !isConnected || !model ? 0.5 : 1,
              }}
            >
              {isCapturing ? "Recording..." : "Record"}
            </button>
          </div>
        );
      }),
    [unlocked, isCapturing, isConnected, failedCard, model]
  );

  return (
    <>
      <ConnectionFlowDialogs />
      <h1>Dance Unlock</h1>
      <ConnectionStatusIndicator isConnected={isConnected} onConnect={() => connectionActions.startConnect()} />
      <p>
        Record your moves to unlock dances.
        {!model && " (Train a model first on the Data Samples page)"}
      </p>

      <div className="dance-grid">{danceCards}</div>

      <h3>Movement Log</h3>
      <div id="log" aria-live="polite">
        {log.map((entry, index) => (
          <div key={index}>{entry}</div>
        ))}
      </div>

      <button
        onClick={resetUnlocks}
        style={{
          marginTop: "16px",
          padding: "8px 16px",
          fontSize: "0.85rem",
          backgroundColor: "rgba(200, 100, 100, 0.6)",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Reset Unlocks
      </button>
    </>
  );
}

function ConnectionStatusIndicator({ isConnected, onConnect }: { isConnected: boolean; onConnect: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "16px",
        padding: "8px 12px",
        backgroundColor: isConnected ? "rgba(46, 204, 113, 0.2)" : "rgba(255, 100, 100, 0.2)",
        borderRadius: "8px",
        border: `1px solid ${isConnected ? "rgba(46, 204, 113, 0.4)" : "rgba(255, 100, 100, 0.4)"}`,
        width: "fit-content",
        margin: "0 auto 16px",
      }}
    >
      <div
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          backgroundColor: isConnected ? "#2ecc71" : "#ff6464",
        }}
      />
      <span style={{ fontSize: "0.9rem" }}>
        Micro:bit: {isConnected ? "Connected ✓" : "Not connected"}
      </span>
      {!isConnected && (
        <button
          onClick={onConnect}
          style={{
            padding: "6px 12px",
            fontSize: "0.85rem",
            backgroundColor: "rgba(56, 176, 255, 0.6)",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            marginLeft: "8px",
          }}
        >
          Connect via Bluetooth
        </button>
      )}
    </div>
  );
}
