import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  deleteTrack as deleteStoredTrack,
  getAllTracks,
  saveTrack,
  updateTrackDuration,
  type MusicTrack,
} from "../services/StorageEngine";

const BANDS = [60, 250, 1000, 4000, 12000];

interface AudioState {
  tracks: MusicTrack[];
  currentTrack: MusicTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  eq: number[];
  shuffle: boolean;
  loop: "off" | "all" | "one";
  importFiles: (files: FileList | File[]) => Promise<void>;
  playTrack: (id: string) => Promise<void>;
  togglePlayback: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seek: (time: number) => void;
  setVolume: (value: number) => void;
  setBand: (index: number, value: number) => void;
  setShuffle: (value: boolean) => void;
  setLoop: (value: "off" | "all" | "one") => void;
  removeTrack: (id: string) => Promise<void>;
}

const AudioCtx = createContext<AudioState | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [eq, setEq] = useState([0, 0, 0, 0, 0]);
  const [shuffle, setShuffle] = useState(false);
  const [loop, setLoop] = useState<"off" | "all" | "one">("off");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<globalThis.AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const urlsRef = useRef<Map<string, string>>(new Map());
  const tracksRef = useRef<MusicTrack[]>([]);
  const currentIdRef = useRef<string | null>(null);
  const loopRef = useRef(loop);
  const shuffleRef = useRef(shuffle);
  const volumeRef = useRef(volume);
  const eqRef = useRef(eq);
  const crossfadeTimer = useRef<number | null>(null);

  const currentTrack = tracks.find((track) => track.id === currentId) ?? null;

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    currentIdRef.current = currentId;
  }, [currentId]);

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    eqRef.current = eq;
  }, [eq]);

  const ensureAudioGraph = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audioContextRef.current) {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;

      if (!AudioContextClass) {
        throw new Error("Web Audio is not supported in this browser.");
      }

      const ctx = new AudioContextClass();
      const source = ctx.createMediaElementSource(audio);
      const filters = BANDS.map((frequency, index) => {
        const filter = ctx.createBiquadFilter();
        filter.type = "peaking";
        filter.frequency.value = frequency;
        filter.Q.value = 1;
        filter.gain.value = eqRef.current[index];
        return filter;
      });

      const gain = ctx.createGain();
      gain.gain.value = volumeRef.current;

      source.connect(filters[0]);
      filters.forEach((filter, index) => {
        if (index < filters.length - 1) {
          filter.connect(filters[index + 1]);
        }
      });
      filters[filters.length - 1].connect(gain);
      gain.connect(ctx.destination);

      audioContextRef.current = ctx;
      sourceRef.current = source;
      filtersRef.current = filters;
      gainRef.current = gain;
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      setCurrentTime(audio.currentTime);

      // Fade down near the end. The next track starts when playback ends.
      // This is a fade transition, not overlapping two audio tracks.
      if (
        audio.duration > 1 &&
        audio.duration - audio.currentTime <= 1 &&
        !audio.ended &&
        crossfadeTimer.current === null
      ) {
        const gain = gainRef.current;
        const ctx = audioContextRef.current;

        if (gain && ctx) {
          gain.gain.cancelScheduledValues(ctx.currentTime);
          gain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
          crossfadeTimer.current = window.setTimeout(() => {
            crossfadeTimer.current = null;
          }, 1200);
        }
      }
    };

    const onMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);

      const id = currentIdRef.current;
      if (id && Number.isFinite(audio.duration)) {
        const length = audio.duration;
        setTracks((previous) =>
          previous.map((track) =>
            track.id === id ? { ...track, duration: length } : track,
          ),
        );
        void updateTrackDuration(id, length);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);

      if (crossfadeTimer.current !== null) {
        window.clearTimeout(crossfadeTimer.current);
        crossfadeTimer.current = null;
      }

      const list = tracksRef.current;
      const id = currentIdRef.current;
      const index = list.findIndex((track) => track.id === id);

      if (loopRef.current === "one" && id) {
        audio.currentTime = 0;
        void audio.play().then(() => setIsPlaying(true)).catch(console.error);
      } else if (index >= 0 && (index < list.length - 1 || loopRef.current === "all")) {
        const nextIndex =
          shuffleRef.current && list.length > 1
            ? (() => {
                let n = index;
                while (n === index) n = Math.floor(Math.random() * list.length);
                return n;
              })()
            : (index + 1) % list.length;

        const nextTrack = list[nextIndex];
        if (nextTrack) {
          void startTrack(nextTrack);
        }
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void getAllTracks()
      .then((saved) => {
        if (!cancelled) setTracks(saved);
      })
      .catch((error) => console.error("Could not load music library:", error));

    return () => {
      cancelled = true;
    };
  }, []);

  const startTrack = useCallback(
    async (track: MusicTrack) => {
      const audio = audioRef.current;
      if (!audio) return;

      await ensureAudioGraph();

      let url = urlsRef.current.get(track.id);
      if (!url) {
        url = URL.createObjectURL(track.blob);
        urlsRef.current.set(track.id, url);
      }

      if (currentIdRef.current !== track.id || audio.src !== url) {
        audio.src = url;
        audio.currentTime = 0;
      }

      currentIdRef.current = track.id;
      setCurrentId(track.id);

      const gain = gainRef.current;
      const ctx = audioContextRef.current;
      if (gain && ctx) {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.setTargetAtTime(volumeRef.current, ctx.currentTime, 0.12);
      }

      await audio.play();
      setIsPlaying(true);
    },
    [ensureAudioGraph],
  );

  const importFiles = useCallback(async (files: FileList | File[]) => {
    const imported: MusicTrack[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("audio/") && !/\.(mp3|wav|flac|ogg|m4a|aac|opus|weba)$/i.test(file.name)) {
        continue;
      }

      const name = file.name.replace(/\.[^.]+$/, "").trim() || "Unknown Track";
      const parts = name.split(/\s+-\s+/);
      const track: MusicTrack = {
        id: crypto.randomUUID(),
        title: parts.length > 1 ? parts.slice(1).join(" - ") : name,
        artist: parts.length > 1 ? parts[0] : "Unknown Artist",
        duration: 0,
        blob: file.slice(0, file.size, file.type || "application/octet-stream"),
        mimeType: file.type || "application/octet-stream",
        addedAt: Date.now(),
      };

      try {
        await saveTrack(track);
        imported.push(track);
      } catch (error) {
        console.error("Could not store", file.name, error);
        alert(`Couldn't save ${file.name}. Your browser may be out of storage space.`);
      }
    }

    if (imported.length) {
      setTracks((previous) => {
        const known = new Set(previous.map((track) => track.id));
        return [...previous, ...imported.filter((track) => !known.has(track.id))];
      });
    }
  }, []);

  const playTrack = useCallback(
    async (id: string) => {
      const track = tracksRef.current.find((item) => item.id === id);
      if (track) {
        try {
          await startTrack(track);
        } catch (error) {
          console.error("Playback failed:", error);
          alert("Couldn't play this track. The audio format may not be supported.");
        }
      }
    },
    [startTrack],
  );

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (!audio.paused) {
        audio.pause();
        return;
      }

      if (!audio.src && tracksRef.current.length) {
        await startTrack(tracksRef.current[0]);
      } else {
        await ensureAudioGraph();
        await audio.play();
      }
    } catch (error) {
      console.error("Playback failed:", error);
      alert("Playback failed. Try selecting the track again.");
    }
  }, [ensureAudioGraph, startTrack]);

  const next = useCallback(async () => {
    const list = tracksRef.current;
    if (!list.length) return;

    const index = list.findIndex((track) => track.id === currentIdRef.current);
    let nextIndex = index < 0 ? 0 : index + 1;

    if (shuffleRef.current && list.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * list.length);
      } while (nextIndex === index);
    } else if (nextIndex >= list.length) {
      if (loopRef.current !== "all") return;
      nextIndex = 0;
    }

    const track = list[nextIndex];
    if (track) await startTrack(track);
  }, [startTrack]);

  const previous = useCallback(async () => {
    const audio = audioRef.current;

    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }

    const list = tracksRef.current;
    if (!list.length) return;

    const index = list.findIndex((track) => track.id === currentIdRef.current);
    const previousIndex = index <= 0 ? list.length - 1 : index - 1;
    const track = list[previousIndex];

    if (track) await startTrack(track);
  }, [startTrack]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio && Number.isFinite(time)) {
      audio.currentTime = Math.max(0, Math.min(time, audio.duration || 0));
      setCurrentTime(audio.currentTime);
    }
  }, []);

  const setVolume = useCallback((value: number) => {
    const safe = Math.max(0, Math.min(1, value));
    setVolumeState(safe);
    if (gainRef.current && audioContextRef.current) {
      gainRef.current.gain.setTargetAtTime(
        safe,
        audioContextRef.current.currentTime,
        0.02,
      );
    }
  }, []);

  const setBand = useCallback((index: number, value: number) => {
    const safe = Math.max(-12, Math.min(12, value));
    setEq((previous) =>
      previous.map((old, i) => (i === index ? safe : old)),
    );

    const filter = filtersRef.current[index];
    const ctx = audioContextRef.current;
    if (filter && ctx) {
      filter.gain.setTargetAtTime(safe, ctx.currentTime, 0.03);
    }
  }, []);

  const removeTrack = useCallback(async (id: string) => {
    await deleteStoredTrack(id);

    const url = urlsRef.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      urlsRef.current.delete(id);
    }

    if (currentIdRef.current === id) {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.src = "";
      currentIdRef.current = null;
      setCurrentId(null);
      setIsPlaying(false);
    }

    setTracks((previous) => previous.filter((track) => track.id !== id));
  }, []);

  useEffect(() => {
    return () => {
      if (crossfadeTimer.current !== null) {
        window.clearTimeout(crossfadeTimer.current);
      }
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      void audioContextRef.current?.close();
    };
  }, []);

  const value: AudioState = {
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
  };

  return (
    <AudioCtx.Provider value={value}>
      <audio ref={audioRef} preload="metadata" />
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio(): AudioState {
  const context = useContext(AudioCtx);
  if (!context) {
    throw new Error("useAudio must be used inside AudioProvider");
  }
  return context;
}
