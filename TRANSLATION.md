# TORA — translation standard

The single source of terminology and register for all 8 languages, across
`tora-app` (1642 keys) and `tora-application`.

**Read this before writing any user-facing string.** Two mistakes on 2026-08-16
came from not doing so: the app guide used ヴェニュー where the native reviewer
had chosen ベニュー, and Portuguese was written European while the website had
already been converted to Brazilian.

The authority for wording is **`tora-application/src/app/founding/_content/*.ts`**,
which had a native-reviewer pass in commit `c6413fb` (JP corrections applied
verbatim; ES/FR/IT full native passes; PT converted to Brazilian; CN/KR native
+ adversarial second opinion). When this file and that content disagree, that
content wins and this file is what's wrong.

---

## 1. Locales

| Code | Variant | Notes |
|---|---|---|
| `en` | International English | Source language. Not US-specific. |
| `ja` | Japanese | Primary market. |
| `ko` | Korean | |
| `zh` | Simplified Chinese | |
| `es` | Castilian Spanish | |
| `fr` | French | |
| `it` | Italian | |
| `pt` | **Brazilian** Portuguese | Not European. Brazil is the target market; one variant only, no separate pt-PT. |

---

## 2. Never translate

These stay in Latin script in every language:

- **TORA**
- **Tour Kickstart** (not "Tour Kickstarter" — that typo shipped once)
- **Premium**, **Yearly**, **Monthly** as plan names
- **@tora.verify**, **torahub.io**, **support@torahub.io**
- Role names in English UI chips where the design calls for them — but see §3,
  role names in *prose* are translated.

---

## 3. Core glossary

The four roles, in prose. Katakana in Japanese — the reviewer moved these off
kanji deliberately.

| EN | JA | KO | ZH | ES | FR | IT | PT-BR |
|---|---|---|---|---|---|---|---|
| Artist | アーティスト | 아티스트 | 艺人 | Artista | Artiste | Artista | Artista |
| Agent | エージェント | 에이전트 | 经纪人 | Agente | Agent | Agente | Agente |
| Promoter | プロモーター | 프로모터 | 主办方 | Promotor | Promoteur | Promoter | Promotor |
| **Venue** | **ヴェニュー** | 베뉴 | 场地 | Sala | Lieu | Venue | **Casa** |

> **Venue is the trap.** JA uses ヴェニュー for the *role* (changed from ベニュー on
> 2026-11-17 to match the reviewed press release), never 会場 — but 会場 is
> correct for a *physical* venue ("会場名" = venue name). PT-BR uses **casa** for
> the role, "local" for a physical space.

Product vocabulary:

| EN | JA | ZH | PT-BR | Notes |
|---|---|---|---|---|
| booking | ブッキング (never 予約) | 预订 | reserva / booking | IT: il booking (never prenotazione). ES: never the English "venue", use sala |
| offer | オファー | 报价 | proposta | |
| connection | コネクション | 人脉 | conexão | |
| tour | ツアー | 巡演 | turnê | |
| verification | 認証 | 验证 | verificação | |
| profile | プロフィール | 档案 | perfil | |
| roster | ロスター | 名单 | roster | |
| contract | 契約 | 合同 | contrato | |
| fee | ギャランティ | 演出费 | cachê | |

---

## 4. Register and style

**Japanese** — です/ます polite form throughout. Natural phrasing over literal
translation; the reviewer rewrote several literal renderings that were
grammatical but read as translated. Katakana for role names in prose.

**Portuguese (BR)** — *você*, never *tu*. Never European forms: turnê (not digressão), reserva (not marcação), equipe (not equipa), compartilhar, registro, gêneros, "com a gente" (not connosco); casas de shows for venues in prose. So: `seu/sua` not `teu/tua`;
`pode/quer/tem` not `podes/queres/tens`; imperatives in the *você* form
(`Selecione`, not `Seleciona`). Vocabulary: **usuário** (not utilizador),
**gerenciar** (not gerir), **arquivo** (not ficheiro), **compartilhar** (not
partilhar), **excluir** (not eliminar), **senha** (not palavra-passe),
**contato**, **assinatura**, **acessar**, **tela**, **celular**. Pronouns go
before the verb (`se conectar`), not attached after (`ligar-te`).

**Spanish** — Castilian, *tú* form. A native pass fixed a real meaning bug once
(an artist headline that said the artist does the hiring) — check that the
*direction* of a transaction survives translation.

**French** — *vous*, everywhere including notifications (25 tu-forms were fixed on 2026-11-17). Watch for phrasings that read as an insult echo; one was
caught in review ("Faites-vous voir").

**All languages** — one account can hold several profiles across roles. Do not
write "one account per role"; that error shipped in ES, FR and IT
simultaneously.

---

## 5. Rules that hold everywhere

1. **Never machine-translate a whole file in one pass without checking terms
   against §3.** Consistency of terminology matters more than elegance of any
   single sentence.
2. **`{{vars}}` must survive.** Same set, same spelling, in every locale.
   `scripts/check-translations.js` enforces this.
3. **Key parity is absolute.** Every locale has exactly the same keys. Missing
   keys silently fall back to English, which hides the gap.
4. **JavaScript `\b` does not match before accented characters.** `\bés\b`
   never fires. Use `(^|[^A-Za-zÀ-ÿ])` boundaries when scripting over
   Portuguese, Spanish, French or Italian.
5. **Escape apostrophes** in single-quoted values — `l'agence`, `You're`,
   `un'email`. This has broken the build three times.

---

## 6. Process

**New copy:** write EN first, then translate with §3 open. Run
`node scripts/check-translations.js`. Anything it flags is a real problem.

**Before launch:** brand-facing copy in JA and PT-BR gets a native review. A
glossary makes the reviewer's job style rather than terminology, which is much
cheaper — and their corrections come **back into this file** so the same
mistake cannot be made twice.

**When a reviewer corrects something:** update §3/§4 in the same commit as the
fix. That is the only thing that compounds.
