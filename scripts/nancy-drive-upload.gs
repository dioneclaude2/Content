/**
 * Nancy Socials: final-edit uploads to Dione's Google Drive.
 *
 * Runs as Dione (Deploy → Web app → Execute as: Me, Who has access: Anyone).
 * The planner sends the file in 8 MB pieces; this script passes each piece to
 * Google Drive's resumable upload, so the original file lands untouched
 * (full quality) in the "Nancy Socials – Final edits" folder of this Drive.
 */
const FOLDER_NAME = "Nancy Socials – Final edits";
const MAX_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB per file
const UPLOAD_PREFIX = "https://www.googleapis.com/upload/drive/v3/files";

function folder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("FOLDER_ID");
  if (id) {
    try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {}
  }
  const f = DriveApp.createFolder(FOLDER_NAME);
  props.setProperty("FOLDER_ID", f.getId());
  return f;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function header_(res, name) {
  const h = res.getHeaders();
  return h[name] || h[name.toLowerCase()] || "";
}

// After the last piece: share by link so the team can play and download it.
function finish_(file) {
  const f = DriveApp.getFileById(file.id);
  let shared = true;
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { shared = false; }
  return { done: true, id: f.getId(), name: f.getName(), size: f.getSize(), mime: f.getMimeType(), shared: shared };
}

// Where Drive is up to; 308 = still waiting for more bytes.
function answer_(res) {
  const code = res.getResponseCode();
  if (code === 200 || code === 201) return finish_(JSON.parse(res.getContentText()));
  if (code === 308) {
    const m = header_(res, "Range").match(/bytes=0-(\d+)/);
    return { next: m ? Number(m[1]) + 1 : 0 };
  }
  return { error: "drive " + code };
}

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    const token = ScriptApp.getOAuthToken();

    if (b.action === "start") {
      const size = Number(b.size), mime = String(b.mime || "");
      if (!(size > 0 && size <= MAX_BYTES)) return json_({ error: "size" });
      if (!/^(video|image)\//.test(mime)) return json_({ error: "type" });
      const res = UrlFetchApp.fetch(UPLOAD_PREFIX + "?uploadType=resumable&fields=id", {
        method: "post",
        contentType: "application/json; charset=UTF-8",
        headers: { Authorization: "Bearer " + token, "X-Upload-Content-Type": mime, "X-Upload-Content-Length": String(size) },
        payload: JSON.stringify({ name: String(b.name || "final edit").slice(0, 150), parents: [folder_().getId()], description: "Nancy Socials final edit" + (b.label ? " · " + String(b.label).slice(0, 200) : "") }),
        muteHttpExceptions: true,
      });
      const loc = header_(res, "Location");
      return json_(loc ? { upload: loc } : { error: "drive " + res.getResponseCode() });
    }

    const url = String(b.upload || "");
    if (url.indexOf(UPLOAD_PREFIX) !== 0) return json_({ error: "upload" });
    const total = Number(b.total);

    if (b.action === "chunk") {
      const bytes = Utilities.base64Decode(b.data);
      const start = Number(b.start), end = start + bytes.length - 1;
      const res = UrlFetchApp.fetch(url, {
        method: "put",
        contentType: "application/octet-stream",
        headers: { Authorization: "Bearer " + token, "Content-Range": "bytes " + start + "-" + end + "/" + total },
        payload: bytes,
        muteHttpExceptions: true,
        followRedirects: false,
      });
      return json_(answer_(res));
    }

    if (b.action === "status") {
      const res = UrlFetchApp.fetch(url, {
        method: "put",
        headers: { Authorization: "Bearer " + token, "Content-Range": "bytes */" + total },
        muteHttpExceptions: true,
        followRedirects: false,
      });
      return json_(answer_(res));
    }

    return json_({ error: "action" });
  } catch (err) {
    return json_({ error: String(err) });
  }
}

// Opening the web app link in a browser shows the folder, as a quick check.
function doGet() {
  return json_({ ok: true, folder: folder_().getUrl() });
}
