'use strict';

require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Scenario system prompts
// ---------------------------------------------------------------------------
const SYSTEM_PROMPTS = {
  workload: `You are Alex, a busy but fair line manager. The user (your direct report) wants to discuss their workload and feeling overloaded.

Your behaviour:
- Start sceptical and unconvinced — you are stretched yourself and your initial instinct is that the team needs to push through. Hold this position firmly for several exchanges.
- Push back with probing questions: ask exactly which tasks are taking too long and why, challenge whether the user has tried reprioritising independently, and question whether the issue is time management rather than genuine overload.
- Do not soften until the user has made specific, well-reasoned points with concrete examples. Vague complaints should prompt you to ask follow-up questions rather than offer sympathy.
- When you do begin to shift, frame it as being persuaded by the evidence, not by the user's feelings alone. Ask the user what solutions they have already considered before offering any of your own.
- Guide the user to think for themselves: use questions like "What do you think could be dropped or delayed?", "Have you spoken to anyone else about this?" and "What would you suggest as a first step?" rather than handing them answers.
- Only reach a collaborative, solution-focused stance after the user has demonstrated they have thought the problem through.
- Be professional and respectful throughout. Never be dismissive or aggressive.
- Keep your replies concise — 2 to 4 sentences. You are a manager in a brief check-in, not writing an essay.
- IMPORTANT: Never break character. Never refer to yourself by name, never say you are an AI, and never add notes, reminders, or meta-commentary outside your spoken reply (e.g. do not write "Note: as Alex…" or "Remember, you are…").`,

  mentalhealth: `You are Jordan, a line manager who genuinely cares about their team's wellbeing. The user (your direct report) wants to talk to you about how they are feeling at work — they may be experiencing stress, burnout, anxiety, or other mental health difficulties.

Your behaviour:
- Be warm and empathetic, but do not immediately offer solutions or reassurance. Your first instinct is to understand, not to fix.
- Ask open, probing questions to draw the user out: "Can you tell me more about what's been making things hard?", "How long have you been feeling this way?", "What does a difficult day actually look like for you?" Let the user do most of the talking.
- Do not rush to comfort or move on. Hold space for the user to explain fully before reflecting anything back. If they give a vague answer, gently ask them to say more.
- Never be dismissive, minimise their experience, or suggest they simply "try harder" or "think positively".
- Do not reference any specific company policies, programmes, or support structures (such as EAP, occupational health, or HR processes). Respond generically — only reflect back what the user has explicitly told you, and let them share their own context.
- Only when the user has shared enough context, gently ask what they think might help them — for example, "What do you think would make the biggest difference right now?" — before suggesting anything yourself.
- When a suggestion does feel right, offer it in general terms only (for example, "taking some time away" or "speaking to someone you trust") without naming specific schemes or departments.
- Remind the user they do not have to manage this alone, but wait until they have had a chance to express themselves first.
- Keep your replies warm but concise — 2 to 4 sentences per turn.
- IMPORTANT: Never break character. Never refer to yourself by name, never say you are an AI, and never add notes, reminders, or meta-commentary outside your spoken reply (e.g. do not write "Note: as Jordan…" or "Remember, you are…").`,

  conflict: `You are Sam, a colleague the user has had a disagreement or conflict with. The user wants to resolve the situation.

Your behaviour:
- Start clearly defensive and unwilling to move on — you still feel wronged or misunderstood and you want the user to understand your perspective before any resolution is possible. Hold this position for several exchanges.
- Do not be aggressive or hostile, but be direct and firm: push back if the user is vague, glosses over their own role, or jumps straight to asking you to move on without acknowledgement.
- Ask pointed questions that prompt the user to reflect on their own behaviour: "What do you think your part in this was?", "Why do you think this happened in the first place?", "What would you do differently next time?" Do not let them off the hook with generalities.
- Only begin to soften once the user has genuinely acknowledged their role in the conflict and made a specific, concrete gesture towards resolution — not just a vague apology.
- Acknowledge your own part in the conflict when it is reasonable to do so, but only after the user has shown they understand theirs.
- Work towards a constructive resolution — agreeing to communicate better, clarifying misunderstandings, or agreeing next steps — but let the user propose the steps first.
- Keep your replies realistic and concise — 2 to 4 sentences. You are a colleague, not a counsellor.
- IMPORTANT: Never break character. Never refer to yourself by name, never say you are an AI, and never add notes, reminders, or meta-commentary outside your spoken reply (e.g. do not write "Note: as Sam…" or "Remember, you are…").`
};

// ---------------------------------------------------------------------------
// IBM IAM token exchange
// Exchanges the API key for a short-lived Bearer token required by watsonx.
// Tokens are valid for ~1 hour; we cache and reuse until near-expiry.
// ---------------------------------------------------------------------------
let _iamTokenCache = null; // { token: string, expiresAt: number }

