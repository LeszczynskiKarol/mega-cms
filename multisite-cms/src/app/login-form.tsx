"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Debug
    console.log("Submitting with:", {
      email,
      password: password ? "***" : "empty",
    });

    if (!email || !password) {
      setError("Wypełnij email i hasło");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const payload = { email, password };
      console.log("Sending payload:", { ...payload, password: "***" });

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log("Response:", data);

      if (!response.ok) {
        setError(data.error || "Błąd logowania");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Wystąpił błąd. Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => {
            console.log("Email changed:", e.target.value);
            setEmail(e.target.value);
          }}
          required
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          placeholder="twoj@email.pl"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Hasło
        </label>
        <input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => {
            console.log("Password changed");
            setPassword(e.target.value);
          }}
          required
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Logowanie..." : "Zaloguj się"}
      </button>

      {/* Debug info */}
      <div className="text-xs text-gray-400">
        Debug: email={email ? "filled" : "empty"}, password=
        {password ? "filled" : "empty"}
      </div>
    </form>
  );
}
