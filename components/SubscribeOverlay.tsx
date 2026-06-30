import { LockKeyhole } from "lucide-react";

const TITLE = "\u8ba2\u9605\u540e\u67e5\u770b\u5b8c\u6574\u804a\u5929";
const ORIGINAL_PRICE = "199\u5143/\u5e74";
const OFFER_PRICE = "\u9650\u65f6\u4f18\u60e0 0\u5143/\u5e74";
const BUTTON_LABEL = "\u7acb\u5373\u8ba2\u9605";

type SubscribeOverlayProps = {
  onSubscribe: () => void;
};

export function SubscribeOverlay({ onSubscribe }: SubscribeOverlayProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/35 px-6 backdrop-blur-[2px]">
      <div className="w-full rounded-2xl border border-white/80 bg-white p-5 text-center shadow-xl">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <LockKeyhole size={22} />
        </div>
        <h2 className="text-lg font-semibold">{TITLE}</h2>
        <p className="mt-2 text-sm text-slate-600">
          <span className="mr-2 text-slate-400 line-through">{ORIGINAL_PRICE}</span>
          <span className="font-semibold text-rose-600">{OFFER_PRICE}</span>
        </p>
        <button
          type="button"
          onClick={onSubscribe}
          className="mt-5 h-11 w-full rounded-full bg-ink text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          {BUTTON_LABEL}
        </button>
      </div>
    </div>
  );
}
