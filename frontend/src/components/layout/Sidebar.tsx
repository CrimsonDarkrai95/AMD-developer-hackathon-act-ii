export function Sidebar() {
  return (
    <aside className="flex w-56 flex-col gap-2 border-r border-white/10 p-4">
      {/* TODO: navigation links (Dashboard, Patients, Reports, Settings) */}
      <span className="text-xs uppercase tracking-wide text-foreground/40">
        Navigation
      </span>
    </aside>
  );
}
