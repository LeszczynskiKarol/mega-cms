"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TipTapLink from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  ArrowLeft,
  Save,
  Eye,
  Loader2,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo,
  Redo,
} from "lucide-react";
import { slugify } from "@/lib/utils";
import { Page } from "@prisma/client";

type PageStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

interface PageEditorProps {
  tenant: { id: string; name: string; domain: string };
  page: Page | null;
  availableParents: { id: string; title: string; slug: string }[];
}

export function PageEditor({
  tenant,
  page,
  availableParents,
}: PageEditorProps) {
  const router = useRouter();
  const isNew = !page;

  const [title, setTitle] = useState(page?.title || "");
  const [slug, setSlug] = useState(page?.slug || "");
  const [description, setDescription] = useState(page?.description || "");
  const [status, setStatus] = useState<PageStatus>(
    (page?.status as PageStatus) || "DRAFT"
  );
  const [template, setTemplate] = useState(page?.template || "default");
  const [parentId, setParentId] = useState(page?.parentId || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // TipTap Editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      TipTapLink.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: "Zacznij pisać treść strony...",
      }),
    ],
    content: (page?.content as any)?.html || "",
    editorProps: {
      attributes: {
        class:
          "tiptap prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4",
      },
    },
  });

  // Auto-generuj slug z tytułu
  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (isNew || slug === slugify(title)) {
      setSlug(slugify(value));
    }
  };

  // Zapisz stronę
  const handleSave = async () => {
    if (!title.trim()) {
      setError("Tytuł jest wymagany");
      return;
    }

    if (!slug.trim()) {
      setError("Slug jest wymagany");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const content = {
        html: editor?.getHTML() || "",
        json: editor?.getJSON() || {},
      };

      const body = {
        tenantId: tenant.id,
        title,
        slug,
        description,
        content,
        status,
        template,
        parentId: parentId || null,
      };

      const url = isNew ? "/api/pages" : `/api/pages/${page.id}`;
      const method = isNew ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Błąd zapisu");
        return;
      }

      router.push(`/dashboard/tenants/${tenant.id}`);
      router.refresh();
    } catch {
      setError("Wystąpił błąd");
    } finally {
      setSaving(false);
    }
  };

  // Toolbar buttons
  const addLink = useCallback(() => {
    const url = window.prompt("URL:");
    if (url && editor) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const addImage = useCallback(() => {
    const url = window.prompt("URL obrazu:");
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/tenants/${tenant.id}`}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isNew ? "Nowa strona" : "Edytuj stronę"}
            </h1>
            <p className="text-sm text-gray-500">{tenant.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isNew && status === "PUBLISHED" && (
            <a
              href={`https://${tenant.domain}/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Eye className="h-4 w-4" />
              Podgląd
            </a>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Zapisywanie..." : "Zapisz"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        {/* Title & Slug */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tytuł *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Tytuł strony"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Slug (URL) *
            </label>
            <div className="flex items-center">
              <span className="text-gray-400 text-sm mr-1">/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="url-strony"
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Opis (meta description)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Krótki opis strony dla wyszukiwarek..."
          />
        </div>

        {/* Settings Row */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PageStatus)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="DRAFT">Szkic</option>
              <option value="PUBLISHED">Opublikowana</option>
              <option value="ARCHIVED">Zarchiwizowana</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template
            </label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="default">Domyślny</option>
              <option value="home">Strona główna</option>
              <option value="contact">Kontakt</option>
              <option value="landing">Landing Page</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Strona nadrzędna
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Brak (strona głównego poziomu)</option>
              {availableParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} (/{p.slug})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Editor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Treść
          </label>

          {/* Toolbar */}
          <div className="border border-gray-300 rounded-t-lg bg-gray-50 p-2 flex flex-wrap gap-1">
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleBold().run()}
              active={editor?.isActive("bold")}
              icon={Bold}
              title="Pogrubienie"
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              active={editor?.isActive("italic")}
              icon={Italic}
              title="Kursywa"
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleStrike().run()}
              active={editor?.isActive("strike")}
              icon={Strikethrough}
              title="Przekreślenie"
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleCode().run()}
              active={editor?.isActive("code")}
              icon={Code}
              title="Kod"
            />

            <div className="w-px h-6 bg-gray-300 mx-1" />

            <ToolbarButton
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 1 }).run()
              }
              active={editor?.isActive("heading", { level: 1 })}
              icon={Heading1}
              title="Nagłówek 1"
            />
            <ToolbarButton
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 2 }).run()
              }
              active={editor?.isActive("heading", { level: 2 })}
              icon={Heading2}
              title="Nagłówek 2"
            />
            <ToolbarButton
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 3 }).run()
              }
              active={editor?.isActive("heading", { level: 3 })}
              icon={Heading3}
              title="Nagłówek 3"
            />

            <div className="w-px h-6 bg-gray-300 mx-1" />

            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              active={editor?.isActive("bulletList")}
              icon={List}
              title="Lista"
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              active={editor?.isActive("orderedList")}
              icon={ListOrdered}
              title="Lista numerowana"
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              active={editor?.isActive("blockquote")}
              icon={Quote}
              title="Cytat"
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().setHorizontalRule().run()}
              icon={Minus}
              title="Linia pozioma"
            />

            <div className="w-px h-6 bg-gray-300 mx-1" />

            <ToolbarButton
              onClick={addLink}
              active={editor?.isActive("link")}
              icon={LinkIcon}
              title="Link"
            />
            <ToolbarButton onClick={addImage} icon={ImageIcon} title="Obraz" />

            <div className="flex-1" />

            <ToolbarButton
              onClick={() => editor?.chain().focus().undo().run()}
              disabled={!editor?.can().undo()}
              icon={Undo}
              title="Cofnij"
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().redo().run()}
              disabled={!editor?.can().redo()}
              icon={Redo}
              title="Ponów"
            />
          </div>

          {/* Editor Content */}
          <div className="border border-t-0 border-gray-300 rounded-b-lg">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  active?: boolean;
  disabled?: boolean;
}

function ToolbarButton({
  onClick,
  icon: Icon,
  title,
  active,
  disabled,
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded hover:bg-gray-200 transition-colors disabled:opacity-30 ${
        active ? "bg-gray-200 text-blue-600" : "text-gray-600"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
