import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sudokuell',
  description: 'Private Sudoku races with friends.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
