export const metadata = {
  title: "MicroPay — Interoperability Layer for x402",
  description: "Cross-chain micropayments so agents and users can pay with any token, on any chain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
