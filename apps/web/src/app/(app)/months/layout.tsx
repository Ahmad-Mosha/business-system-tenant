/** noon settlement figures are financial: privacy mode covers them (globals.css). */
export default function NoonLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-sensitive-scope className="contents">
      {children}
    </div>
  );
}
