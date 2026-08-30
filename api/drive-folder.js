/* Lists a public Drive folder so a carousel can be built from a link alone.
 *
 * Why scrape rather than call the Drive API: the folder page renders a real
 * HTML table -- one <tr> per child carrying the id in data-id -- so this needs
 * no API key, no OAuth, nothing to rotate or leak. Same approach as
 * scripts/drivefolder.py, which has held up; this is its serverless twin so
 * the browser can do it live instead of at sync time.
 *
 * Folder vs file is semantic, not cosmetic: a folder reports no size, so Drive
 * writes "Size not available" where a file writes "Size: 3.2 MB". The icon
 * class names are obfuscated and churn, so they are not used.
 *
 * Nothing is stored. Bytes are never proxied here -- that is drive-video.js.
 */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const IMAGE = /\.(jpe?g|png|gif|webp|avif|heic|heif|tiff?|bmp)$/i;
const VIDEO = /\.(mp4|mov|m4v|webm|avi|mkv|mpe?g|3gp)$/i;

function parse(page) {
  const items = [];
  const re = /<tr [^>]*data-id="([^"]+)"[^>]*aria-rowindex="(\d+)"[^>]*>/g;
  let m;
  while ((m = re.exec(page))) {
    const id = m[1];
    const end = page.indexOf("</tr>", re.lastIndex);
    const body = page.slice(re.lastIndex, end === -1 ? undefined : end);
    const isFile = body.includes("Size: ");

    let name = body
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .trim()
      .replace(/^(Video|Image|Audio|PDF|File)\s+/, "")
      .replace(/\s+(Shared|Owned by me|Download).*$/, "")
      .trim();

    const kind = IMAGE.test(name) ? "image" : VIDEO.test(name) ? "video" : null;
    if (isFile && kind) items.push({ id, name, kind });
  }
  return items;
}

export default async function handler(req, res) {
  const id = req.query.id;
  if (!id || !/^[\w-]{10,}$/.test(id)) {
    res.status(400).json({ error: "missing or invalid folder id" });
    return;
  }

  let page;
  try {
    const r = await fetch(`https://drive.google.com/drive/folders/${id}?hl=en`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      redirect: "follow",
    });
    if (r.status === 403 || r.status === 404) {
      res.status(404).json({ error: "not-shared" });
      return;
    }
    if (!r.ok) {
      res.status(502).json({ error: `drive returned ${r.status}` });
      return;
    }
    page = await r.text();
  } catch (e) {
    res.status(502).json({ error: "could not reach drive" });
    return;
  }

  const files = parse(page);
  /* Ascending by file name, numeric-aware, so IMG_2 lands before IMG_10. */
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

  /* Folder contents change rarely; a short shared cache keeps repeat reviews
     off Drive's rate limit without making a rename take a day to show up. */
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  res.status(200).json({ folder: id, count: files.length, files });
}
