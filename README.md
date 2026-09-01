# fiducia.ai

A web app that helps early-career professionals practise difficult workplace conversations using an AI role-play chatbot powered by IBM watsonx.

---

## Problem Statement

Early-career professionals frequently face high-stakes workplace conversations - discussing workload and burnout with a manager, raising mental health concerns, or resolving conflict with a colleague - but have little opportunity to practise these conversations in a safe environment before they happen for real. Lack of preparation leads to avoidance, escalation, or poor outcomes that affect both wellbeing and career progression. There is no low-stakes space to rehearse how to speak up, stay calm under pushback, or navigate a difficult interpersonal dynamic.

---

## Solution Description

fiducia.ai provides a structured role-play environment where users can rehearse three of the most common and difficult workplace conversations:

- **Workload / capacity** - practise pushing back on an overloaded schedule with a sceptical manager
- **Mental health / burnout** - practise opening up about how you are feeling to a line manager
- **Colleague conflict** - practise resolving a disagreement with a defensive colleague

Each session ends with a post-conversation reflection that gives the user honest feedback on how they handled the conversation, a concrete action plan of next steps, and a formal draft email they can send straight away. No login is required and no conversation data is stored - everything lives in `sessionStorage` for the duration of the session only. This is on purpose so that any conversations made by users with the chatbot stays completely confidential.

---

## AI Approach and Architecture

The application uses a two-stage AI pipeline, both powered by IBM watsonx:

**Stage 1 - Role-play conversation**

Each scenario is driven by a carefully engineered system prompt that gives the model a named persona (Alex, Jordan, or Sam), a specific emotional starting position (sceptical, empathetic, or defensive), and a progression arc that only unlocks when the user demonstrates real communication skill. The prompt includes an explicit output rule requiring the model to produce only the spoken reply - no meta-commentary, no variants, no self-annotation.

Conversation history is maintained client-side in `sessionStorage` and sent with every request so the model has full context. The server formats the history as a `Human` / `Assistant` transcript and appends `Assistant:` to steer generation. `stop_sequences` prevent roleplay bleed.

**Stage 2 - Reflection and feedback**

After the user ends the session, a second API call sends the full transcript to the model with a different system prompt that instructs it to act as a workplace communication coach. The model returns a single JSON object with three keys: a reflection paragraph, a numbered action plan, and a draft email message which the user can copy and send to a manager or colleague without stumbling over the words. The server extracts the first complete JSON object from the raw output to handle any model verbosity.

**Stack**

- `Node.js` + `Express` - server and API routing
- IBM watsonx (`meta-llama/llama-3-3-70b-instruct` by default) — LLM inference
- IBM IAM token exchange - API key swapped for short-lived Bearer tokens, cached server-side
- Plain HTML / CSS / vanilla JS - no build tools or frontend framework

---

## Selected Challenge Theme

**Wildcard** - fiducia.ai addresses workplace communication skills and psychological safety. It uses AI not just to automate a task but to create a safe space for humans to practise and improve, with the AI acting as a realistic but ultimately educational sparring partner. The production of a draft email ensures that users are not wasting time wondering what to send to seek a conversation and can instead spend this time on what really matters: completing their work.

---

## How IBM Bob Was Used

IBM Bob was used throughout the development of this project as an in-editor AI engineering assistant:

- **Initial planning** - Bob was used in Plan mode to refine the initial idea and make sure it fit the challenge statement.
- **Prompt engineering** - Bob was used to iteratively refine the system prompts for all three role-play personas, adding targeted instructions (such as the `CRITICAL OUTPUT RULE`) to prevent the model from breaking character or producing meta-commentary instead of in-character replies.
- **Bug fixing** - Bob diagnosed and resolved issues including roleplay bleed in model output, premature truncation of the reflection JSON caused by `stop_sequences` matching transcript content, and incomplete JSON objects returned by repeated model output.
- **Architecture decisions** - Bob advised on the two-stage pipeline design (separate chat and reflection endpoints), the `sessionStorage`-only data model, and the IAM token caching strategy.
- **Code generation and clarification** - Bob wrote and refined the watsonx API integration, the JSON extraction logic in `/api/reflect`, and the client-side chat loop using its Agent mode. In Ask mode, Bob was able to answer questions about what it was doing in each step and why this was necessary.
- **README and documentation** - this README was structured and written with Bob's assistance.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later (uses the built-in `fetch` API)
- An [IBM Cloud](https://cloud.ibm.com) account with:
  - A watsonx.ai project
  - An IBM Cloud API key with access to that project
  - The watsonx inference API enabled in your region

---

## Environment Variable Setup

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in your values:

   | Variable | Description |
   |---|---|
   | `WATSONX_API_KEY` | Your IBM Cloud API key |
   | `WATSONX_PROJECT_ID` | The watsonx.ai project ID (found in project settings) |
   | `WATSONX_URL` | Regional base URL, e.g. `https://eu-gb.ml.cloud.ibm.com` |
   | `WATSONX_MODEL_ID` | _(Optional)_ Defaults to `meta-llama/llama-3-3-70b-instruct` |
   | `PORT` | _(Optional)_ Defaults to `3000` |

   > **Never commit `.env` to source control.** The `.gitignore` already excludes it.

---

## How to Run Locally

```bash
# Install dependencies (first time only)
npm install

# Start the server
node server.js
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

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

## Mental Health Disclaimer

This app is **not** a substitute for professional mental health support. If you or someone you know is struggling, please contact one of the following organisations:

- **Mind** - [mind.org.uk](https://www.mind.org.uk)
- **Samaritans** - [samaritans.org](https://www.samaritans.org)
- **Shout** - [giveusashout.org](https://www.giveusashout.org)

The mental health scenario in this app is intended as a communication practice tool only.

---

## License

MIT
