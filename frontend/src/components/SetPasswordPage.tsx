import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { isValidNewPassword, setStoredWorkerPassword } from "../auth/credentials";
import { claimWorkerName, getWorkers } from "../data/workers";
import { BritestarLogo } from "./BritestarLogo";
import { Button } from "./ui/Button";
import { TextField } from "./ui/TextField";

export function SetPasswordPage() {
  const [searchParams] = useSearchParams();
  const username = searchParams.get("worker") ?? "";
  const worker = getWorkers().find((w) => w.username === username);
  const needsName = worker?.nameClaimed === false;

  const [fullName, setFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (needsName && !fullName.trim()) {
      setError("Enter your name so it shows up correctly on the schedule.");
      return;
    }

    const validationError = isValidNewPassword(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    if (needsName && worker) {
      claimWorkerName(worker.id, fullName, getWorkers());
    }
    setStoredWorkerPassword(username, newPassword);
    navigate(`/schedule?role=worker&worker=${username}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brite-black px-4">
      <div className="w-full max-w-sm rounded-2xl border border-brite-tan/15 bg-brite-black-soft/60 p-8 shadow-2xl">
        <div className="mb-6 flex justify-center">
          <BritestarLogo />
        </div>

        <h1 className="mb-1 text-center text-lg font-bold text-brite-white">
          {needsName || !worker ? "Welcome!" : `Welcome, ${worker.name.split(" ")[0]}`}
        </h1>
        <p className="mb-6 text-center text-sm text-brite-tan/60">
          {needsName
            ? "Set your name and a permanent password for your account."
            : "Set a permanent password for your account."}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {needsName && (
            <TextField
              id="full-name"
              label="Full name (as shown on the schedule)"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          )}
          <TextField
            id="new-password"
            label="New password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <TextField
            id="confirm-password"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {error && <p className="text-sm text-brite-red-bright">{error}</p>}

          <p className="text-xs text-brite-tan/50">
            Must be at least 8 characters, and different from the temporary password.
          </p>

          <Button type="submit" className="mt-2 w-full">
            Save &amp; continue
          </Button>
        </form>
      </div>
    </div>
  );
}
