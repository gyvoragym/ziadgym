import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { ExerciseImage } from "./ProgramEditor";
import cover from "@/assets/gym-cover.jpg";
import type { ClientGym } from "@/lib/client-portal";
import type { ClientGymPage } from "./ClientGymWorkspace";
import type { ReactNode } from "react";
export function ClientGymCard({ gym, actions, page }: { gym: ClientGym; actions?: ReactNode; page?: ClientGymPage }) {
  return (
    <article className="overflow-hidden rounded-lg border bg-card">
      <Link to="/member/gym/$id" params={{ id: gym.id }} search={page ? {page} : {}} aria-label={`Open ${gym.name}`} className="block aspect-[3/1] overflow-hidden">
        {gym.image ? (
          <ExerciseImage path={gym.image} className="h-full w-full object-cover" />
        ) : (
          <img src={cover} alt={gym.name} className="h-full w-full object-cover" />
        )}
      </Link>
      <div className="space-y-3 p-4">
        <Link to="/member/gym/$id" params={{ id: gym.id }} search={page ? {page} : {}} className="text-lg font-semibold">
          {gym.name}
        </Link>
        <p className="flex gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" />
          {gym.location || "Location not provided"}
        </p>
        {actions}
      </div>
    </article>
  );
}
