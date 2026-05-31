import { LocateFixed, Minus, Plus, RotateCcw, Search, Thermometer, View } from "lucide-react";

export type MapCommand = "rotate" | "zoomIn" | "zoomOut" | "fit" | "reset";

export function MapControls({
  heatmap,
  onToggleHeatmap,
  onCommand,
  onSearch,
}: {
  heatmap: boolean;
  onToggleHeatmap: () => void;
  onCommand: (command: MapCommand) => void;
  onSearch: () => void;
}) {
  const buttons: Array<{ label: string; command: MapCommand; icon: typeof RotateCcw }> = [
    { label: "Rotate", command: "rotate", icon: RotateCcw },
    { label: "Zoom out", command: "zoomOut", icon: Minus },
    { label: "Zoom in", command: "zoomIn", icon: Plus },
    { label: "Fit view", command: "fit", icon: LocateFixed },
    { label: "Reset", command: "reset", icon: View },
  ];
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 p-2 shadow-2xl backdrop-blur">
      {buttons.map((button) => (
        <button key={button.label} type="button" onClick={() => onCommand(button.command)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-black text-slate-100 hover:bg-white/[0.09]">
          <button.icon className="h-3.5 w-3.5 text-sky-300" />
          {button.label}
        </button>
      ))}
      <button type="button" onClick={onSearch} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-black text-slate-100 hover:bg-white/[0.09]">
        <Search className="h-3.5 w-3.5 text-sky-300" />
        Search map
      </button>
      <button type="button" onClick={onToggleHeatmap} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black ${heatmap ? "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100" : "border-white/10 bg-white/[0.05] text-slate-100 hover:bg-white/[0.09]"}`}>
        <Thermometer className="h-3.5 w-3.5" />
        Heatmap
      </button>
    </div>
  );
}
