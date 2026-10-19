import VirtualPlayer3D from "./components/VirtualPlayer3D";
import { useRef } from "react";
import { AudioProvider, useAudio } from "./context/AudioContext";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function Player() {
  const {
    tracks,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    eq,
    shuffle,
    loop,
    importFiles,
    playTrack,
    togglePlayback,
    next,
    previous,
    seek,
    setVolume,
    setBand,
    setShuffle,
    setLoop,
    removeTrack,
  } = useAudio();

  const fileInput = useRef<HTMLInputElement>(null);

  return (

    <main className="min-h-screen bg-[#0a0a0c] text-zinc-100">
      <div className="mx-auto w-full max-w-5xl px-4 pt-6"><VirtualPlayer3D /></div>
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-5 md:px-10">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">LOCAL AUDIO SYSTEM</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
            MUSI<span className="text-cyan-300">-</span>VAULT
          </h1>
        </div>
        <button
          onClick={() => fileInput.current?.click()}
          className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-black transition hover:bg-cyan-200"
        >
          + Import music
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="audio/*,.flac,.mp3,.wav,.m4a,.ogg,.opus"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) void importFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </header>

      <div className="grid gap-6 p-5 md:grid-cols-[260px_minmax(0,1fr)] md:p-10">
        
        <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Your vault</p>
          <div className="mt-5 space-y-3">
            <div className="rounded-xl bg-white/[0.07] p-4">
              <p className="text-sm text-zinc-400">Offline tracks</p>
              <p className="mt-1 text-3xl font-bold">{tracks.length}</p>
            </div>
            <div className="rounded-xl bg-white/[0.07] p-4">
              <p className="text-sm text-zinc-400">Storage engine</p>
              <p className="mt-1 font-semibold text-emerald-300">IndexedDB · Local</p>
            </div>
          </div>
          <p className="mt-8 text-xs leading-6 text-zinc-500">
            Your imported tracks stay in this browser on this device. Clearing site data can erase your library.
          </p>
        </aside>

        <section className="min-w-0 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 to-[#101c22] p-6 md:p-9">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Now playing</p>
            <div className="mt-6 flex flex-col gap-7 sm:flex-row sm:items-center">
              <div className={`record ${isPlaying ? "record-playing" : ""}`}>
                <div className="record-label">
                  <span>MV</span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-2xl font-bold md:text-4xl">
                  {currentTrack?.title ?? "Nothing playing yet"}
                </h2>
                <p className="mt-2 text-zinc-400">
                  {currentTrack?.artist ?? "Import a track to get started"}
                </p>

                <div className="mt-7">
                  <input
                    aria-label="Playback position"
                    type="range"
                    min={0}
                    max={duration || 1}
                    step={0.1}
                    value={Math.min(currentTime, duration || 1)}
                    onChange={(event) => seek(Number(event.target.value))}
                    className="w-full accent-cyan-300"
                  />
                  <div className="flex justify-between text-xs tabular-nums text-zinc-500">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button onClick={() => void previous()} className="player-button" aria-label="Previous track">⏮</button>
                  <button onClick={() => void togglePlayback()} className="play-button" aria-label={isPlaying ? "Pause" : "Play"}>
                    {isPlaying ? "Ⅱ" : "▶"}
                  </button>
                  <button onClick={() => void next()} className="player-button" aria-label="Next track">⏭</button>
                  <button
                    onClick={() => setShuffle(!shuffle)}
                    className={`player-button text-sm ${shuffle ? "active-button" : ""}`}
                    aria-label="Toggle shuffle"
                  >SHUF</button>
                  <button
                    onClick={() => setLoop(loop === "off" ? "all" : loop === "all" ? "one" : "off")}
                    className={`player-button text-sm ${loop !== "off" ? "active-button" : ""}`}
                    aria-label="Change repeat mode"
                  >{loop === "one" ? "REP 1" : "REP"}</button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Equalizer</h3>
                <span className="text-xs text-zinc-500">−12 to +12 dB</span>
              </div>
              <div className="mt-6 grid grid-cols-5 gap-3">
                {["60", "250", "1K", "4K", "12K"].map((label, index) => (
                  <label key={label} className="flex flex-col items-center gap-3">
                    <span className="text-xs text-cyan-200">{eq[index] > 0 ? "+" : ""}{eq[index]} dB</span>
                    <input
                      aria-label={`${label} Hz equalizer`}
                      className="eq-slider"
                      type="range"
                      min={-12}
                      max={12}
                      step={1}
                      value={eq[index]}
                      onChange={(event) => setBand(index, Number(event.target.value))}
                    />
                    <span className="text-xs text-zinc-500">{label}</span>
                  </label>
                ))}
              </div>
              <div className="mt-7 flex items-center gap-4">
                <span className="text-sm text-zinc-400">Volume</span>
                <input
                  aria-label="Volume"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(event) => setVolume(Number(event.target.value))}
                  className="flex-1 accent-cyan-300"
                />
                <span className="w-10 text-right text-xs text-zinc-400">{Math.round(volume * 100)}%</span>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Your library</h3>
                <span className="text-xs text-zinc-500">{tracks.length} tracks</span>
              </div>
              <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
                {tracks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/15 p-7 text-center text-sm leading-6 text-zinc-500">
                    Your vault is suspiciously quiet.<br />Import some audio files.
                  </div>
                ) : tracks.map((track) => (
                  <div
                    key={track.id}
                    className={`flex items-center gap-3 rounded-xl p-3 ${currentTrack?.id === track.id ? "bg-cyan-300/10" : "bg-white/[0.04]"}`}
                  >
                    <button
                      onClick={() => void playTrack(track.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm font-semibold">{track.title}</span>
                      <span className="mt-1 block truncate text-xs text-zinc-500">
                        {track.artist} · {formatTime(track.duration)}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remove "${track.title}" from this device?`)) {
                          void removeTrack(track.id);
                        }
                      }}
                      className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-white/10 hover:text-red-300"
                      aria-label={`Remove ${track.title}`}
                    >×</button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>

      <footer className="px-5 pb-8 text-center text-xs tracking-wide text-zinc-600">
        MUSI-VAULT · YOUR MUSIC, YOUR DEVICE
      </footer>
    </main>
  );
}

export default function App() {
  return (
    <AudioProvider>
      <Player />
    </AudioProvider>
  );
}
