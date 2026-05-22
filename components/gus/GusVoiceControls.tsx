"use client";

import { Headphones, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useGusVoice } from "@/components/gus/useGusVoice";
import type { GusMessage } from "@/lib/gus/gusTypes";

type GusVoiceControlsProps = {
  message: GusMessage;
  route: string;
  assistantOpen: boolean;
};

export function GusVoiceControls({ message, route, assistantOpen }: GusVoiceControlsProps) {
  const voice = useGusVoice({ message, route, assistantOpen });
  const canReplay = Boolean(voice.lastSpokenText) && !voice.isSuppressedToday;

  if (!voice.routeAllowsVoice) return null;

  return (
    <div className="rounded-lg border border-[var(--app-border)] bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {!voice.voiceEnabled || voice.textOnlyMode || voice.isSuppressedToday ? (
          <button
            type="button"
            onClick={voice.turnOnVoice}
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--app-text-strong)] transition hover:bg-white"
          >
            <Volume2 className="h-4 w-4" aria-hidden="true" />
            Turn on Gus voice
          </button>
        ) : (
          <button
            type="button"
            onClick={voice.muteVoice}
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-soft)]"
          >
            <VolumeX className="h-4 w-4" aria-hidden="true" />
            Mute
          </button>
        )}

        <button
          type="button"
          onClick={voice.replayLast}
          disabled={!canReplay}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--app-text-strong)] transition hover:bg-[var(--app-panel-soft)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Replay
        </button>

        <button
          type="button"
          onClick={voice.useTextOnlyMode}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--app-muted)] transition hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text-strong)]"
        >
          <Headphones className="h-4 w-4" aria-hidden="true" />
          Text only
        </button>

        <button
          type="button"
          onClick={voice.doNotSpeakAgainToday}
          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[var(--app-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--app-muted)] transition hover:bg-[var(--app-panel-soft)] hover:text-[var(--app-text-strong)]"
        >
          Do not speak again today
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-4 text-[var(--app-muted)]" role="status">
        {voice.status === "loading"
          ? "Preparing Gus voice."
          : voice.status === "playing"
            ? "Gus voice is playing."
            : voice.status === "error"
              ? "Voice is unavailable right now."
              : voice.textOnlyMode
                ? "Text-only mode is on."
                : "Gus voice is optional and opt-in."}
      </p>
    </div>
  );
}
