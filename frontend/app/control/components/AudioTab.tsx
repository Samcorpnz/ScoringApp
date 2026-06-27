"use client";

import { useRef, useState } from "react";
import { formatClockDisplay } from "../../types";
import { SoundCue } from "../../hooks/useSoundCues";
import { RELAY_URL } from "../lib/relay";
import { parseClock } from "../lib/parseClock";
import { SectionLabel } from "./primitives";

const PERIOD_OPTIONS = [
  { label: "All periods", value: "*" },
  { label: "Period 1",    value: "1" },
  { label: "Period 2",    value: "2" },
  { label: "Period 3",    value: "3" },
  { label: "Period 4",    value: "4" },
  { label: "Extra time",  value: "E" },
];

export function AudioTab({ cues, addCue, removeCue, controlToken }: {
  cues: SoundCue[];
  addCue: (cue: SoundCue) => void;
  removeCue: (id: string) => void;
  controlToken: string;
}) {
  const [label,       setLabel]       = useState("");
  const [period,      setPeriod]      = useState("*");
  const [clockInput,  setClockInput]  = useState("");
  const [file,        setFile]        = useState<File | null>(null);
  const [uploading,   setUploading]   = useState(false);
  const [error,       setError]       = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAdd = async () => {
    const secs = parseClock(clockInput);
    if (secs === null) { setError("Enter a valid time (MM:SS or seconds)"); return; }
    if (!file)         { setError("Select an audio file"); return; }

    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("sound", file);
      const res = await fetch(`${RELAY_URL}/api/sound`, {
        method: "POST",
        headers: { "x-control-secret": controlToken },
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      const { filename, originalName, url } = await res.json();
      addCue({
        id:             `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        label:          label.trim() || originalName,
        period,
        clockSeconds:   secs,
        soundUrl:       url.startsWith("http") ? url : `${RELAY_URL}${url}`,
        filename:       originalName,
        serverFilename: filename,
      });
      setLabel(""); setClockInput(""); setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleTest = (cue: SoundCue) => {
    const audio = new Audio(cue.soundUrl);
    audio.play().catch(() => {});
  };

  const handleRemove = async (cue: SoundCue) => {
    // serverFilename is set for cues created after the R2 migration; older
    // cues already in localStorage fall back to parsing the relay-relative
    // URL they were created with (pre-migration, never an absolute CDN URL).
    const filename = cue.serverFilename ?? cue.soundUrl.split("/sounds/")[1];
    if (filename) {
      await fetch(`${RELAY_URL}/api/sound/${encodeURIComponent(filename)}`, {
        method: "DELETE",
        headers: { "x-control-secret": controlToken },
      }).catch(() => {});
    }
    removeCue(cue.id);
  };

  const periodLabel = (p: string) =>
    PERIOD_OPTIONS.find(o => o.value === p)?.label ?? `Period ${p}`;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Add cue form */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <SectionLabel>Add Sound Cue</SectionLabel>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          The selected audio file will play when the clock reaches the specified time during a period.
        </p>

        <div>
          <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>Label (optional)</p>
          <input
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
            placeholder="e.g. 2-minute warning"
            value={label}
            onChange={e => setLabel(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>Period</p>
            <select
              className="w-full rounded-lg px-3 py-2 text-sm font-semibold"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
              value={period}
              onChange={e => setPeriod(e.target.value)}
            >
              {PERIOD_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>Clock time (MM:SS)</p>
            <input
              className="w-full rounded-lg px-3 py-2 text-sm font-semibold font-mono"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
              placeholder="02:00"
              value={clockInput}
              onChange={e => setClockInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
            />
          </div>
        </div>

        <div>
          <p className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>Audio file</p>
          <div
            className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer"
            style={{ background: "var(--bg-elevated)", border: `1px solid ${file ? "var(--border-accent)" : "var(--border)"}` }}
            onClick={() => fileRef.current?.click()}
          >
            <span className="text-base">♪</span>
            <span className="text-sm flex-1 truncate" style={{ color: file ? "var(--text-primary)" : "var(--text-dim)" }}>
              {file ? file.name : "Click to choose an audio file…"}
            </span>
            {file && (
              <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                {(file.size / 1024).toFixed(0)} KB
              </span>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={e => { setFile(e.target.files?.[0] ?? null); setError(""); }}
          />
        </div>

        {error && <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>}

        <button
          className="w-full rounded-lg py-2.5 text-sm font-bold tracking-wide"
          style={{ background: "var(--accent-dim)", border: "1px solid var(--border-accent)", color: "var(--accent)", opacity: uploading ? 0.6 : 1 }}
          onClick={handleAdd}
          disabled={uploading}
        >
          {uploading ? "Uploading…" : "+ Add Cue"}
        </button>
      </div>

      {/* Cue list */}
      <div className="rounded-xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <SectionLabel>Sound Cues ({cues.length})</SectionLabel>
        {cues.length === 0 ? (
          <p className="text-sm mt-3" style={{ color: "var(--text-dim)" }}>
            No cues configured. Add one above.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {[...cues].sort((a, b) => b.clockSeconds - a.clockSeconds).map(cue => (
              <div
                key={cue.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
              >
                <span className="text-base flex-shrink-0" style={{ color: "var(--text-dim)" }}>♪</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{cue.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{cue.filename}</p>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded font-semibold flex-shrink-0"
                  style={{ background: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                >
                  {periodLabel(cue.period)}
                </span>
                <span
                  className="text-xs font-mono font-bold flex-shrink-0"
                  style={{ color: "var(--accent)", minWidth: 44, textAlign: "right" }}
                >
                  {formatClockDisplay(cue.clockSeconds)}
                </span>
                <button
                  className="rounded px-2 py-1 text-xs font-bold flex-shrink-0"
                  style={{ background: "var(--bg-base)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                  onClick={() => handleTest(cue)}
                  title="Test this sound"
                >
                  ▶
                </button>
                <button
                  className="rounded px-2 py-1 text-xs font-bold flex-shrink-0"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--danger)" }}
                  onClick={() => handleRemove(cue)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