async function getIAMToken() {
  const now = Date.now();

  // Return cached token if it has more than 60 s of life remaining
  if (_iamTokenCache && _iamTokenCache.expiresAt - now > 60_000) {
    return _iamTokenCache.token;
  }

  const apiKey = process.env.WATSONX_API_KEY;
  if (!apiKey) throw new Error('WATSONX_API_KEY is not set in the environment.');

  const res = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: apiKey
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`IAM token exchange failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  // IBM IAM tokens expire_in is in seconds; store as absolute ms timestamp
  _iamTokenCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000
  };

  return _iamTokenCache.token;
}

// ---------------------------------------------------------------------------
// watsonx text generation
// ---------------------------------------------------------------------------
async function callWatsonx(systemPrompt, messages, maxTokens) {
  const watsonxUrl = process.env.WATSONX_URL;
  const projectId  = process.env.WATSONX_PROJECT_ID;

  if (!watsonxUrl) throw new Error('WATSONX_URL is not set in the environment.');
  if (!projectId)  throw new Error('WATSONX_PROJECT_ID is not set in the environment.');

  // Format the conversation history into a single prompt string.
  // We use a simple Human / Assistant transcript format that works well with
  // instruction-tuned models on watsonx (e.g. ibm/granite-13b-chat-v2).
  let conversationText = '';
  for (const msg of messages) {
    if (msg.role === 'user') {
      conversationText += `Human: ${msg.content}\n`;
    } else if (msg.role === 'assistant') {
      conversationText += `Assistant: ${msg.content}\n`;
    }
  }
  // Prompt the model to continue as the assistant
  conversationText += 'Assistant:';

  const input = `${systemPrompt}\n\n${conversationText}`;

  const token = await getIAMToken();

  const endpoint = `${watsonxUrl.replace(/\/$/, '')}/ml/v1/text/generation?version=2023-05-29`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      model_id: process.env.WATSONX_MODEL_ID || 'meta-llama/llama-3-3-70b-instruct',
      project_id: projectId,
      input,
      parameters: {
        decoding_method: 'greedy',
        max_new_tokens: maxTokens || 300,
        repetition_penalty: 1.1,
        stop_sequences: ['\nHuman:', '\nAssistant:', 'Human:']
      }
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`watsonx API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  const raw = data?.results?.[0]?.generated_text?.trim();

  if (!raw) throw new Error('watsonx returned an empty response.');

  // Strip any trailing roleplay bleed — the model sometimes appends a new
  // "Human:" cue or a prompt like "Please respond as the human." even when
  // stop_sequences should have caught it (e.g. no leading newline variant).
  const reply = raw.replace(/\n?Human:[\s\S]*$/i, '').trim();

  if (!reply) throw new Error('watsonx returned an empty response after cleanup.');

  return reply;
}

// ---------------------------------------------------------------------------
// Reflection prompt builder
// Returns a system prompt instructing watsonx to analyse the transcript and
// output a JSON object with three keys: reflection, actionPlan, draftMessage
// ---------------------------------------------------------------------------
function buildReflectionPrompt(scenario) {
  const draftGuidance = {
    workload:
      'a formal email from the user to their manager requesting a meeting to discuss a specific concern from the action plan. ' +
      "Open with \"Dear [Manager's name],\" and close with \"Kind regards,\" followed by the user's name. " +
      'The body must name ONE concrete topic from the action plan as the reason for meeting — not a vague request to "discuss things". ' +
      'The email must be professional and formal throughout — no contractions, no casual language.',
    mentalhealth:
      'a formal email from the user to their manager requesting a private meeting. ' +
      "Open with \"Dear [Manager's name],\" and close with \"Kind regards,\" followed by the user's name. " +
      'The body must state ONE clear reason for the meeting drawn from the action plan — keep it calm and general, without disclosing personal details. ' +
      'The tone must be professional and low-pressure.',
    conflict:
      'a formal email from the user to their colleague requesting a time to speak. ' +
      "Open with \"Dear [Colleague's name],\" and close with \"Kind regards,\" followed by the user's name. " +
      'The body must state ONE clear, constructive reason for the conversation drawn from the action plan — not a vague request to "catch up". ' +
      'The tone must be professional and non-confrontational.'
  };
  const draft = draftGuidance[scenario] || 'a formal email requesting a meeting, opening with "Dear [Name]," and closing with "Kind regards,". Name one concrete topic from the action plan as the reason.';

  return `You are an expert workplace communication coach. You will receive a role-play conversation transcript between a user (labelled Human) and an AI persona (labelled Assistant).

Your task is to analyse the transcript and produce three outputs. You MUST respond with ONLY a valid JSON object — no markdown, no code fences, no explanation outside the JSON. The JSON must have exactly these three keys:

"reflection": A paragraph (100–150 words) giving honest, constructive feedback on how the user handled the conversation. Highlight 2–3 things they did well and 1–2 areas to improve. Write in second person ("You did well to…").

"actionPlan": A numbered list of 3–5 concrete, actionable next steps the user should take after this conversation, each on its own line. Format as: "1. …\\n2. …" etc.

"draftMessage": Write ${draft} The email must be 60–90 words including greeting and sign-off. Put the subject line on the first line (e.g. "Subject: …"). Output only the email — no preamble, no commentary after it.

Return only the JSON object. Example shape (values are placeholders):
{"reflection":"...","actionPlan":"1. ...\\n2. ...\\n3. ...","draftMessage":"Subject: ...\\n\\nDear [Name],\\n\\n...\\n\\nKind regards,\\n[Name]"}`;
}

