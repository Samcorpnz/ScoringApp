import { Response } from "express";

export type LogLevel = "info" | "warn" | "error" | "data" | "relay";

export interface LogEntry {
  ts: number;
  level: LogLevel;
  msg: string;
}

const MAX_HISTORY = 500;
const history: LogEntry[] = [];
const sseClients: Set<Response> = new Set();

function emit(level: LogLevel, msg: string): void {
  const entry: LogEntry = { ts: Date.now(), level, msg };
  history.push(entry);
  if (history.length > MAX_HISTORY) history.shift();

  const line = `data: ${JSON.stringify(entry)}\n\n`;
  for (const res of sseClients) {
    try { res.write(line); } catch { sseClients.delete(res); }
  }

  const line2 = `[${level.toUpperCase().padEnd(5)}] ${msg}`;
  if (level === "error") console.error(line2);
  else if (level === "warn") console.warn(line2);
  else console.log(line2);
}

export const log = {
  info:  (msg: string) => emit("info", msg),
  warn:  (msg: string) => emit("warn", msg),
  error: (msg: string) => emit("error", msg),
  data:  (msg: string) => emit("data", msg),
  relay: (msg: string) => emit("relay", msg),
};

export function addSseClient(res: Response): void {
  sseClients.add(res);
  // Send history to new client
  for (const entry of history) {
    try { res.write(`data: ${JSON.stringify(entry)}\n\n`); } catch { break; }
  }
}

export function removeSseClient(res: Response): void {
  sseClients.delete(res);
}

export function getHistory(): LogEntry[] {
  return [...history];
}
