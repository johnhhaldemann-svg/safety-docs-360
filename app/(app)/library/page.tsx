import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function appendParam(params: URLSearchParams, key: string, value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    for (const item of value) {
      params.append(key, item);
    }
    return;
  }

  if (typeof value === "string") {
    params.set(key, value);
  }
}

function buildDocumentsRedirect(searchParams: SearchParams = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    appendParam(params, key, value);
  }

  const tab = params.get("tab")?.trim().toLowerCase() ?? "";
  if (!tab || tab === "documents") {
    params.delete("tab");
  } else if (tab === "templates" || tab === "marketplace") {
    params.set("tab", tab);
  } else {
    params.delete("tab");
  }

  const query = params.toString();
  return query ? `/documents?${query}` : "/documents";
}

export default async function LegacyLibraryPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  redirect(buildDocumentsRedirect(await searchParams));
}
