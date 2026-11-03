import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProgramEditor } from "@/components/ProgramEditor";
import type { Workout } from "@/lib/store";

vi.mock("@/lib/images", () => ({ uploadImage: vi.fn(), imageUrl: vi.fn(async () => "") }));
afterEach(cleanup);

describe("gym program notes", () => {
  it("saves notes with a new program", async () => {
    const save = vi.fn();
    render(<ProgramEditor open onClose={() => {}} onSave={save} trainers={[]} />);
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0] as HTMLElement, { target: { value: "Strength" } });
    fireEvent.change(inputs[2] as HTMLElement, { target: { value: "Squat" } });
    fireEvent.change(screen.getByLabelText("Trainer name"), { target: { value: "Coach Rana" } });
    fireEvent.change(screen.getByLabelText("Trainer Notes"), { target: { value: "Rest 90 seconds.\nKeep your back neutral." } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0]?.[0]).toMatchObject({ name: "Strength", trainer: "Coach Rana", notes: "Rest 90 seconds.\nKeep your back neutral.", exercises: [{ name: "Squat", sets: 3, reps: "10" }] });
  });

  it("loads and updates notes without changing other program fields", async () => {
    const program: Workout = { id: "p1", name: "Leg Day", trainer: "Coach Dina", notes: "Old notes", exercises: [{ name: "Squat", sets: 5, reps: "8", image: "" }] };
    const save = vi.fn();
    render(<ProgramEditor open onClose={() => {}} onSave={save} program={program} trainers={[]} />);
    expect(screen.getByLabelText("Trainer Notes")).toHaveValue("Old notes");
    fireEvent.change(screen.getByLabelText("Trainer Notes"), { target: { value: "Updated instructions" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ ...program, notes: "Updated instructions" }));
    expect(program.notes).toBe("Old notes");
  });
});