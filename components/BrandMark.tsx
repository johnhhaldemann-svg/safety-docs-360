import Image from "next/image";

type BrandMarkProps = {
  className?: string;
  imageClassName?: string;
  variant?: "wordmark" | "sidebar-panel";
};

export function BrandMark({
  className = "",
  imageClassName = "",
  variant = "wordmark",
}: BrandMarkProps) {
  if (variant === "sidebar-panel") {
    return (
      <div
        className={`relative overflow-hidden rounded-[2rem] border border-[rgba(138,161,194,0.34)] bg-[linear-gradient(180deg,_rgba(248,251,255,0.98)_0%,_rgba(239,245,253,0.97)_52%,_rgba(232,239,249,0.98)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_10px_24px_rgba(53,79,121,0.1)] ${className}`}
      >
        <div className="absolute inset-x-5 top-0 h-24 bg-[radial-gradient(circle_at_top,_rgba(117,147,210,0.16),_transparent_70%)]" />
        <div className="absolute inset-0 rounded-[2rem] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]" />

        <div className="relative flex h-full flex-col items-center justify-center px-4 py-4">
          <div className="relative mx-1 flex h-[8rem] w-[calc(100%-0.5rem)] items-center justify-center rounded-[1.85rem] border border-[rgba(150,170,199,0.24)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.99)_0%,_rgba(244,247,252,0.96)_100%)] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.94),0_8px_18px_rgba(55,78,120,0.07)]">
            <div className="absolute inset-0 rounded-[1.85rem] bg-[radial-gradient(circle_at_top,_rgba(122,149,214,0.12),_transparent_58%)]" />
            <div className={`relative flex w-full max-w-[10.9rem] items-center gap-2 ${imageClassName}`}>
              <div className="relative h-[3.25rem] w-[3.25rem] shrink-0">
                <Image
                  src="/brand/safety360docs-reliance-icon.png"
                  alt="Safety360Docs by Reliance EHS"
                  fill
                  priority
                  sizes="52px"
                  className="object-contain drop-shadow-[0_3px_6px_rgba(22,54,102,0.18)]"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className="flex items-baseline gap-0 leading-none tracking-[-0.06em]"
                  style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
                >
                  <span
                    className="text-[1rem] font-black italic text-[#1b74cf]"
                    style={{ textShadow: "0 1px 1px rgba(19,72,137,0.18)" }}
                  >
                    Safety
                  </span>
                  <span
                    className="text-[1rem] font-black italic text-[#7bc043]"
                    style={{ textShadow: "0 1px 1px rgba(86,134,31,0.14)" }}
                  >
                    360
                  </span>
                  <span
                    className="text-[1rem] font-black italic text-[#1b74cf]"
                    style={{ textShadow: "0 1px 1px rgba(19,72,137,0.18)" }}
                  >
                    Docs
                  </span>
                </div>

                <div
                  className="mt-0.5 pl-0.5 text-[0.42rem] italic leading-none text-[#7f8793]"
                  style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
                >
                  by Reliance EHS
                </div>

                <div className="mt-1.5 h-[2px] w-full bg-[#cb2d2d]" />

                <div className="mt-1 whitespace-nowrap text-[0.31rem] font-bold leading-none tracking-[0.03em] text-[#cb2d2d]">
                  ENVIRONMENT • HEALTH • SAFETY
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center text-[10px] font-bold uppercase leading-[1.05] tracking-[0.36em] text-[#6882a2]">
            <div>Safety Management</div>
            <div className="mt-1">Platform</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-[1.4rem] border border-[rgba(111,138,177,0.3)] bg-[linear-gradient(180deg,_rgba(255,255,255,0.99)_0%,_rgba(242,248,255,0.97)_100%)] shadow-[0_14px_30px_rgba(32,58,102,0.12)] ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--app-accent-surface-14),_transparent_42%),linear-gradient(135deg,_transparent_40%,_rgba(46,158,91,0.08)_100%)]" />
      <div className="absolute inset-x-5 bottom-0 h-px bg-[linear-gradient(90deg,_transparent,_var(--app-accent-border-24),_transparent)]" />
      <div className="relative flex h-full items-center justify-center px-3 py-2.5 sm:px-4">
        <Image
          src="/brand/safety360docs-reliance-lockup.svg"
          alt="Safety360Docs by Reliance EHS"
          fill
          priority
          sizes="(max-width: 768px) 220px, 320px"
          className={`object-contain p-2 ${imageClassName}`}
        />
      </div>
    </div>
  );
}
