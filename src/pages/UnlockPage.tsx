import { useMemo, useState, useRef } from "react";
import { useConnectStatus, ConnectionStatus } from "../connect-status-hooks";
import { useConnectionStage } from "../connection-stage-hooks";
import { predict } from "../ml";
import { useStore } from "../store";
import { useBufferedData } from "../buffered-data-hooks";
import ConnectionFlowDialogs from "../components/ConnectionFlowDialogs";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalCloseButton,
  ModalBody,
} from "@chakra-ui/modal";

const danceNames: { key: string; label: string; icon: string }[] = [
  { key: "spin", label: "Spin", icon: "⟳" },
  { key: "wave", label: "Wave", icon: "👋" },
  { key: "punch", label: "Punch", icon: "🥊" },
];

const UNLOCK_KEY = "microbit-dance-unlocks";
const CONFIDENCE_THRESHOLD = 0.75;

type ModalStage = "countdown" | "recording" | "results";

interface ModalState {
  isOpen: boolean;
  stage: ModalStage;
  countdownValue: number;
  liveData: { x: number; y: number; z: number };
  results: {
    success: boolean;
    predictedAction: string;
    confidence: number;
    danceLabel: string;
  } | null;
  currentDance: {
    label: string;
    key: string;
  } | null;
}

export default function UnlockPage() {
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem(UNLOCK_KEY) ?? "{}") as Record<string, boolean>;
    } catch {
      return {};
    }
  });
  const [isCapturing, setIsCapturing] = useState(false);
  const [failedCard, setFailedCard] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    stage: "countdown",
    countdownValue: 3,
    liveData: { x: 0, y: 0, z: 0 },
    results: null,
    currentDance: null,
  });
  const liveDataRef = useRef({ x: 0, y: 0, z: 0 });

  const status = useConnectStatus()[0];
  const isConnected = status === ConnectionStatus.Connected;
  const { actions: connectionActions } = useConnectionStage();

  const model = useStore((s) => s.model);
  const dataWindow = useStore((s) => s.dataWindow);
  const storeActions = useStore((s) => s.actions);
  const bufferedData = useBufferedData();

  const resetUnlocks = () => {
    setUnlocked({});
    try {
      localStorage.removeItem(UNLOCK_KEY);
    } catch {
      // ignore
    }
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
  };

  const closeModal = () => {
    setModalState((prev) => ({
      ...prev,
      isOpen: false,
      results: null,
    }));
  };

  const captureAccelerometerData = async (danceName: string, danceKey: string) => {
    if (!isConnected) {
      return;
    }

    if (!model) {
      return;
    }

    // Open modal and start countdown
    setModalState((prev) => ({
      ...prev,
      isOpen: true,
      stage: "countdown",
      countdownValue: 3,
      currentDance: { label: danceName, key: danceKey },
      results: null,
    }));

    setIsCapturing(true);

    // Wait 1 second for modal to open, then start countdown
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Countdown: 3, 2, 1
    for (let i = 3; i > 0; i--) {
      setModalState((prev) => ({
        ...prev,
        countdownValue: i,
      }));
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Move to recording stage
    const startTime = Date.now();
    const captureDuration = 5000; // 5 seconds

    setModalState((prev) => ({
      ...prev,
      stage: "recording",
    }));

    // Subscribe to live data updates
    const handleLiveData = (sample: { x: number; y: number; z: number }) => {
      liveDataRef.current = sample;
      setModalState((prev) => ({
        ...prev,
        liveData: sample,
      }));
    };

    bufferedData.addListener(handleLiveData);

    // Wait for capture period
    await new Promise((resolve) => setTimeout(resolve, captureDuration));

    bufferedData.removeListener(handleLiveData);
    setIsCapturing(false);

    // Get buffered data from the capture period
    const endTime = Date.now();
    const accelData = bufferedData.getSamples(startTime, endTime);

    if (accelData.x.length === 0) {
      setModalState((prev) => ({
        ...prev,
        stage: "results",
        results: {
          success: false,
          predictedAction: "error",
          confidence: 0,
          danceLabel: danceName,
        },
      }));
      return;
    }

    try {
      const classificationIds = storeActions.map((a) => a.ID);
      const result = predict({ model, data: accelData, classificationIds }, dataWindow);

      if (result.error) {
        setModalState((prev) => ({
          ...prev,
          stage: "results",
          results: {
            success: false,
            predictedAction: "error",
            confidence: 0,
            danceLabel: danceName,
          },
        }));
        return;
      }

      const confidences = result.confidences;
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
      const success = maxConfidence >= CONFIDENCE_THRESHOLD && predictedActionKey === danceKey;

      if (success) {
        unlockDance(danceKey);
      } else if (predictedActionKey !== danceKey) {
        setFailedCard(danceKey);
        setTimeout(() => {
          setFailedCard(null);
        }, 3000);
      }

      setModalState((prev) => ({
        ...prev,
        stage: "results",
        results: {
          success,
          predictedAction: predictedActionKey,
          confidence: maxConfidence,
          danceLabel: danceName,
        },
      }));

      // Auto-close after 2 seconds
      await new Promise((resolve) => setTimeout(resolve, 2000));
      closeModal();
    } catch (err) {
      console.error("Prediction error:", err);
      setModalState((prev) => ({
        ...prev,
        stage: "results",
        results: {
          success: false,
          predictedAction: "error",
          confidence: 0,
          danceLabel: danceName,
        },
      }));
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
              {isCapturing ? "I gang..." : "Start"}
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
        Udforsk moves for at åbne op for dem. Klik på "Start" og udfør det viste move med din micro:bit. Systemet vil forsøge at genkende det og låse op, hvis det er korrekt.
        {!model && " (Train a model first on the Data Samples page)"}
      </p>

      <div className="dance-grid">{danceCards}</div>

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

      <RecordingModal
        isOpen={modalState.isOpen}
        stage={modalState.stage}
        countdownValue={modalState.countdownValue}
        liveData={modalState.liveData}
        results={modalState.results}
        onClose={closeModal}
      />
    </>
  );
}

interface RecordingModalProps {
  isOpen: boolean;
  stage: ModalStage;
  countdownValue: number;
  liveData: { x: number; y: number; z: number };
  results: { success: boolean; predictedAction: string; confidence: number; danceLabel: string } | null;
  onClose: () => void;
}

function RecordingModal({ isOpen, stage, countdownValue, liveData, results, onClose }: RecordingModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent
        backgroundColor="rgba(30, 30, 40, 0.95)"
        borderRadius="16px"
        border="1px solid rgba(255, 255, 255, 0.1)"
      >
        <ModalCloseButton />
        <ModalBody padding="32px">
          {stage === "countdown" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "16px",
              }}
            >
              <div style={{ fontSize: "0.9rem", color: "rgba(255, 255, 255, 0.7)" }}>
                Gør dig klar til at udføre bevægelsen...
              </div>
              <div
                style={{
                  fontSize: "4rem",
                  fontWeight: "bold",
                  color: "#38b0ff",
                  animation: "pulse 0.5s ease-in-out",
                }}
              >
                {countdownValue === 0 ? "Go!" : countdownValue}
              </div>
            </div>
          )}

          {stage === "recording" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "24px",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    display: "inline-block",
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    backgroundColor: "#ff4444",
                    animation: "blink 0.8s ease-in-out infinite",
                    marginRight: "8px",
                  }}
                />
                <span style={{ fontSize: "1rem", color: "rgba(255, 255, 255, 0.9)" }}>Optager...</span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "12px",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    backgroundColor: "rgba(56, 176, 255, 0.1)",
                    border: "1px solid rgba(56, 176, 255, 0.3)",
                    borderRadius: "8px",
                    padding: "12px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.6)", marginBottom: "4px" }}>
                    X
                  </div>
                  <div
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: "bold",
                      color: "#38b0ff",
                      fontFamily: "monospace",
                    }}
                  >
                    {liveData.x.toFixed(1)}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "rgba(46, 204, 113, 0.1)",
                    border: "1px solid rgba(46, 204, 113, 0.3)",
                    borderRadius: "8px",
                    padding: "12px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.6)", marginBottom: "4px" }}>
                    Y
                  </div>
                  <div
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: "bold",
                      color: "#2ecc71",
                      fontFamily: "monospace",
                    }}
                  >
                    {liveData.y.toFixed(1)}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "rgba(230, 126, 34, 0.1)",
                    border: "1px solid rgba(230, 126, 34, 0.3)",
                    borderRadius: "8px",
                    padding: "12px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.6)", marginBottom: "4px" }}>
                    Z
                  </div>
                  <div
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: "bold",
                      color: "#e67e22",
                      fontFamily: "monospace",
                    }}
                  >
                    {liveData.z.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {stage === "results" && results && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
                minHeight: "120px",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  fontSize: "3rem",
                  marginBottom: "8px",
                }}
              >
                {results.success ? "✅" : "❌"}
              </div>

              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: "600",
                    color: results.success ? "#2ecc71" : "#ff6464",
                    marginBottom: "8px",
                  }}
                >
                  {results.success ? "Perfekt!" : "Ikke helt rigtigt"}
                </div>
                <div style={{ fontSize: "0.95rem", color: "rgba(255, 255, 255, 0.7)", marginBottom: "12px" }}>
                  {results.success
                    ? `${results.danceLabel} låst op!`
                    : `Du udførte: ${results.predictedAction}`}
                </div>
                <div
                  style={{
                    fontSize: "1.3rem",
                    fontWeight: "bold",
                    color: "#38b0ff",
                    fontFamily: "monospace",
                  }}
                >
                  {(results.confidence * 100).toFixed(1)}% sikkerhed
                </div>
              </div>
            </div>
          )}
        </ModalBody>

        <style>{`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.6;
            }
          }

          @keyframes blink {
            0%, 49% {
              opacity: 1;
            }
            50%, 100% {
              opacity: 0.3;
            }
          }
        `}</style>
      </ModalContent>
    </Modal>
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
        Micro:bit: {isConnected ? "Tilsluttet ✓" : "Ikke tilsluttet"}
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
          Tilslut via Bluetooth
        </button>
      )}
    </div>
  );
}
