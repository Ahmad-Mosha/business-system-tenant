/** Amazon's figures are financial: privacy mode covers them (globals.css). */
export default function AmazonLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-sensitive-scope className="contents">
      {children}
    </div>
  );
}
