import { useCallback, useEffect, useRef, useState } from "react";
import {
  createWebUSBConnection,
  createUniversalHexFlashDataSource,
  createWebBluetoothConnection,
  UARTDataEvent,
} from "@microbit/microbit-connection";

import hexContent from "../MICROBIT.hex?raw";

export default function ConnectPage() {
  const [status, setStatus] = useState("Not connected");
  const [feedback, setFeedback] = useState("Waiting for input...");
  const [microbitData, setMicrobitData] = useState("No micro:bit data yet");
  const bluetoothRef = useRef<ReturnType<typeof createWebBluetoothConnection> | null>(null);

  const disconnectBluetooth = useCallback(async () => {
    if (!bluetoothRef.current) {
      setStatus("Not connected to Bluetooth");
      return;
    }

    setStatus("Disconnecting Bluetooth...");
    try {
      await bluetoothRef.current.disconnect();
      setStatus("Bluetooth disconnected");
    } catch (err) {
      console.error(err);
      setStatus("Failed to disconnect Bluetooth");
    } finally {
      bluetoothRef.current = null;
    }
  }, []);

  const flashMicrobit = useCallback(async () => {
    if (bluetoothRef.current) {
      setStatus("Disconnecting Bluetooth before USB flash...");
      try {
        await bluetoothRef.current.disconnect();
      } catch (err) {
        console.warn(err);
      }
      bluetoothRef.current = null;
    }

    setStatus("Connecting via USB...");

    const usb = createWebUSBConnection();

    try {
      await usb.connect();
      setStatus("Flashing...");

      await usb.flash(createUniversalHexFlashDataSource(hexContent), {
        partial: true,
        progress: (p: number | undefined) => setStatus(`Flashing: ${p ?? 0}%`),
      });

      setStatus("Flash complete ✅");
    } catch (err) {
      console.error(err);
      setStatus("Flash failed ❌");
    }
  }, []);

  const connectBluetooth = useCallback(async () => {
    setStatus("Connecting Bluetooth...");

    try {
      const bluetooth = createWebBluetoothConnection();
      bluetoothRef.current = bluetooth;
      const connectionStatus = await bluetooth.connect();

      if (connectionStatus !== "CONNECTED") {
        setStatus(`Bluetooth status: ${connectionStatus}`);
        return;
      }

      setStatus("Connected ✅");

      bluetooth.addEventListener("buttonachanged", (event) => {
        const state = event.state;
        const message = `Button A: ${state}`;
        setMicrobitData(message);
        setFeedback(message);
      });

      bluetooth.addEventListener("buttonbchanged", (event) => {
        const state = event.state;
        const message = `Button B: ${state}`;
        setMicrobitData(message);
        setFeedback(message);
      });

      bluetooth.addEventListener("accelerometerdatachanged", (event) => {
        const v = event.data;
        const message = `Accel x=${v.x.toFixed(1)} y=${v.y.toFixed(1)} z=${v.z.toFixed(1)}`;
        setMicrobitData(message);
      });

      bluetooth.addEventListener("magnetometerdatachanged", (event) => {
        const v = event.data;
        const message = `Magnetometer x=${v.x.toFixed(1)} y=${v.y.toFixed(1)} z=${v.z.toFixed(1)}`;
        setMicrobitData(message);
      });

      bluetooth.addEventListener("uartdata", (event: UARTDataEvent) => {
        const text = new TextDecoder().decode(event.value);
        const message = `UART: ${text}`;
        console.log("Received:", text);
        setMicrobitData(message);
        setFeedback(message);
      });
    } catch (err) {
      console.error(err);
      setStatus("Bluetooth failed ❌");
    }
  }, []);

  // Ensure cleanup on unmount.
  useEffect(() => {
    return () => {
      if (bluetoothRef.current) {
        bluetoothRef.current.disconnect().catch(console.warn);
      }
    };
  }, []);

  return (
    <>
      <h1>micro:bit Control</h1>
      <p>Use USB to flash or connect via Bluetooth to watch button events.</p>

      <div className="card" style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
          <button onClick={flashMicrobit}>Flash micro:bit (USB)</button>
          <button onClick={connectBluetooth}>Connect via Bluetooth</button>
          <button onClick={disconnectBluetooth}>Disconnect Bluetooth</button>
        </div>

        <div style={{ marginTop: 18, textAlign: "left" }}>
          <p>
            <strong>Status:</strong> {status}
          </p>
          <p>
            <strong>Feedback:</strong> {feedback}
          </p>
          <p>
            <strong>Micro:bit Data:</strong> {microbitData}
          </p>
        </div>
      </div>
    </>
  );
}
