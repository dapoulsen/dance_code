import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalCloseButton,
  ModalBody,
} from "@chakra-ui/modal";

export type ModalStage = "countdown" | "recording" | "results";

export interface RecordingModalProps {
  isOpen: boolean;
  stage: ModalStage;
  countdownValue: number;
  liveData: { x: number; y: number; z: number };
  results: { success: boolean; predictedAction: string; confidence: number; danceLabel: string } | null;
  onClose: () => void;
}

export function RecordingModal({ isOpen, stage, countdownValue, liveData, results, onClose }: RecordingModalProps) {
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
