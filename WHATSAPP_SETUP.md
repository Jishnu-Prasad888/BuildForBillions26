# WhatsApp Bot Setup

Citizens can talk to Sahayak on WhatsApp as well as on the web app and Telegram. All three use the same KAG pipeline (`agent.answer`), so a WhatsApp answer has the same grounding, sources and languages (English, Hindi, Kannada) as the web assistant.

The bot uses Meta's **WhatsApp Cloud API**. Unlike Telegram (polling), WhatsApp **pushes** messages to a webhook, so the backend must be reachable over public HTTPS.

## How it works

```
User on WhatsApp ──► Meta Cloud API ──► POST /api/webhooks/whatsapp  (returns 200 at once)
                                              │ background task
                                              ▼
                              whatsapp_handlers.dispatch_payload
                                              │
                              conversation.process_message  (shared with Telegram)
                                              │
                                     agent.answer(channel="whatsapp")
                                              │
User on WhatsApp ◄── Graph API /messages ◄── WhatsAppClient (text, reply buttons, lists)
```

| File | Role |
|---|---|
| `backend/app/api/whatsapp.py` | Webhook: `GET` verify handshake, `POST` incoming messages, signature check |
| `backend/app/bot/whatsapp_handlers.py` | Commands, button and list replies, answering |
| `backend/app/bot/whatsapp_client.py` | Graph API client: text, reply buttons, list messages, read receipts |
| `backend/app/bot/conversation.py` | Users, conversations and KAG turns shared by Telegram and WhatsApp |
| `backend/app/bot/copy.py` | Multilingual bot text |
| `backend/app/bot/formatter.py` | `kag_to_whatsapp`, scheme cards and source lists in WhatsApp formatting |

Each WhatsApp number becomes a `User` row (`whatsapp_id` = phone number, email `wa_<phone>@whatsapp.local`), and its chats are stored as conversations with `kind = "whatsapp"`.

## 1. Create the Meta app

1. Go to <https://developers.facebook.com/apps> and choose **Create app** > **Business** (or "Other" > "Business").
2. Add the **WhatsApp** product and pick or create a Business portfolio.
3. Open **WhatsApp > API Setup**. Meta gives you a free **test phone number**. Copy:
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - **Temporary access token** (valid for 24 h) → `WHATSAPP_TOKEN`
4. Under **To**, add your own WhatsApp number as a recipient and confirm the code. Test numbers can only message up to 5 verified recipients.
5. **App settings > Basic** → copy the **App secret** → `WHATSAPP_APP_SECRET`.

For a token that does not expire, create a **System user** in Business Settings, give it the app and the WhatsApp account with `whatsapp_business_messaging` and `whatsapp_business_management` permissions, and generate a permanent token.

## 2. Configure the backend

In `backend/.env`:

```env
WHATSAPP_TOKEN=EAAG...
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_VERIFY_TOKEN=pick-any-random-string
WHATSAPP_APP_SECRET=0123456789abcdef...
WHATSAPP_GRAPH_VERSION=v21.0
```

Restart the backend. With the token or phone number ID empty, the webhook still answers 200 but the bot does nothing.

## 3. Expose the webhook

Meta needs a public HTTPS URL.

- **Production:** `https://<your-domain>/api/webhooks/whatsapp` (the reverse proxy already forwards `/api/*` to the backend).
- **Local development:** tunnel port 8000, for example
  ```bash
  cloudflared tunnel --url http://localhost:8000
  # or
  ngrok http 8000
  ```
  and use `https://<tunnel-host>/api/webhooks/whatsapp`.

## 4. Register the webhook in Meta

1. **WhatsApp > Configuration > Webhook > Edit**.
2. **Callback URL:** the URL from step 3. **Verify token:** the same value as `WHATSAPP_VERIFY_TOKEN`.
3. Click **Verify and save**. Meta calls `GET /api/webhooks/whatsapp`; the backend echoes the challenge only if the token matches.
4. Under **Webhook fields**, **Subscribe** to `messages`.

## 5. Try it

Send "hi" from your verified number to the test number. You should get the welcome message with **Language / Help / New chat** buttons. Then try:

- `Heavy rain destroyed my crop` (shows matching schemes)
- tap a scheme in the **Options** list, then **Documents**, **Eligibility**, **How to apply** or **Benefit**
- `भारी बारिश से मेरी फसल नष्ट हो गई` (answered in Hindi)

### Commands

These only count as commands when they are the whole message, so "help me apply for PM-KISAN" is answered as a question.

| Send | Effect |
|---|---|
| `hi`, `hello`, `namaste`, `start` | Welcome message |
| `help` | How to use the bot |
| `language` | Choose English / हिन्दी / ಕನ್ನಡ |
| `new` | Start a new conversation (forget context) |
| `sources` | Evidence behind the last answer |

## Behaviour notes

- **24-hour window:** WhatsApp only allows free-form replies within 24 h of the user's last message. The bot only ever replies, so this is always met.
- **Retries:** Meta retries a webhook that does not get a quick 200. The endpoint acknowledges at once and answers in a background task, and message IDs are deduplicated in memory.
- **Ordering:** a per-user lock keeps one person's messages in order while different users are answered concurrently.
- **Text only:** voice notes, images and stickers get a "please type your question" reply.
- **Signatures:** when `WHATSAPP_APP_SECRET` is set, requests without a valid `X-Hub-Signature-256` are rejected with 403. **Always set it in production**; without it anyone who knows the URL can post fake messages.
- **Rate limiting:** the webhook path is exempt from the HTTP rate limiter, because every request comes from Meta's IPs.
- **Replicas:** the webhook is stateless apart from the dedupe cache and the per-user locks, which are per process. With several API replicas a Meta retry can occasionally be answered twice. Route the webhook to one replica if that matters.

## Troubleshooting

| Symptom | Check |
|---|---|
| "The callback URL or verify token couldn't be validated" | The URL is public HTTPS, ends in `/api/webhooks/whatsapp`, and `WHATSAPP_VERIFY_TOKEN` matches exactly. The backend was restarted after editing `.env`. |
| Webhook verified but no reply | You subscribed to the `messages` field. `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are set. Look for `WhatsApp API 4xx` lines in the backend logs. |
| `WhatsApp API 401` / `code 190` | Access token expired (temporary tokens last 24 h). Generate a new one or use a system-user token. |
| `code 131030` "Recipient phone number not in allowed list" | Add the number as a test recipient in **API Setup**. |
| Every POST gets 403 | `WHATSAPP_APP_SECRET` does not match the app that sends the webhook. |
