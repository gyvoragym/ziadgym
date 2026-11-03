import { consumeSession, type AttendanceEvent, type Member } from "./store";
import { generateId } from "./utils";
import { membershipStatus } from './membership-link';
export function recordClientVisit(
  rows: AttendanceEvent[],
  member: Member,
  method: "QR" | "Manual",
  now = new Date(),
): AttendanceEvent[] {
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (rows.some((r) => r.memberId === member.id && r.date === date))
    throw new Error("Already checked in today");
  return [
    {
      id: generateId(),
      name: member.name,
      memberId: member.id,
      date,
      time: now.toTimeString().slice(0, 5),
      method,
    },
    ...rows,
  ];
}

export function recordMemberCheckIn(
  attendance: AttendanceEvent[],
  members: Member[],
  memberId: string,
  method: "QR" | "Manual",
  today: string,
  now = new Date(),
) {
  const member = members.find(row => row.id === memberId);
  if (!member) throw new Error('Membership is no longer available.');
  const status = membershipStatus(member, today);
  if (status === 'Expired') throw new Error('Membership has expired. Renew it before recording attendance.');
  if (status === 'Upcoming') throw new Error('Membership has not started yet.');
  const nextAttendance = recordClientVisit(attendance, member, method, now);
  return {
    members: members.map(row => row.id === member.id ? consumeSession(member) : row),
    attendance: nextAttendance,
  };
}
