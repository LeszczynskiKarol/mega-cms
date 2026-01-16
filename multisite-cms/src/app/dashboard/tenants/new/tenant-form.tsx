"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Plus, X } from "lucide-react";
import { slugify } from "@/lib/utils";

export function TenantForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [domain, setDomain] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#3b82f6");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(value));
    }
  };

  const handleDomainChange = (value: string) => {
    setDomain(value.toLowerCase().replace(/[^a-z0-9.-]/g, ""));
  };

  const addDomain = () => {
    if (newDomain && !domains.includes(newDomain)) {
      setDomains([...domains, newDomain.toLowerCase()]);
      setNewDomain("");
    }
  };

  const removeDomain = (d: string) => {
    setDomains(domains.filter((x) => x !== d));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Nazwa jest wymagana");
      return;
    }

    if (!domain.trim()) {
      setError("Domena jest wymagana");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          domain,
          domains,
          githubRepo: githubRepo || null,
          settings: {
            primaryColor,
            description,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Błąd zapisu");
        return;
      }

      router.push(`/dashboard/tenants/${data.tenant.id}`);
      router.refresh();
    } catch {
      setError("Wystąpił błąd");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Nazwa i Slug */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nazwa klienta *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Firma XYZ"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Slug (identyfikator)
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="firma-xyz"
            />
          </div>
        </div>

        {/* Domena główna */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Domena główna *
          </label>
          <input
            type="text"
            value={domain}
            onChange={(e) => handleDomainChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="firma-xyz.pl"
          />
          <p className="text-xs text-gray-500 mt-1">
            Główna domena strony (bez www i https://)
          </p>
        </div>

        {/* GitHub Repository */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            GitHub Repository
          </label>
          <input
            type="text"
            value={githubRepo}
            onChange={(e) => setGithubRepo(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Owner/repo-name"
          />
          <p className="text-xs text-gray-500 mt-1">
            Format: WłaścicielGitHub/NazwaRepo (np.
            LeszczynskiKarol/uniatorun.pl) - wymagane do auto-deployu
          </p>
        </div>

        {/* Dodatkowe domeny */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dodatkowe domeny (aliasy)
          </label>

          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.preventDefault(), addDomain())
              }
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="www.firma-xyz.pl"
            />
            <button
              type="button"
              onClick={addDomain}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          {domains.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {domains.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                >
                  {d}
                  <button
                    type="button"
                    onClick={() => removeDomain(d)}
                    className="hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Ustawienia */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kolor główny
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Opis */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Opis strony
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Krótki opis strony dla wyszukiwarek..."
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Anuluj
        </Link>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Zapisywanie..." : "Utwórz klienta"}
        </button>
      </div>
    </form>
  );
}
