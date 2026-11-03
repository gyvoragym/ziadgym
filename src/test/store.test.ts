import { describe, expect, it } from "vitest";
import { initialState } from "@/lib/store";

describe("new gym state", () => {
  it("starts without fixture records or sample gym details", () => {
    expect(initialState.members).toEqual([]);
    expect(initialState.products).toEqual([]);
    expect(initialState.trainers).toEqual([]);
    expect(initialState.plans).toEqual([]);
    expect(initialState.workouts).toEqual([]);
    expect(initialState.staff).toEqual([]);
    expect(initialState.sessions).toEqual([]);
    expect(initialState.attendance).toEqual([]);
    expect(initialState.recurring).toEqual([]);
    expect(initialState.transactions).toEqual([]);
    expect(initialState.gym).toMatchObject({
      name: "",
      code: "",
      phone: "",
      facilities: [],
      services: [],
    });
  });
});
