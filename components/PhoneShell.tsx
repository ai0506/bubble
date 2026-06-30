export function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen w-full text-ink landscape:px-6">
      <section className="mx-auto flex h-[100dvh] w-full flex-col overflow-hidden bg-chat shadow-phone landscape:max-w-[600px]">
        {children}
      </section>
    </main>
  );
}
