import { createFileRoute, Outlet } from "@tanstack/react-router";
import { GymShell } from "@/components/GymShell";

export const Route = createFileRoute("/_gym")({
  component: () => (
    <GymShell>
      <Outlet />
    </GymShell>
  ),
});
