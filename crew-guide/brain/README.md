# Why this folder sits outside `public/`

`vercel.json` sets `outputDirectory: public`, so **nothing in here is ever served**.

The caption brain contains unreleased product positioning, teaser rules, named
dinner guests and full brand strategy. The crew guide deploys public and
unauthenticated, so the prompt must never reach a browser from it.

`build-artifact.py` inlines this file into the **artifact** build only — that
copy is private to whoever it is shared with. The public build ships the page
with the brain placeholder still in it, and the page hides the tool when it
sees the placeholder rather than half-working.

If the tool is ever moved to the live site, the prompt belongs in a serverless
function under `api/`, read from an env var — never in client JavaScript.

## thumbcache/

`fetch-thumbs.py` pulls every example thumbnail from the shared Drive folder
into `thumbcache/` — covers at w400, carousel slides at w600. `build-artifact.py`
inlines them as data URIs so the **Artifact copy renders every example with no
external request at all**. Nothing is uploaded by hand: the ids come from the
folder listing and the bytes come from Drive.

The deployed site leaves `THUMBS` empty and fetches from Drive live, so it stays
a 72 KB page. Re-run `fetch-thumbs.py` after adding files to the folder; it is
cached, so existing ones cost nothing.
