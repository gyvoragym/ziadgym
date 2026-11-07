export const initials = (n: string) => n.split(" ").filter(Boolean).map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();

export type Status = "Active" | "Expiring" | "Expired";

export const gym = {
  name: "",
  code: "",
  tagline: "",
  description: "",
  location: "",
  hours: "",
  phone: "",
  whatsapp: "",
  instagram: "",
  facebook: "",
  facilities: [] as string[],
  services: [] as string[],
};

export const plans = [
  { id: "basic", name: "Basic", duration: "1 month", price: 800, features: ["Gym floor access", "Locker room", "1 assessment"] },
  { id: "premium", name: "Premium", duration: "3 months", price: 2100, features: ["All Basic features", "Group classes", "Sauna access", "2 PT sessions"], featured: true },
  { id: "vip", name: "VIP", duration: "12 months", price: 7200, features: ["All Premium features", "Unlimited PT check-ins", "Recovery lounge", "Guest passes ×6"] },
];

const names = ["Omar Khaled", "Layla Hassan", "Youssef Adel", "Mariam Fathy", "Karim Nabil", "Nour El-Din", "Salma Tarek", "Ahmed Samir", "Hana Mostafa", "Ziad Ehab", "Farida Amr", "Mostafa Reda"];
const statuses: Status[] = ["Active", "Active", "Expiring", "Active", "Expired", "Active", "Active", "Expiring", "Active", "Expired", "Active", "Active"];

export const members = names.map((name, i) => ({
  id: `M-${1040 + i}`,
  name,
  phone: `+20 10${(i * 7 + 13) % 10} ${String(4000000 + i * 13791).slice(0, 3)} ${String(1000 + i * 337).slice(0, 4)}`,
  email: name.toLowerCase().replace(/[^a-z]+/g, ".") + "@mail.com",
  plan: plans[i % 3]!.name,
  start: `2026-0${(i % 8) + 1}-0${(i % 9) + 1}`,
  expiry: statuses[i] === "Expired" ? "2026-09-2" + (i % 9) : statuses[i] === "Expiring" ? "2026-10-1" + (i % 9) : "2027-0" + ((i % 8) + 1) + "-15",
  status: statuses[i]!,
  remaining: statuses[i] === "Expired" ? 0 : statuses[i] === "Expiring" ? 4 + i : 60 + i * 9,
  initials: initials(name),
  type: (i % 4 === 1 ? "Limited" : "Unlimited") as "Unlimited" | "Limited",
  sessionsTotal: i % 4 === 1 ? 20 : 0,
  sessionsLeft: i % 4 === 1 ? 20 - i : 0,
  trainer: "",
  notes: "",
}));

export const trainers = [
  { id: "T1", image: "", name: "Coach Hossam", specialty: "Strength & Powerlifting", phone: "+20 101 220 3301", bio: "Former national-level powerlifter. 10 years coaching.", members: 24 },
  { id: "T2", name: "Coach Dina", specialty: "Mobility & Yoga", phone: "+20 101 220 3302", bio: "Certified RYT-500 focusing on mobility and recovery.", members: 18 },
  { id: "T3", name: "Coach Tamer", specialty: "CrossFit & HIIT", phone: "+20 101 220 3303", bio: "CF-L2 trainer, high-intensity conditioning specialist.", members: 31 },
  { id: "T4", name: "Coach Rana", specialty: "Boxing", phone: "+20 101 220 3304", bio: "Amateur boxing champion, technique-first approach.", members: 15 },
];

export const revenueSeries = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"].map((m, i) => ({
  month: m,
  revenue: 120000 + i * 9000 + (i % 3) * 7000,
  expenses: 70000 + (i % 4) * 6000 + i * 2000,
  members: 280 + i * 22,
}));

export const attendanceSeries = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => ({
  day: d,
  visits: [182, 205, 196, 221, 168, 240, 130][i],
}));

