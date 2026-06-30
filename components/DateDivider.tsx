export function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-3">
      <span className="rounded-full bg-black/10 px-3 py-1 text-xs text-slate-700">{label}</span>
    </div>
  );
}
