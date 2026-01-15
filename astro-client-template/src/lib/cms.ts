// =============================================================================
// CMS Client - Pobieranie danych z MultiSite CMS
// =============================================================================

const CMS_URL = import.meta.env.CMS_URL || 'http://localhost:3000';
const API_KEY = import.meta.env.CMS_API_KEY || '';

interface CMSPage {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  content: {
    html: string;
    json?: any;
  };
  seo: any;
  template: string;
  publishedAt: string;
  updatedAt: string;
  parent?: {
    slug: string;
    title: string;
  };
  children?: {
    slug: string;
    title: string;
    order: number;
  }[];
}

interface CMSTenant {
  name: string;
  domain: string;
  settings: {
    logo?: string;
    primaryColor?: string;
    description?: string;
  };
}

interface CMSResponse {
  tenant: CMSTenant;
  pages: CMSPage | CMSPage[];
}

interface MenuItem {
  slug: string;
  title: string;
  order: number;
  children?: MenuItem[];
}

interface MenuResponse {
  menu: MenuItem[];
}

/**
 * Pobiera wszystkie opublikowane strony z CMS
 */
export async function getAllPages(): Promise<CMSPage[]> {
  const response = await fetch(`${CMS_URL}/api/public/pages`, {
    headers: {
      'x-api-key': API_KEY,
    },
  });

  if (!response.ok) {
    console.error('CMS API error:', response.status, await response.text());
    return [];
  }

  const data: CMSResponse = await response.json();
  return Array.isArray(data.pages) ? data.pages : [data.pages];
}

/**
 * Pobiera pojedynczą stronę po slug
 */
export async function getPageBySlug(slug: string): Promise<CMSPage | null> {
  const response = await fetch(`${CMS_URL}/api/public/pages?slug=${slug}`, {
    headers: {
      'x-api-key': API_KEY,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    console.error('CMS API error:', response.status, await response.text());
    return null;
  }

  const data: CMSResponse = await response.json();
  return data.pages as CMSPage;
}

/**
 * Pobiera dane tenanta (ustawienia strony)
 */
export async function getTenantSettings(): Promise<CMSTenant | null> {
  const response = await fetch(`${CMS_URL}/api/public/pages`, {
    headers: {
      'x-api-key': API_KEY,
    },
  });

  if (!response.ok) {
    return null;
  }

  const data: CMSResponse = await response.json();
  return data.tenant;
}

/**
 * Pobiera menu nawigacji
 */
export async function getMenu(): Promise<MenuItem[]> {
  const response = await fetch(`${CMS_URL}/api/public/menu`, {
    headers: {
      'x-api-key': API_KEY,
    },
  });

  if (!response.ok) {
    return [];
  }

  const data: MenuResponse = await response.json();
  return data.menu;
}

/**
 * Pobiera strony po template
 */
export async function getPagesByTemplate(template: string): Promise<CMSPage[]> {
  const response = await fetch(`${CMS_URL}/api/public/pages?template=${template}`, {
    headers: {
      'x-api-key': API_KEY,
    },
  });

  if (!response.ok) {
    return [];
  }

  const data: CMSResponse = await response.json();
  return Array.isArray(data.pages) ? data.pages : [data.pages];
}
