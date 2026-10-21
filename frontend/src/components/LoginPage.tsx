import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { checkManagerPassword, checkWorkerLogin } from "../auth/credentials";
import { BritestarLogo } from "./BritestarLogo";
import { Button } from "./ui/Button";
import { TextField } from "./ui/TextField";

type LoginRole = "worker" | "admin";

export function LoginPage() {
  const [role, setRole] = useState<LoginRole>("worker");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  function selectRole(nextRole: LoginRole) {
    setRole(nextRole);
    setError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (role === "admin") {
      if (checkManagerPassword(password)) {
        navigate("/schedule?role=admin");
      } else {
        setError("Incorrect manager password.");
      }
      return;
    }

    const result = checkWorkerLogin(username, password);
    switch (result) {
      case "ok":
        navigate(`/schedule?role=worker&worker=${username}`);
        break;
      case "needs-password-reset":
        navigate(`/set-password?worker=${username}`);
        break;
      case "unknown-username":
        setError("We don't recognize that username.");
        break;
      case "wrong-password":
        setError("Incorrect password.");
        break;
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brite-black px-4">
      <div className="w-full max-w-sm rounded-2xl border border-brite-tan/15 bg-brite-black-soft/60 p-8 shadow-2xl">
        <div className="mb-8 flex justify-center">
          <BritestarLogo />
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-brite-black p-1">
          <button
            type="button"
            onClick={() => selectRole("worker")}
            className={`rounded-md py-2 text-sm font-semibold transition-colors ${
              role === "worker"
                ? "bg-brite-red text-brite-white"
                : "text-brite-tan/60 hover:text-brite-tan"
            }`}
          >
            Worker
          </button>
          <button
            type="button"
            onClick={() => selectRole("admin")}
            className={`rounded-md py-2 text-sm font-semibold transition-colors ${
              role === "admin"
                ? "bg-brite-red text-brite-white"
                : "text-brite-tan/60 hover:text-brite-tan"
            }`}
          >
            Manager
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {role === "worker" && (
            <TextField
              id="username"
              label="Username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}

          <TextField
            id="password"
            label="Password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <label className="flex items-center gap-2 text-xs text-brite-tan/70">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={() => setShowPassword((current) => !current)}
            />
            Show password
          </label>

          {error && <p className="text-sm text-brite-red-bright">{error}</p>}

          {role === "worker" && (
            <p className="text-xs text-brite-tan/50">
              First time signing in? Use the temporary password your manager gave you —
              you'll be asked to set your own right after.
            </p>
          )}

          <Button type="submit" className="mt-2 w-full">
            {role === "admin" ? "Manager Sign In" : "Worker Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
}
