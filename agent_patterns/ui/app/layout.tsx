import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Agent Patterns UI',
  description: 'Streaming agent execution with SSE'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
