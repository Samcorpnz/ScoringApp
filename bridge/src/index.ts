/**
 * Scoreboard Bridge — runs at the venue.
 * Reads the Saturn serial port and pushes MatchState to the cloud relay.
 *
 * Usage:
 *   npm start                           # uses .env
 *   SERIAL_PORT=COM3 npm start          # override port
 */

import { io, Socket } from "socket.io-client";
import { SerialPort } from "serialport";
import { SaturnFramer, applySaturnMessage } from "./protocol/saturnParser";
import { MatchState, DEFAULT_MATCH_STATE } from "./types";

const RELAY_URL    = process.env.RELAY_URL    ?? "http://localhost:4000";
const BRIDGE_SECRET = process.env.BRIDGE_SECRET ?? "changeme";
const SERIAL_PORT  = process.env.SERIAL_PORT  ?? "";
const BAUD_RATE    = parseInt(process.env.BAUD_RATE ?? "9600", 10);

let state: MatchState = { ...DEFAULT_MATCH_STATE };
let socket: Socket;
let broadcastTimer: NodeJS.Timeout;

function connectRelay(): void {
  socket = io(RELAY_URL, {
    auth: { secret: BRIDGE_SECRET, role: "bridge" },
    reconnection: true,
    reconnectionDelay: 2000,
  });

  socket.on("connect", () => {
    console.log(`[relay] Connected to ${RELAY_URL}`);
    // Send current state immediately on (re)connect
    socket.emit("stateUpdate", state);
  });

  socket.on("disconnect", (reason) => {
    console.warn(`[relay] Disconnected: ${reason}`);
  });

  socket.on("manualUpdate", (patch: Partial<MatchState>) => {
    state = { ...state, ...patch, sequenceId: state.sequenceId + 1 };
    console.log("[manual] State patched from control panel");
  });

  // Broadcast at most 5×/sec to avoid flooding the relay
  broadcastTimer = setInterval(() => {
    if (socket.connected) socket.emit("stateUpdate", state);
  }, 200);
}

async function connectSerial(portName: string): Promise<void> {
  const framer = new SaturnFramer();

  const port = new SerialPort({
    path: portName,
    baudRate: BAUD_RATE,
    dataBits: 8,
    parity: "none",
    stopBits: 1,
    autoOpen: false,
  });

  await new Promise<void>((resolve, reject) => {
    port.open(err => (err ? reject(err) : resolve()));
  });

  port.on("data", (data: Buffer) => {
    const messages = framer.feed(data);
    for (const msg of messages) {
      const next = applySaturnMessage(msg, state);
      if (next !== state) {
        state = { ...next, inputSource: portName };
      }
    }
  });

  port.on("error", err => console.error(`[serial] Error: ${err.message}`));
  port.on("close", () => console.warn("[serial] Port closed"));

  console.log(`[serial] Listening on ${portName} @ ${BAUD_RATE} baud`);
}

async function listPorts(): Promise<void> {
  const ports = await SerialPort.list();
  if (ports.length === 0) {
    console.log("[serial] No serial ports found");
  } else {
    console.log("[serial] Available ports:");
    ports.forEach(p => console.log(`  ${p.path}  ${p.manufacturer ?? ""}`));
  }
}

async function main(): Promise<void> {
  console.log("=== Scoreboard Bridge ===");
  console.log(`Relay: ${RELAY_URL}`);

  await listPorts();
  connectRelay();

  if (SERIAL_PORT) {
    try {
      await connectSerial(SERIAL_PORT);
    } catch (err) {
      console.error(`[serial] Failed to open ${SERIAL_PORT}:`, err);
      console.log("[bridge] Running without serial input — manual/relay control only");
    }
  } else {
    console.log("[bridge] No SERIAL_PORT set — manual/relay control only");
    console.log("  Set SERIAL_PORT=COM3 (or /dev/ttyUSB0) in .env to enable");
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
