# fiducia.ai

A Node.js web app that helps early-career professionals practise difficult workplace conversations using an AI role-play chatbot powered by IBM watsonx. After each session, the app generates structured feedback, a concrete action plan, and a draft message you can take away.

---

## Features

- **Three role-play scenarios** — workload / capacity with your manager, mental health / burnout with your manager, and conflict resolution with a colleague
- **Realistic AI personas** — the model plays a manager or colleague with contextually appropriate behaviour (initially sceptical, then open to dialogue)
- **Post-conversation reflection** — after ending a session, a second AI call analyses your transcript and returns:
  - _Reflection_ — what you did well and what to improve
  - _Action Plan_ — 3–5 concrete next steps
  - _Draft Message_ — a ready-to-send email or message you can copy
- **Mental health safeguarding** — a persistent disclaimer on the landing page, a dismissible banner on the chat screen, and a resources panel on the reflection screen all link to professional support organisations
- **No login or data storage** — conversation history lives only in `sessionStorage` and is cleared when you navigate away
- **Plain HTML / CSS / vanilla JS** — no build tools required

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later (uses the built-in `fetch` API)
- An [IBM Cloud](https://cloud.ibm.com) account with:
  - A watsonx.ai project
  - An IBM Cloud API key with access to that project
  - The watsonx inference API enabled in your region

---

## Environment variable setup

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in your real values:

   | Variable | Description |
   |---|---|
   | `WATSONX_API_KEY` | Your IBM Cloud API key |
   | `WATSONX_PROJECT_ID` | The watsonx.ai project ID (found in project settings) |
   | `WATSONX_URL` | Regional base URL, e.g. `https://eu-gb.ml.cloud.ibm.com` |
   | `WATSONX_MODEL_ID` | _(Optional)_ Defaults to `meta-llama/llama-3-3-70b-instruct` |
   | `PORT` | _(Optional)_ Defaults to `3000` |

   > **Never commit `.env` to source control.** The `.gitignore` already excludes it.

3. The app exchanges your API key for a short-lived IAM Bearer token automatically. Tokens are cached server-side for up to ~1 hour.

---

## How to run locally

```bash
# Install dependencies (first time only)
npm install

# Start the server
node server.js
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project structure

```
/
├── server.js               Express server + watsonx API integration
├── package.json
├── .env.example            Environment variable template
├── .gitignore
├── README.md
└── public/
    ├── index.html          Landing page — scenario selector
    ├── chat.html           Chat / role-play screen
    ├── reflection.html     Post-conversation reflection output
    ├── css/
    │   └── styles.css      Global stylesheet
    └── js/
        └── chat.js         Chat screen logic
```

---

## API endpoints

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/chat` | `{ scenario, messages }` | `{ reply }` or `{ error }` |
| `POST` | `/api/reflect` | `{ scenario, messages }` | `{ reflection, actionPlan, draftMessage }` or `{ error }` |

---

## Mental health disclaimer

This app is **not** a substitute for professional mental health support. If you or someone you know is struggling, please contact one of the following organisations:

- **Mind** — [mind.org.uk](https://www.mind.org.uk)
- **Samaritans** — [samaritans.org](https://www.samaritans.org)
- **Shout** — [giveusashout.org](https://www.giveusashout.org)

The mental health scenario in this app is intended as a communication practice tool only.

---

## License

MIT
