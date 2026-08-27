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
