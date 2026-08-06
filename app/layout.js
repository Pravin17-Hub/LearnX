import "./globals.css";
import { autoBackupIfNeeded } from "@/lib/autobackup";
import LayoutShell from "@/components/LayoutShell";

export const metadata = {
  title: "LearnX - AI-Powered Learning Platform",
  description: "Next-generation classrooms, AI assignment evaluations, and instant quiz generators.",
};

export default function RootLayout({ children }) {
  // Asynchronously check and run backups in the background if interval exceeded
  autoBackupIfNeeded().catch((err) => {
    console.error("Auto backup check error in layout:", err.message);
  });

  return (
    <html lang="en">
      <body>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
