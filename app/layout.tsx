import './globals.css';

export const metadata = {
  title: 'NkeuyaTchat',
  description: 'Espace familial sécurisé',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#111b21', fontFamily: 'sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
