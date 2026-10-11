(() => {
const CONSENT_COOKIE = "xword-consent";
const COPY = {
  title: "訪問の計測",
  text: "このサイトは Google アナリティクスで訪問を測っています。同意するか、拒否するかを選べます。",
  deny: "拒否する",
  accept: "同意する",
  privacy: "プライバシーポリシー"
};

function writeConsent(value) {
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function ensureConsentStyle() {
  if (document.getElementById("xword-consent-style")) return;
  const style = document.createElement("style");
  style.id = "xword-consent-style";
  style.textContent = `
    .consent {
      position: fixed;
      z-index: 5;
      inset-inline: 0;
      bottom: 0;
      box-sizing: border-box;
      padding: 1.15rem 1.2rem 1.3rem;
      background: color-mix(in srgb, var(--paper, #f4ede0) 96%, transparent);
      border-top: 1px solid var(--rule, #b6a68b);
      color: var(--fg, #2e2721);
      text-align: center;
    }
    .consent[hidden] { display: none; }
    html.has-consent body { padding-bottom: 12rem; }
    .consent p {
      width: min(92vw, 36rem);
      margin: 0.3rem auto;
      line-height: 1.7;
      letter-spacing: 0.02em;
    }
    .consent-actions {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-top: 0.85rem;
    }
    .consent button {
      min-width: 8.5rem;
      margin: 0;
      padding: 0.45rem 1.1rem;
      border: 1px solid var(--accent, #8c6a32);
      border-radius: 999px;
      background: transparent;
      color: var(--fg, #2e2721);
      font: inherit;
      line-height: 1.5;
      letter-spacing: 0.06em;
      cursor: pointer;
    }
    .consent button:hover { background: var(--word, #e7d5ad); }
    .consent button:focus-visible {
      outline: 2px solid var(--accent, #8c6a32);
      outline-offset: 3px;
    }
    .consent a,
    .consent a:link,
    .consent a:visited,
    .consent a:hover,
    .consent a:active {
      color: var(--accent, #8c6a32);
      text-underline-offset: 0.18em;
    }
    .consent a:hover { color: var(--fg, #2e2721); }
  `;
  document.head.append(style);
}

function ensureBanner(copy) {
  let banner = document.querySelector(".consent");
  if (banner) return banner;
  banner = document.createElement("aside");
  banner.className = "consent";
  banner.hidden = true;
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-labelledby", "consent-title");
  banner.innerHTML = `
    <p id="consent-title"></p>
    <p class="consent-text"></p>
    <p class="consent-actions">
      <button type="button" data-consent="denied"></button>
      <button type="button" data-consent="granted"></button>
    </p>
    <p><a class="consent-privacy" href="privacy.html"></a></p>
  `;
  const footer = document.querySelector("footer.site");
  if (footer) footer.before(banner);
  else document.body.append(banner);
  banner.querySelector("#consent-title").textContent = copy.title;
  banner.querySelector(".consent-text").textContent = copy.text;
  banner.querySelector('[data-consent="denied"]').textContent = copy.deny;
  banner.querySelector('[data-consent="granted"]').textContent = copy.accept;
  banner.querySelector(".consent-privacy").textContent = copy.privacy;
  return banner;
}

ensureConsentStyle();

const consentState = window.xwordConsent;
const consentBanner = consentState && consentState.showBanner ? ensureBanner(COPY) : null;
if (consentBanner) {
  document.documentElement.classList.add("has-consent");
  consentBanner.hidden = false;
  consentBanner.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-consent]");
    if (!button) return;
    const granted = button.dataset.consent === "granted";
    writeConsent(granted ? "granted" : "denied");
    if (granted && window.xwordLoadAnalytics) window.xwordLoadAnalytics();
    consentBanner.hidden = true;
    document.documentElement.classList.remove("has-consent");
  });
}
})();
