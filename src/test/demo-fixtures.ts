import { members, plans, trainers, workouts } from "@/lib/mock";
import { demoUserId, readDemoGym, resetPrototypeData, setDemoSession } from "@/lib/demo";
import { clearPrototypeStorage, prototypeStorage } from "@/lib/prototype-storage";
import { savePreviewSession } from "@/lib/preview-session";

export function resetDemoTestState() {
  savePreviewSession(null);
  sessionStorage.clear();
  localStorage.clear();
  clearPrototypeStorage();
  resetPrototypeData();
  setDemoSession(null);
}

export function seedDemoGymFixture() {
  const gymId = "demo-gym";
  const gym = readDemoGym(gymId);
  const state = {
    ...gym,
    gym: { ...gym.gym, name: "Fixture Gym" },
    members: members.map((member) => ({
      ...member,
      clientId: demoUserId(member.email),
    })),
    plans: structuredClone(plans),
    trainers: structuredClone(trainers),
    workouts: structuredClone(workouts),
    membershipEvents: [],
  };
  prototypeStorage().setItem(`ironhaus-demo-gym:${gymId}`, JSON.stringify(state));
  return readDemoGym(gymId, true);
}
