"use client";

import { ImageIcon, Loader2, Rocket, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface NewsData {
  id?: string;
  title: string;
  slug: string;
  description: string;
  content: {
    html: string;
    image: string;
  };
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string | null;
}

interface Props {
  tenantId: string;
  initialData?: NewsData;
}

export function NewsEditor({ tenantId, initialData }: Props) {
  const router = useRouter();
  const isEditing = !!initialData?.id;

  const [isLoading, setIsLoading] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    slug: initialData?.slug || "",
    excerpt: initialData?.description || "",
    image: initialData?.content?.image || "",
    html: initialData?.content?.html || "",
    status: initialData?.status || "DRAFT",
    publishedAt: initialData?.publishedAt
      ? new Date(initialData.publishedAt).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16),
  });

  // Auto-generate slug from title
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ł/g, "l")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 100);
  };

  const handleTitleChange = (title: string) => {
    setFormData((prev) => ({
      ...prev,
      title,
      slug: prev.slug || generateSlug(title),
    }));
  };

  // Zapisz bez deployu
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveNews(false);
  };

  // Zapisz i deployuj
  const handleSaveAndDeploy = async () => {
    await saveNews(true);
  };

  const saveNews = async (triggerDeploy: boolean) => {
    setIsLoading(true);
    setIsDeploying(triggerDeploy);
    setError("");
    setSuccess("");

    try {
      const endpoint = isEditing
        ? `/api/pages/${initialData?.id}`
        : "/api/pages";
      const method = isEditing ? "PUT" : "POST";

      // Jeśli deployujemy, upewnij się że status to PUBLISHED
      const status = triggerDeploy ? "PUBLISHED" : formData.status;

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          title: formData.title,
          slug: formData.slug,
          description: formData.excerpt,
          content: JSON.stringify({
            html: formData.html,
            image: formData.image,
          }),
          template: "news",
          status,
          publishedAt:
            status === "PUBLISHED"
              ? new Date(formData.publishedAt).toISOString()
              : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Błąd zapisywania");
      }

      // Jeśli ma być deploy, wywołaj go
      if (triggerDeploy) {
        setSuccess("Zapisano! Uruchamiam deploy...");
        
        const deployResponse = await fetch("/api/deploy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId }),
        });

        const deployData = await deployResponse.json();

        if (!deployResponse.ok) {
          throw new Error(deployData.error || "Błąd deployu");
        }

        setSuccess("✅ Zapisano i deploy uruchomiony! Strona będzie dostępna za ~2 minuty.");
        
        // Poczekaj chwilę żeby użytkownik zobaczył sukces
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      router.push(`/dashboard/tenants/${tenantId}/news`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wystąpił błąd");
    } finally {
      setIsLoading(false);
      setIsDeploying(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      {/* Main Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        {/* Title */}
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Tytuł aktualności *
          </label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
            placeholder="Np. Zwycięstwo w turnieju piłkarskim!"
            required
          />
        </div>

        {/* Slug */}
        <div>
          <label
            htmlFor="slug"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Adres URL (slug) *
          </label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">/aktualnosci/</span>
            <input
              type="text"
              id="slug"
              value={formData.slug}
              onChange={(e) =>
                setFormData({ ...formData, slug: e.target.value })
              }
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="zwyciestwo-w-turnieju"
              required
            />
          </div>
        </div>

        {/* Image URL */}
        <div>
          <label
            htmlFor="image"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Obrazek (URL)
          </label>
          <div className="flex gap-4">
            <input
              type="url"
              id="image"
              value={formData.image}
              onChange={(e) =>
                setFormData({ ...formData, image: e.target.value })
              }
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://example.com/image.jpg"
            />
            {formData.image && (
              <div className="w-24 h-16 rounded-lg overflow-hidden border border-gray-200">
                <img
                  src={formData.image}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
            {!formData.image && (
              <div className="w-24 h-16 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                <ImageIcon className="h-6 w-6" />
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Wklej link do obrazka (np. z Imgur, Cloudinary lub własnego serwera)
          </p>
        </div>

        {/* Excerpt */}
        <div>
          <label
            htmlFor="excerpt"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Krótki opis (excerpt)
          </label>
          <textarea
            id="excerpt"
            value={formData.excerpt}
            onChange={(e) =>
              setFormData({ ...formData, excerpt: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={2}
            placeholder="Krótki opis wyświetlany na liście aktualności..."
            maxLength={300}
          />
          <p className="text-xs text-gray-500 mt-1">
            {formData.excerpt.length}/300 znaków
          </p>
        </div>

        {/* Content */}
        <div>
          <label
            htmlFor="html"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Treść (HTML) *
          </label>
          <textarea
            id="html"
            value={formData.html}
            onChange={(e) => setFormData({ ...formData, html: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            rows={12}
            placeholder="<p>Treść aktualności...</p>"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Możesz używać znaczników HTML: &lt;p&gt;, &lt;h2&gt;, &lt;strong&gt;,
            &lt;em&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;a&gt;, &lt;img&gt;
          </p>
        </div>
      </div>

      {/* Sidebar Card - Status & Date */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Publikacja</h3>

        <div className="space-y-4">
          {/* Status */}
          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Status
            </label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as "DRAFT" | "PUBLISHED" | "ARCHIVED",
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="DRAFT">Szkic</option>
              <option value="PUBLISHED">Opublikowana</option>
              <option value="ARCHIVED">Zarchiwizowana</option>
            </select>
          </div>

          {/* Published At */}
          {formData.status === "PUBLISHED" && (
            <div>
              <label
                htmlFor="publishedAt"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Data publikacji
              </label>
              <input
                type="datetime-local"
                id="publishedAt"
                value={formData.publishedAt}
                onChange={(e) =>
                  setFormData({ ...formData, publishedAt: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">💡 Jak to działa?</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Zapisz szkic</strong> - zapisuje bez publikacji na stronie</li>
          <li>• <strong>Zapisz i opublikuj</strong> - zapisuje i uruchamia deploy strony (~2 min)</li>
          <li>• Po deploy strona będzie dostępna pod adresem: <code className="bg-blue-100 px-1 rounded">/aktualnosci/{formData.slug || 'slug'}</code></li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          disabled={isLoading}
        >
          Anuluj
        </button>
        
        {/* Zapisz jako szkic */}
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading && !isDeploying && <Loader2 className="h-4 w-4 animate-spin" />}
          <Save className="h-4 w-4" />
          Zapisz szkic
        </button>

        {/* Zapisz i publikuj */}
        <button
          type="button"
          onClick={handleSaveAndDeploy}
          disabled={isLoading}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isDeploying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="h-4 w-4" />
          )}
          {isDeploying ? "Publikowanie..." : "Zapisz i opublikuj"}
        </button>
      </div>
    </form>
  );
}