export const activity = [
  { user: "Reception · Sara", action: "Added new member Ziad Ehab", date: "2026-10-07", time: "21:12", kind: "member" },
  { user: "Admin · Mahmoud", action: "Renewed Premium plan for Layla Hassan", date: "2026-10-07", time: "20:48", kind: "renewal" },
  { user: "Reception · Sara", action: "Registered CrossFit session for Karim Nabil", date: "2026-10-07", time: "19:30", kind: "session" },
  { user: "Admin · Mahmoud", action: "Created expense: Maintenance — EGP 3,200", date: "2026-10-07", time: "17:05", kind: "expense" },
  { user: "Trainer · Hossam", action: "Updated workout plan “Strength Block A”", date: "2026-10-07", time: "15:40", kind: "workout" },
  { user: "Owner · Zeyad", action: "Changed role permissions for Reception", date: "2026-10-06", time: "11:22", kind: "settings" },
];

export const transactions = [
  { date: "2026-10-07", type: "Membership", category: "Premium renewal", amount: 2100, method: "Card" },
  { date: "2026-10-07", type: "Session", category: "CrossFit drop-in", amount: 150, method: "Cash" },
  { date: "2026-10-07", type: "Product", category: "Whey protein 2kg", amount: 1850, method: "Card" },
  { date: "2026-10-07", type: "Expense", category: "Maintenance", amount: -3200, method: "Bank" },
  { date: "2026-10-06", type: "Membership", category: "VIP new", amount: 7200, method: "Bank" },
  { date: "2026-10-06", type: "Expense", category: "Electricity", amount: -5400, method: "Bank" },
  { date: "2026-10-06", type: "Session", category: "PT session", amount: 400, method: "Wallet" },
  { date: "2026-10-05", type: "Product", category: "Shaker bottle", amount: 240, method: "Cash" },
];

export const expenseCategories = ["Equipment", "Electricity", "Water", "Rent", "Salaries", "Maintenance", "Marketing"];

export const recurring = [
  { name: "Club rent", amount: 45000, category: "Rent", frequency: "Monthly", start: "2025-01-01", next: "2026-11-01" },
  { name: "Electricity", amount: 5400, category: "Electricity", frequency: "Monthly", start: "2025-01-05", next: "2026-11-05" },
  { name: "Staff salaries", amount: 68000, category: "Salaries", frequency: "Monthly", start: "2025-01-28", next: "2026-10-28" },
  { name: "Fiber internet", amount: 900, category: "Internet", frequency: "Monthly", start: "2025-02-10", next: "2026-11-10" },
];

export const products = [
  { image: "", name: "Whey Protein 2kg", qty: 14, price: 1850, sales: 62, min: 10 },
  { name: "Creatine 300g", qty: 4, price: 650, sales: 41, min: 8 },
  { name: "Energy Drink", qty: 120, price: 45, sales: 380, min: 40 },
  { name: "IRONHAUS Shaker", qty: 22, price: 240, sales: 75, min: 10 },
  { name: "Lifting Straps", qty: 3, price: 320, sales: 19, min: 5 },
  { name: "Training Towel", qty: 48, price: 180, sales: 66, min: 15 },
];

export const workouts = [
  {
    name: "Strength Block A", trainer: "Coach Hossam", notes: "Keep RPE at 7–8. Rest 2–3 min between compound sets.",
    exercises: [
      { name: "Back Squat", sets: 5, reps: "5" },
      { name: "Bench Press", sets: 5, reps: "5" },
      { name: "Barbell Row", sets: 4, reps: "8" },
      { name: "Plank", sets: 3, reps: "60s" },
    ],
  },
  {
    name: "Metcon Express", trainer: "Coach Tamer", notes: "Scale loads to keep pace. Hydrate.",
    exercises: [
      { name: "Kettlebell Swings", sets: 4, reps: "20" },
      { name: "Box Jumps", sets: 4, reps: "12" },
      { name: "Burpees", sets: 4, reps: "15" },
    ],
  },
];

export const staff = [
  { name: "Zeyad Mansour", role: "Owner", email: "zeyad@ironhaus.gym" },
  { name: "Mahmoud Ali", role: "Admin", email: "mahmoud@ironhaus.gym" },
  { name: "Sara Ibrahim", role: "Reception", email: "sara@ironhaus.gym" },
  { name: "Hossam Gamal", role: "Trainer", email: "hossam@ironhaus.gym" },
];

export const egp = (n: number) => `EGP ${Math.abs(n).toLocaleString("en-US")}`;
