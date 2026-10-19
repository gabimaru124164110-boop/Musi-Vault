import { useEffect, useState } from "react";
import { useAudio } from "../context/AudioContext";

type MusicResult = {
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
};

function imageSize(url?: string) {
  return url?.replace(/\d+x\d+bb(?=\.)/, "600x600bb") ?? null;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2)
    .map(part => part[0]?.toUpperCase()).join("") || "MV";
}

export default function VirtualPlayer3D() {
  const { isPlaying, currentTrack } = useAudio();
  const [cover, setCover] = useState<string | null>(null);
  const [artistPhoto, setArtistPhoto] = useState<string | null>(null);
  const [artStatus, setArtStatus] = useState("READY");

  const title = currentTrack?.title ?? "";
  const artist = currentTrack?.artist ?? "";

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    setCover(null);
    setArtistPhoto(null);

    if (!title) {
      setArtStatus("READY");
      return () => controller.abort();
    }

    setArtStatus("SEARCHING ARTWORK");

    async function lookupArtwork() {
      const normalize = (value: string) =>
        value.toLowerCase()
          .replace(/\.(mp3|m4a|aac|flac|wav|ogg|opus|mp4)$/i, "")
          .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
          .replace(/[^a-z0-9]/g, "");

      const cleanTitle = title
        .replace(/\.(mp3|m4a|aac|flac|wav|ogg|opus|mp4)$/i, "")
        .replace(/^\d+[\s._-]+/, "")
        .trim();

      const queries = [
        [cleanTitle, artist].filter(Boolean).join(" "),
        cleanTitle,
        [artist, cleanTitle].filter(Boolean).join(" ")
      ].filter(Boolean);

      let best: { item: MusicResult; score: number } | null = null;

      try {
        for (const term of [...new Set(queries)]) {
          const url =
            "https://itunes.apple.com/search?media=music&entity=song&limit=20&country=US&term=" +
            encodeURIComponent(term);

          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) continue;

          const data = await response.json();
          const results: MusicResult[] = data.results ?? [];

          for (const item of results) {
            const foundTitle = normalize(item.trackName ?? "");
            const wantedTitle = normalize(cleanTitle);
            const foundArtist = normalize(item.artistName ?? "");
            const wantedArtist = normalize(artist);

            let score = 0;

            if (foundTitle === wantedTitle) score += 10;
            else if (foundTitle.includes(wantedTitle) ||
                     wantedTitle.includes(foundTitle)) score += 5;

            if (wantedArtist && foundArtist === wantedArtist) score += 8;
            else if (wantedArtist &&
                     (foundArtist.includes(wantedArtist) ||
                      wantedArtist.includes(foundArtist))) score += 4;

            if (item.artworkUrl100 && (!best || score > best.score)) {
              best = { item, score };
            }
          }

          if (best && best.score >= 18) break;
        }

        if (active && best && best.score >= 5 && best.item.artworkUrl100) {
          setCover(imageSize(best.item.artworkUrl100));
          setArtStatus("ONLINE COVER FOUND");
        } else if (active) {
          setArtStatus("NO MATCH FOUND ONLINE");
        }
      } catch (error) {
        if (active && !(error instanceof Error && error.name === "AbortError")) {
          setArtStatus("ARTWORK SEARCH FAILED");
        }
      }
    }

    async function lookupArtist() {
      if (!artist) return;

      try {
        const url =
          "https://en.wikipedia.org/api/rest_v1/page/summary/" +
          encodeURIComponent(artist);

        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return;

        const data = await response.json();
        const description = String(data.description ?? "").toLowerCase();
        const pageTitle = String(data.title ?? "").toLowerCase();
        const name = artist.toLowerCase();

        if (
          active &&
          data.thumbnail?.source &&
          (pageTitle === name || description.includes("musician") ||
           description.includes("singer") || description.includes("rapper") ||
           description.includes("composer") || description.includes("band"))
        ) {
          setArtistPhoto(data.thumbnail.source);
        }
      } catch {
        // The initials avatar remains available if online lookup fails.
      }
    }

    void lookupArtwork();
    void lookupArtist();

    return () => {
      active = false;
      controller.abort();
    };
  }, [currentTrack?.id, title, artist]);

  return (
    <section className="gramophone-card">
      <div className="gramophone-heading">
        <div className="brand-lockup">
          <span className="brand-emblem">MV</span>
          <div>
            <span className="gramophone-eyebrow">MUSI-VAULT</span>
            <div className="brand-subtitle">PERSONAL LISTENING ROOM</div>
          </div>
        </div>
        <span className={`gramophone-status ${isPlaying ? "on" : ""}`}>
          <span className="status-dot" />
          {isPlaying ? "PLAYING" : "PAUSED"}
        </span>
      </div>

      <div className="vinyl-stage">
        <div className="vinyl-shadow" />
        <div className={`vinyl-disc ${isPlaying ? "is-spinning" : ""}`}>
          <div className="vinyl-grooves" />
          <div className="vinyl-glare" />
          <div className="vinyl-label">
            {cover ? (
              <img
                className="vinyl-cover-art"
                src={cover}
                alt="Song cover artwork"
                onError={() => setCover(null)}
              />
            ) : (
              <div className="label-ring">
                <span className="label-brand">M V</span>
                <span className="label-title">{title || "SIDE A"}</span>
                <span className="label-artist">{artist || "YOUR SOUND. YOUR WORLD."}</span>
                <span className="label-hole" />
              </div>
            )}
          </div>
        </div>

        <div className={`tonearm ${isPlaying ? "tonearm-playing" : ""}`}>
          <div className="tonearm-pivot" />
          <div className="tonearm-shaft" />
          <div className="tonearm-head">
            <span className="stylus-tip" />
          </div>
        </div>
        <div className="deck-light" />
      </div>

      <div className="artwork-status">
        <span className="artwork-status-dot" />
        {artStatus}
      </div>

      <div className="gramophone-caption">
        <div className="caption-track">
          <span className="caption-eyebrow">NOW ON THE TURNTABLE</span>
          <strong>{title || "Nothing playing yet"}</strong>
          <div className="caption-artist">
            <div className="artist-avatar">
              {artistPhoto ? (
                <img src={artistPhoto} alt={artist + " profile"} onError={() => setArtistPhoto(null)} />
              ) : (
                <span>{initials(artist || "Musi Vault")}</span>
              )}
            </div>
            <span>{artist || "Import a track to begin"}</span>
          </div>
        </div>
        <div className="rpm-badge">
          <strong>33⅓</strong>
          <span>RPM</span>
        </div>
      </div>
      <div className="gramophone-footer">
        <span>ANALOG SOUL</span>
        <span>•</span>
        <span>DIGITAL SOUND</span>
      </div>
    </section>
  );
}