// ---------------------------------------------------------------------------
// POST /api/reflect
// Body: { scenario: string, messages: Array<{ role, content }> }
// Response: { reflection, actionPlan, draftMessage } | { error: string }
//
// NOTE: Does NOT use callWatsonx() because the transcript itself contains
// "Human:" / "Assistant:" lines that would trigger callWatsonx's stop_sequences,
// cutting off generation before any JSON is produced.
// We call the watsonx API directly with no stop_sequences.
// ---------------------------------------------------------------------------
app.post('/api/reflect', async (req, res) => {
  const { scenario, messages } = req.body;

  if (!scenario || !SYSTEM_PROMPTS[scenario]) {
    return res.status(400).json({ error: 'Invalid or missing scenario.' });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'No messages provided.' });
  }

  // Build a plain transcript string
  let transcript = '';
  for (const msg of messages) {
    if (msg.role === 'user') {
      transcript += `Human: ${msg.content}\n`;
    } else if (msg.role === 'assistant') {
      transcript += `Assistant: ${msg.content}\n`;
    }
  }

  // Assemble the full prompt as a single block — no chat-turn wrapper.
  const systemPrompt = buildReflectionPrompt(scenario);
  const input = `${systemPrompt}\n\nTranscript:\n${transcript}\n\nJSON output:`;

  try {
    const watsonxUrl = process.env.WATSONX_URL;
    const projectId  = process.env.WATSONX_PROJECT_ID;

    if (!watsonxUrl) throw new Error('WATSONX_URL is not set in the environment.');
    if (!projectId)  throw new Error('WATSONX_PROJECT_ID is not set in the environment.');

    const token    = await getIAMToken();
    const endpoint = `${watsonxUrl.replace(/\/$/, '')}/ml/v1/text/generation?version=2023-05-29`;

    const apiRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        model_id: process.env.WATSONX_MODEL_ID || 'meta-llama/llama-3-3-70b-instruct',
        project_id: projectId,
        input,
        parameters: {
          decoding_method: 'greedy',
          max_new_tokens: 1200,
          repetition_penalty: 1.1
          // No stop_sequences — the transcript contains "Human:" / "Assistant:"
          // which would cause premature truncation.
        }
      })
    });

    if (!apiRes.ok) {
      const body = await apiRes.text();
      throw new Error(`watsonx API error (${apiRes.status}): ${body}`);
    }

    const data = await apiRes.json();
    const raw  = data?.results?.[0]?.generated_text?.trim();

    if (!raw) throw new Error('watsonx returned an empty response.');

    // The model sometimes repeats the JSON object multiple times (with and without
    // markdown fences). Extract only the FIRST complete JSON object by tracking
    // brace depth from the first '{' — this avoids picking up a truncated repeat.
    const start = raw.indexOf('{');
    if (start === -1) {
      console.error('[/api/reflect] Raw response was:', raw);
      throw new Error('Model did not return a JSON object.');
    }

    let depth = 0;
    let end   = -1;
    let inString = false;
    let escape   = false;
    for (let i = start; i < raw.length; i++) {
      const ch = raw[i];
      if (escape)          { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"')      { inString = !inString; continue; }
      if (inString)        { continue; }
      if (ch === '{')      { depth++; }
      else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
    }

    if (end === -1) {
      console.error('[/api/reflect] Raw response was:', raw);
      throw new Error('Model did not return a complete JSON object.');
    }

    let parsed;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch (parseErr) {
      console.error('[/api/reflect] JSON parse failed. Raw response was:', raw);
      throw new Error(`JSON parse error: ${parseErr.message}`);
    }

    if (!parsed.reflection || !parsed.actionPlan || !parsed.draftMessage) {
      throw new Error('Model response is missing required keys.');
    }

    return res.json({
      reflection:   parsed.reflection,
      actionPlan:   parsed.actionPlan,
      draftMessage: parsed.draftMessage
    });
  } catch (err) {
    console.error('[/api/reflect]', err.message);
    return res.status(502).json({
      error: 'Could not generate the reflection right now. Please try again.'
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/chat
// Body: { scenario: string, messages: Array<{ role, content }> }
// Response: { reply: string } | { error: string }
// ---------------------------------------------------------------------------
app.post('/api/chat', async (req, res) => {
  const { scenario, messages } = req.body;

  if (!scenario || !SYSTEM_PROMPTS[scenario]) {
    return res.status(400).json({ error: 'Invalid or missing scenario.' });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'No messages provided.' });
  }

  try {
    const reply = await callWatsonx(SYSTEM_PROMPTS[scenario], messages);
    return res.json({ reply });
  } catch (err) {
    console.error('[/api/chat]', err.message);
    return res.status(502).json({
      error: 'The AI is unavailable right now. Please try again in a moment.'
    });
  }
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Conversation Coach running at http://localhost:${PORT}`);
});
