import { SettingsRibbon } from "@/components/settings/SettingsRibbon";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SettingsRibbon />
      {children}
    </>
  );
}
