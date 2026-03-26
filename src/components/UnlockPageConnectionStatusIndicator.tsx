export interface ConnectionStatusIndicatorProps {
  isConnected: boolean;
  onConnect: () => void;
}

export function ConnectionStatusIndicator({ isConnected, onConnect }: ConnectionStatusIndicatorProps) {
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
