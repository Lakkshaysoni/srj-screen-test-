export const metadata = {
  title: 'SRJ Screen Test',
  description: 'Internal screening tool for SRJ video testing',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
