/** Every figure on the money screens is financial: privacy mode covers them all (globals.css). */
export default function MoneyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-sensitive-scope className="contents">
      {children}
    </div>
  );
}
