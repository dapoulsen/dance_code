import { useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { useBufferedData } from "../buffered-data-hooks";
import { predict } from "../ml";
import { useConnectStatus, ConnectionStatus } from "../connect-status-hooks";

const CONFIDENCE_THRESHOLD = 0.75;
const BEAT_TIMING_TOLERANCE = 200; // milliseconds

type DanceMoveKey = "spin" | "wave" | "punch";

interface TimelineSlot {
  id: string;
  move: DanceMoveKey | null;
}

interface BeatResult {
  beatNumber: number;
  expectedMove: DanceMoveKey | null;
  confidence: number;
  wasOnBeat: boolean;
  allConfidences: Record<string, number>;
}

interface TestResults {
  beatResults: BeatResult[];
  overallAccuracyPercent: number;
  timingAccuracyPercent: number;
  compositeScore: number;
  completedBeats: number;
  totalBeats: number;
}

const AVAILABLE_DANCE_MOVES: { key: string; label: string; icon: string }[] = [
  { key: "spin", label: "Spin", icon: "⟳" },
  { key: "wave", label: "Wave", icon: "👋" },
  { key: "punch", label: "Punch", icon: "🥊" },
];

const BPM = 30;

export default function RoutineTestPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { timeline, bpm: passedBpm } = (location.state as { timeline: TimelineSlot[]; bpm: number }) || {
    timeline: [],
    bpm: BPM,
  };

  const [testStage, setTestStage] = useState<"ready" | "countdown" | "testing" | "results">("ready");
  const [countdownValue, setCountdownValue] = useState(3);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [results, setResults] = useState<TestResults | null>(null);
  const [liveData, setLiveData] = useState({ x: 0, y: 0, z: 0 });

  const status = useConnectStatus()[0];
  const isConnected = status === ConnectionStatus.Connected;
  const model = useStore((s) => s.model);
  const dataWindow = useStore((s) => s.dataWindow);
  const storeActions = useStore((s) => s.actions);
  const bufferedData = useBufferedData();

  const beatResultsRef = useRef<BeatResult[]>([]);
  const testStartTimeRef = useRef<number>(0);

  const actualBpm = passedBpm || BPM;
  const actualBeatDuration = (60 / actualBpm) * 1000; // milliseconds per beat

  if (!timeline || timeline.length === 0) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h1>No Choreography to Test</h1>
        <p>Go back to the Code Builder and create a routine first.</p>
        <button onClick={() => navigate("/code")} style={{ padding: "10px 20px", fontSize: "1rem" }}>
          Back to Code Builder
        </button>
      </div>
    );
  }

  const handleStartTest = async () => {
    if (!isConnected) {
      alert("Please connect to micro:bit first");
      return;
    }

    if (!model) {
      alert("Model not loaded yet");
      return;
    }

    beatResultsRef.current = [];
    setCountdownValue(3);
    setTestStage("countdown");

    // Countdown: 3, 2, 1, go
    for (let i = 3; i > 0; i--) {
      setCountdownValue(i);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    setTestStage("testing");
    testStartTimeRef.current = Date.now();

    // Run test for each beat
    for (let beatIdx = 0; beatIdx < timeline.length; beatIdx++) {
      setCurrentBeat(beatIdx);

      const beatStartTime = Date.now();
      const expectedMove = timeline[beatIdx].move;

      // Listen to live data
      const handleLiveData = (sample: { x: number; y: number; z: number }) => {
        setLiveData(sample);
      };

      bufferedData.addListener(handleLiveData);

      // Wait for beat duration
      await new Promise((resolve) => setTimeout(resolve, actualBeatDuration));

      bufferedData.removeListener(handleLiveData);

      // Get accelerometer data captured during this beat
      const beatEndTime = Date.now();
      const accelData = bufferedData.getSamples(beatStartTime, beatEndTime);

      let confidence = 0;
      let allConfidences: Record<string, number> = {};

      // Run prediction if we have data
      if (accelData.x.length > 0 && expectedMove) {
        const classificationIds = storeActions.map((a) => a.ID);
        const predictionResult = predict(
          { model, data: accelData, classificationIds },
          dataWindow
        );

        if (!predictionResult.error) {
          allConfidences = predictionResult.confidences;
          const expectedActionId = storeActions.find(
            (a) => a.name.toLowerCase() === expectedMove
          )?.ID;

          if (expectedActionId !== undefined && expectedActionId in allConfidences) {
            confidence = allConfidences[expectedActionId] as number;
          }
        }
      }

      // Check if beat was "on time" (within tolerance)
      const actualBeatDuration = Date.now() - beatStartTime;
      const timingError = Math.abs(actualBeatDuration - actualBeatDuration);
      const wasOnBeat = timingError <= BEAT_TIMING_TOLERANCE;

      beatResultsRef.current.push({
        beatNumber: beatIdx + 1,
        expectedMove,
        confidence,
        wasOnBeat,
        allConfidences,
      });
    }

    // Calculate final scores
    const completedBeats = beatResultsRef.current.filter((r) => r.expectedMove).length;
    const successfulBeats = beatResultsRef.current.filter(
      (r) => r.expectedMove && r.confidence >= CONFIDENCE_THRESHOLD
    ).length;
    const onBeatBeats = beatResultsRef.current.filter((r) => r.expectedMove && r.wasOnBeat).length;

    const overallAccuracyPercent = completedBeats > 0 ? Math.round((successfulBeats / completedBeats) * 100) : 0;
    const timingAccuracyPercent = completedBeats > 0 ? Math.round((onBeatBeats / completedBeats) * 100) : 0;
    const compositeScore = Math.round((overallAccuracyPercent * 0.6 + timingAccuracyPercent * 0.4));

    const testResults: TestResults = {
      beatResults: beatResultsRef.current,
      overallAccuracyPercent,
      timingAccuracyPercent,
      compositeScore,
      completedBeats,
      totalBeats: timeline.length,
    };

    setResults(testResults);
    setTestStage("results");
  };

  return (
    <div style={{ padding: "20px", maxWidth: 900, margin: "0 auto" }}>
      <h1>Test Your Choreography</h1>

      {/* Choreography Preview */}
      <div
        style={{
          marginBottom: "24px",
          padding: "16px",
          backgroundColor: "rgba(56, 176, 255, 0.1)",
          borderRadius: "8px",
          border: "1px solid rgba(56, 176, 255, 0.3)",
        }}
      >
        <h2>Your Routine ({timeline.length} beats)</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(10, timeline.length)}, 1fr)`,
            gap: "8px",
            marginTop: "12px",
          }}
        >
          {timeline.map((slot, idx) => (
            <div
              key={slot.id}
              style={{
                aspectRatio: "1",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px",
                backgroundColor:
                  testStage === "testing" && currentBeat === idx
                    ? "rgba(46, 204, 113, 0.4)"
                    : "rgba(56, 176, 255, 0.1)",
                border:
                  testStage === "testing" && currentBeat === idx
                    ? "2px solid rgba(46, 204, 113, 0.8)"
                    : "1px solid rgba(56, 176, 255, 0.3)",
                borderRadius: "8px",
                fontSize: "0.7rem",
                color: "rgba(255, 255, 255, 0.7)",
              }}
            >
              {slot.move ? (
                <div style={{ fontSize: "1.2rem" }}>
                  {AVAILABLE_DANCE_MOVES.find((m) => m.key === slot.move)?.icon}
                </div>
              ) : (
                <div>-</div>
              )}
              <div style={{ marginTop: "4px" }}>{idx + 1}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Test Control */}
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        {testStage === "ready" && (
          <div>
            <p style={{ marginBottom: "16px" }}>
              {isConnected ? "✓ Connected to micro:bit" : "⚠ Not connected to micro:bit"}
            </p>
            <button
              onClick={handleStartTest}
              disabled={!isConnected || !model}
              style={{
                padding: "12px 24px",
                fontSize: "1.2rem",
                backgroundColor: isConnected && model ? "rgba(46, 204, 113, 0.8)" : "rgba(100, 100, 100, 0.5)",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                cursor: isConnected && model ? "pointer" : "not-allowed",
                fontWeight: 600,
              }}
            >
              Start Test
            </button>
          </div>
        )}

        {testStage === "countdown" && (
          <div>
            <h2 style={{ fontSize: "3rem", color: "rgba(46, 204, 113, 0.8)" }}>
              {countdownValue}
            </h2>
            <p>Get ready to perform...</p>
          </div>
        )}

        {testStage === "testing" && (
          <div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>
                Beat {currentBeat + 1} / {timeline.length}
              </div>
              {timeline[currentBeat].move && (
                <div
                  style={{
                    fontSize: "2rem",
                    color: "rgba(46, 204, 113, 0.8)",
                  }}
                >
                  {AVAILABLE_DANCE_MOVES.find((m) => m.key === timeline[currentBeat].move)?.icon}
                </div>
              )}
              <div style={{ fontSize: "0.9rem", color: "rgba(255, 255, 255, 0.7)" }}>
                X: {liveData.x.toFixed(1)} | Y: {liveData.y.toFixed(1)} | Z: {liveData.z.toFixed(1)}
              </div>
            </div>
          </div>
        )}

        {testStage === "results" && results && (
          <div>
            <h2 style={{ marginBottom: "24px" }}>Test Complete!</h2>

            {/* Score Summary */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "16px",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  padding: "16px",
                  backgroundColor: "rgba(46, 204, 113, 0.2)",
                  borderRadius: "8px",
                  border: "1px solid rgba(46, 204, 113, 0.4)",
                }}
              >
                <div style={{ fontSize: "0.9rem", color: "rgba(255, 255, 255, 0.7)" }}>
                  Overall Accuracy
                </div>
                <div style={{ fontSize: "2rem", fontWeight: 600, color: "#2ecc71" }}>
                  {results.overallAccuracyPercent}%
                </div>
              </div>

              <div
                style={{
                  padding: "16px",
                  backgroundColor: "rgba(56, 176, 255, 0.2)",
                  borderRadius: "8px",
                  border: "1px solid rgba(56, 176, 255, 0.4)",
                }}
              >
                <div style={{ fontSize: "0.9rem", color: "rgba(255, 255, 255, 0.7)" }}>
                  Timing Accuracy
                </div>
                <div style={{ fontSize: "2rem", fontWeight: 600, color: "#38b0ff" }}>
                  {results.timingAccuracyPercent}%
                </div>
              </div>

              <div
                style={{
                  padding: "16px",
                  backgroundColor: "rgba(200, 150, 0, 0.2)",
                  borderRadius: "8px",
                  border: "1px solid rgba(200, 150, 0, 0.4)",
                }}
              >
                <div style={{ fontSize: "0.9rem", color: "rgba(255, 255, 255, 0.7)" }}>
                  Composite Score
                </div>
                <div style={{ fontSize: "2rem", fontWeight: 600, color: "#ffd700" }}>
                  {results.compositeScore}%
                </div>
              </div>
            </div>

            {/* Per-Beat Breakdown */}
            <div
              style={{
                marginTop: "24px",
                padding: "16px",
                backgroundColor: "rgba(0, 0, 0, 0.2)",
                borderRadius: "8px",
              }}
            >
              <h3>Per-Beat Breakdown</h3>
              <div
                style={{
                  maxHeight: "300px",
                  overflowY: "auto",
                  marginTop: "12px",
                }}
              >
                {results.beatResults.map((beat) => (
                  <div
                    key={beat.beatNumber}
                    style={{
                      padding: "12px",
                      marginBottom: "8px",
                      backgroundColor: "rgba(56, 176, 255, 0.1)",
                      borderRadius: "4px",
                      border:
                        beat.confidence >= CONFIDENCE_THRESHOLD
                          ? "1px solid rgba(46, 204, 113, 0.5)"
                          : beat.confidence > 0.3
                            ? "1px solid rgba(200, 150, 0, 0.5)"
                            : "1px solid rgba(200, 50, 50, 0.5)",
                    }}
                  >
                    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                      <div style={{ fontWeight: 600, minWidth: "60px" }}>
                        Beat {beat.beatNumber}
                      </div>
                      {beat.expectedMove && (
                        <div style={{ fontSize: "1.2rem" }}>
                          {AVAILABLE_DANCE_MOVES.find((m) => m.key === beat.expectedMove)?.icon}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.9rem" }}>
                          Confidence: {(beat.confidence * 100).toFixed(0)}%
                          {beat.confidence >= CONFIDENCE_THRESHOLD ? " ✓" : " ✗"}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "rgba(255, 255, 255, 0.7)" }}>
                          Timing: {beat.wasOnBeat ? "On beat ✓" : "Off beat ✗"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "center",
                marginTop: "24px",
              }}
            >
              <button
                onClick={handleStartTest}
                style={{
                  padding: "10px 20px",
                  fontSize: "1rem",
                  backgroundColor: "rgba(56, 176, 255, 0.6)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Test Again
              </button>
              <button
                onClick={() => navigate("/coding")}
                style={{
                  padding: "10px 20px",
                  fontSize: "1rem",
                  backgroundColor: "rgba(100, 100, 100, 0.6)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Back to Code Builder
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
