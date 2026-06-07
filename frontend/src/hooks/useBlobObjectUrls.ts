import { useEffect, useMemo, useState } from "react";
import { BlobStoreName, getBlob } from "../storage/indexedDb";

export function useBlobObjectUrls(storeName: BlobStoreName, ids: string[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const stableIds = useMemo(() => [...new Set(ids)].sort(), [ids.join("|")]);

  useEffect(() => {
    let alive = true;
    const nextUrls: Record<string, string> = {};
    const generatedUrls: string[] = [];

    Promise.all(stableIds.map(async (id) => {
      if (/^https?:\/\//.test(id) || id.startsWith("/")) {
        nextUrls[id] = id;
        return;
      }
      const blob = await getBlob(storeName, id);
      if (!blob || !alive) return;
      const objectUrl = URL.createObjectURL(blob);
      generatedUrls.push(objectUrl);
      nextUrls[id] = `${objectUrl}${id.startsWith("motion-") ? "#motion" : ""}`;
    })).then(() => {
      if (alive) setUrls(nextUrls);
    });

    return () => {
      alive = false;
      generatedUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [stableIds, storeName]);

  return urls;
}
