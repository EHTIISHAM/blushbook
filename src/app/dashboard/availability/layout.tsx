import { AvailabilityTabs } from "./sub-tabs";

export default function AvailabilityLayout({
  children,
}: LayoutProps<"/dashboard/availability">) {
  return (
    <>
      <AvailabilityTabs />
      {children}
    </>
  );
}
