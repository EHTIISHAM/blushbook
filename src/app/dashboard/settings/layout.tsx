import { SettingsBackLink } from "./back-link";

export default function SettingsLayout({
  children,
}: LayoutProps<"/dashboard/settings">) {
  return (
    <>
      <SettingsBackLink />
      {children}
    </>
  );
}
