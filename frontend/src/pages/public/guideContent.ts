/* Text and screenshots of the citizen user guide (/guide). Wording lives here so the page component stays layout-only.
   Inline **bold** is supported in every text field. Screenshots are in frontend/public/guide/. */

export type Img = { src: string; alt: string; w: number; h: number; caption?: string };

export type Block =
  | { t: "p"; text: string }
  | { t: "h3"; text: string }
  | { t: "steps"; items: string[] }
  | { t: "list"; items: string[] }
  | { t: "img"; img: Img }
  | { t: "phones"; imgs: Img[] }
  | { t: "note"; tone: "tip" | "warn" | "info"; text: string }
  | { t: "defs"; items: [string, string][] }
  | { t: "faq"; items: [string, string][] };

export type Section = { id: string; title: string; blocks: Block[] };

const DIM: Record<string, [number, number]> = {
  welcome: [1280, 800], "sign-in": [1280, 800], "sign-up": [1280, 800], "forgot-password": [1280, 800], home: [1280, 800],
  header: [940, 104], "account-menu": [940, 380], assistant: [1280, 800], "assistant-input": [942, 68],
  "assistant-answer": [1280, 900], "assistant-cards": [1280, 900], "assistant-sources": [1280, 900],
  schemes: [1280, 800], "scheme-detail": [1280, 800], "scheme-guided": [1280, 800], forms: [1280, 800], "forms-yours": [1280, 800],
  applications: [1280, 800], "application-overview": [1280, 800], "application-documents": [1280, 800],
  "application-notes": [1280, 800], "application-submitted": [1280, 800], documents: [1280, 800], "add-document": [1280, 800],
  notes: [1280, 800], profile: [1280, 800], "phone-home": [520, 1125], "phone-more": [520, 1125], "phone-assistant": [520, 1125], "phone-forms": [520, 1125],
};
const img = (name: string, alt: string, caption?: string): Img => ({ src: `/guide/${name}.webp`, alt, w: DIM[name][0], h: DIM[name][1], caption });
const p = (text: string): Block => ({ t: "p", text });
const shot = (name: string, alt: string, caption?: string): Block => ({ t: "img", img: img(name, alt, caption) });

/** The short version shown at the top; each item jumps to its section. */
export const QUICK_START: { title: string; to: string }[] = [
  { title: "Sign in or create an account", to: "account" },
  { title: "Tell the assistant what happened", to: "assistant" },
  { title: "Pick a scheme that fits", to: "schemes" },
  { title: "Fill the form with help", to: "forms" },
  { title: "Check every answer, then submit", to: "forms" },
  { title: "Track it under Applications", to: "track" },
];

export const SECTIONS: Section[] = [
  {
    id: "start",
    title: "Before you start",
    blocks: [
      p("Sahayak helps you find government schemes that fit your situation and fill in the application form, in **English, हिन्दी or ಕನ್ನಡ**. You can type or speak, on a phone or a computer."),
      { t: "note", tone: "warn", text: "**This is a prototype.** The forms and documents are practice versions. When you submit, it is recorded in Sahayak only and is **not** sent to any government portal." },
      { t: "note", tone: "warn", text: "**Never share an OTP, PIN or password.** Sahayak will never ask you for one." },
      { t: "list", items: [
        "**Browser:** Chrome or Edge is best, because voice input works there. In other browsers you can still type everything.",
        "**Keep ready (for most farming schemes):** Aadhaar or Driving Licence, land record (RTC / Pahani) with the survey number, and your bank passbook or a cancelled cheque.",
        "**Nothing to install.** Open the site in your browser.",
      ] },
    ],
  },
  {
    id: "account",
    title: "Sign in or create an account",
    blocks: [
      p("Open Sahayak. On the first page you can pick your language at the top (**English**, **हिन्दी** or **ಕನ್ನಡ**), then press **Sign in**."),
      shot("welcome", "Sahayak landing page with language buttons, Start speaking and Sign in", "The landing page. Choose your language, then press Sign in."),
      { t: "h3", text: "Sign in" },
      { t: "steps", items: [
        "Type your **Email** and **Password**. Press the eye icon inside the password box if you want to see what you typed.",
        "Press **Sign in**. You land on your Home page.",
        "Just want to look around? Under **Quick sign-in**, press **Citizen** to fill in the sample account (Ramesh, a farmer), then press **Sign in**.",
      ] },
      shot("sign-in", "Sign in page with email, password, Create an account and Quick sign-in", "Sign in. Forgot your password? Use the Forgot? link above the password box."),
      { t: "h3", text: "Create an account" },
      { t: "steps", items: [
        "On the Sign in page press **Create an account**.",
        "Enter your **Full name**, **Email** and a **Password** of at least 8 characters.",
        "Pick your **Preferred language**. The whole app and the assistant will use it.",
        "Press **Create account**. You go to your Profile, where you can add a few details so forms fill faster.",
      ] },
      shot("sign-up", "Create account page with name, email, password and language buttons"),
      { t: "h3", text: "Forgot your password" },
      { t: "steps", items: [
        "Press **Forgot?** on the Sign in page, enter your email and press **Send reset link**.",
        "Type a **New password** (at least 8 characters) and press **Set new password**. Then sign in again.",
      ] },
      { t: "note", tone: "info", text: "This prototype has no email service, so the reset code is filled in for you on the screen." },
      shot("forgot-password", "Reset password page with an email box and Send reset link button"),
    ],
  },
  {
    id: "around",
    title: "Finding your way around",
    blocks: [
      p("After you sign in, the menu on the left (on a computer) has everything, grouped by what you want to do:"),
      { t: "defs", items: [
        ["Home", "Your starting page and a summary of where things stand."],
        ["Assistant", "Ask a question in your own words, by typing or speaking."],
        ["Schemes", "Browse government schemes and what each one needs."],
        ["Applications", "Track everything you have started."],
        ["Fill a Form", "Get help filling a government form, or upload your own."],
        ["Documents", "Your document wallet."],
        ["Notes", "Your to-dos and questions, plus notes the assistant keeps."],
        ["Profile", "Your details, used to fill forms faster."],
      ] },
      shot("home", "Home page with the left menu: Home, Assistant, Schemes, Applications, Fill a Form, Documents, Notes, Profile"),
      p("The bar at the top has three things: **How to use** (this guide), the **language** box and your **name**. Change the language here at any time and the whole app switches."),
      shot("header", "Top bar with How to use, the language box and the account button"),
      p("Press your name to open the account menu, where you can open your **Profile** or **Sign out**."),
      shot("account-menu", "Account menu showing your name and email, Profile and Sign out"),
    ],
  },
  {
    id: "home",
    title: "Home",
    blocks: [
      p("Home shows a greeting and the quickest ways to get help."),
      { t: "list", items: [
        "**Ask box:** type your problem and press **Talk to Assistant**. It opens the assistant with your question already sent.",
        "**Counters:** *In progress* applications, *Documents saved* and *Open to-dos*. Press any of them to open that page.",
        "**More ways to get help:** **Find a Scheme**, **Help Me Fill a Form** and **Documents**.",
        "**Continue where you left off:** a green banner appears when a form is half done. Press **Continue Application** to go straight back to it.",
        "**Active applications** and **Your next steps** list what to do next, for example uploading a missing document.",
      ] },
      shot("home", "Home page showing the greeting, ask box, counters, quick actions, active applications and next steps"),
    ],
  },
  {
    id: "assistant",
    title: "Ask the assistant",
    blocks: [
      p("The assistant finds schemes that may help and always shows the official sources behind its answer."),
      shot("assistant", "Assistant page with a welcome message, four suggested questions and the message box with a microphone button"),
      { t: "h3", text: "Ask a question" },
      { t: "steps", items: [
        "Open **Assistant** in the menu.",
        "Tell it what happened in your own words, for example *Heavy rain destroyed my crop. What help can I get?* You can also tap one of the suggested questions.",
        "Press **Send** (or the Enter key). The assistant shows *Checking official sources…* and then answers.",
      ] },
      { t: "h3", text: "Speak instead of typing" },
      { t: "steps", items: [
        "Press the round **microphone** button next to the message box. The words you speak appear in the box as you talk.",
        "Press the microphone again to stop.",
        "Read what appeared, fix anything that is wrong, then press **Send**.",
      ] },
      shot("assistant-input", "Message box with the microphone button, the language chip EN and the Send button"),
      { t: "note", tone: "tip", text: "Voice never sends by itself. You always check the words first and press **Send** yourself. The small chip under the microphone (**EN**, **हिं**, **ಕ**) is the language you will speak in." },
      { t: "note", tone: "info", text: "No microphone button? Your browser does not support voice input. Use Chrome or Edge, or just type." },
      { t: "h3", text: "Read the answer" },
      shot("assistant-answer", "An assistant answer listing a matching scheme, why it may apply, the benefit and documents, with small numbered source chips"),
      { t: "list", items: [
        "The small **numbers** in the answer point to the source for that sentence. Press one to open it.",
        "**Sources used** opens the **Evidence** panel with the exact official sources the answer is based on.",
        "**Listen** reads that answer aloud. **Read answers aloud** at the top does it for every answer.",
        "**Reference** lets you quote an answer when you ask a follow-up question.",
        "**New** starts a fresh conversation.",
      ] },
      shot("assistant-sources", "Evidence panel listing the source the answer was based on"),
      p("Under the answer you also get **scheme cards** showing the benefit and the documents needed. Press **See details** to read the scheme, or **Apply** / **Track application** to start."),
      shot("assistant-cards", "Scheme cards under an answer with documents needed and Track application and See details buttons"),
      { t: "note", tone: "warn", text: "If an answer says **Not verified by available sources**, treat it with care and confirm on the official portal before you act." },
    ],
  },
  {
    id: "schemes",
    title: "Find a scheme",
    blocks: [
      p("**Schemes** lists government schemes with the benefit and the documents each one needs."),
      shot("schemes", "Schemes page with a search box, filter buttons and scheme cards"),
      { t: "list", items: [
        "Type in **Search schemes** to narrow the list.",
        "**All schemes** shows everything. **With guided form** shows only schemes where the assistant will fill the form with you.",
        "Not sure which one fits? Press **Talk to Assistant** and describe your situation.",
      ] },
      p("Press **See details** on any card for the full picture:"),
      { t: "list", items: [
        "**Eligibility rules** in plain language.",
        "**Sources** with links to the official documents, and an **Official portal** button.",
        "**How it connects**, a small diagram showing how the scheme, its rules and its documents relate.",
      ] },
      shot("scheme-detail", "Scheme detail page with eligibility rules, sources and the how it connects diagram"),
      p("Cards marked **Guided form available (demo)** can be filled with the assistant. See the next section."),
      shot("scheme-guided", "Detail page of a scheme that has a guided form, with an Apply button"),
    ],
  },
  {
    id: "forms",
    title: "Fill a form with help",
    blocks: [
      p("Open **Fill a Form**. There are three groups:"),
      { t: "list", items: [
        "**Guided forms:** government forms the assistant walks you through, one question at a time.",
        "**Your own form:** upload any PDF or photo of a form and the assistant reads it and helps you fill it.",
        "**Apply on the official portal:** schemes applied for on the government's own site. Sahayak tracks them and keeps your documents and notes together.",
      ] },
      shot("forms", "Fill a form with help page with the upload card and a guided form card with the Fill with AI assistant button"),

      { t: "h3", text: "A. Fill a guided government form" },
      { t: "steps", items: [
        "On a guided form card press **Fill with AI assistant**. If you already started it, the button says **Continue with assistant**.",
        "The form opens in three parts. On the **left**, *Form progress* lists every field as **DONE**, **LATER** or **PENDING**; press one to jump to it. In the **middle** is the form itself, in sections. On the **right** is the assistant. Anything you type is saved automatically.",
        "Press **Help Me Fill This Form**. Choose the assistant's language. Then press **Continue without screen sharing** (simplest), or **Start Screen Assistance** to let the assistant see your screen (choose *This tab* when your browser asks).",
        "The assistant asks about **one field at a time** and highlights it on the form. Answer by typing or with the microphone. The field fills in and flashes so you can see it. Ask *What does this mean?* whenever you are unsure.",
        "Not ready to answer? Say so and it moves on. The field is marked **LATER** and you can come back to it.",
        "Sahayak checks each answer, for example the number of digits in a phone number or the format of an IFSC code, and asks again if something looks wrong.",
        "When the progress bar reaches **100%**, a **Review** button appears at the top right. Press it.",
        "On the **Final review** page, check every answer. Identity and bank numbers are hidden; press **Show sensitive numbers** to see them. Required fields you missed are shown in red with a link back to the form. Use **Edit** on any section to change an answer.",
        "Tick **I have checked the information above and confirm it is correct**, then press **Confirm & submit (demo)**.",
        "You see **Application recorded** with a **Reference number**. Press **Track this application** to follow it.",
      ] },
      { t: "note", tone: "tip", text: "Nothing is submitted unless you tick the box and press the button yourself. You can leave a form half done and come back later; Home shows a **Continue where you left off** banner." },

      { t: "h3", text: "B. Fill your own form (upload)" },
      { t: "steps", items: [
        "On **Your own form** press **Upload a form** and choose a **PDF, JPG, PNG or WebP** (up to 25 MB), or drag the file onto the card. On a phone you can press **Take photo** to photograph a paper form.",
        "Wait while it says *Uploading securely…* and *Reading the form…*. Scanned pages can take a little longer. The form then opens by itself.",
        "The screen has three parts: the **AutoFill / Review / Notes** panel on the left, your **form** in the middle with fields outlined, and the **assistant** on the right. On a phone, switch between them with the **Fields**, **Form** and **Assistant** tabs.",
        "Fill the fields any way you like: type in the **AutoFill** panel, tell the assistant, or press **Use my profile** to fill every empty field Sahayak can match from your Profile. Fields show a tag such as *AI-filled* or *from profile* so you know where a value came from.",
        "Press the ✨ sparkle icon next to a field to ask the assistant what it means. Press **Fill this later** to skip one for now.",
        "Some fields you complete yourself: a signature, and sensitive numbers the assistant will not take (*For your safety, enter this yourself*). If Sahayak is unsure what a field is, it says *I couldn't confidently identify this field*. Press **Name it** and type what it is.",
        "Open the **Review** tab. Check each answer and use **Edit** or **Ask AI** on any row. The tab title shows how many required fields are still empty. To leave them blank, tick **I choose to leave these blank on the PDF**. Tick **Write in BLOCK LETTERS** if the form asks for it.",
        "Press **Generate PDF**. Then press **Preview PDF** to look at it or **Download Completed PDF** to save it.",
        "Press **Share** at the top to send the PDF on WhatsApp or email, download it, **Copy field summary** (account numbers and Aadhaar are masked) or **Copy chat transcript**.",
      ] },
      { t: "note", tone: "info", text: "Your original file is never changed. If the PDF is made but some values could not be written, Sahayak lists them so you can write those by hand." },
      { t: "h3", text: "Your forms" },
      p("Every form you upload appears under **Your forms** on the same page. Use **All**, **In progress** and **Done** to filter. Press **Continue with assistant** or **View form** to reopen one. If reading a form failed, press **Try again**. The bin icon **deletes it permanently**, including page images, extracted text, your answers, notes and any completed PDF."),
      shot("forms-yours", "Your forms list with filters and cards showing Complete forms and a portal application"),
    ],
  },
  {
    id: "track",
    title: "Track your applications",
    blocks: [
      p("**Applications** shows everything you have started, where it stands and what to do next."),
      shot("applications", "Applications page with tabs All, In progress, Submitted and Approved and two application cards"),
      { t: "list", items: [
        "Use the tabs **All**, **In progress**, **Submitted** and **Approved** to filter.",
        "A green **Pick up where you left off** banner appears when a form is unfinished.",
        "Press a card's button (**Open tracker**, **Track status** or **Continue form**) to open it.",
      ] },
      p("The application page shows a tracker across the top, with a **What's next** line telling you the one thing to do now."),
      shot("application-overview", "Application page with a five-step tracker, What's next line, and Overview, Documents and Notes tabs"),
      { t: "defs", items: [
        ["Draft / In progress", "You are still filling in the form."],
        ["Documents required", "A required document is missing. Add it from your wallet or upload it."],
        ["Submitted (demo)", "Recorded in the prototype. Not sent to any government portal."],
        ["Under review", "The department is reviewing it."],
        ["Field verification", "A field check is being arranged."],
        ["Approved (demo)", "Approved. Nothing more to do."],
      ] },
      shot("application-submitted", "A submitted application with its reference number, tracker and timeline"),
      p("The tabs on an application:"),
      { t: "list", items: [
        "**Overview:** how many required documents are ready, and a **Timeline** of every status change.",
        "**Form answers:** what you entered (guided forms only).",
        "**Documents:** each required document. Pick one from your wallet with **Attach from wallet…**, or press **Upload**.",
        "**Notes & activity:** your own notes, the notes the assistant keeps, the sources it used and your conversation with it.",
      ] },
      shot("application-documents", "Documents tab listing each required document with Attach from wallet and Upload buttons"),
      shot("application-notes", "Notes and activity tab with your notes for this application and the assistant's notes"),
      { t: "note", tone: "info", text: "For schemes applied for on a portal, press **Open official portal** on the application page. Use the tracker to keep your documents and notes in one place." },
    ],
  },
  {
    id: "documents",
    title: "Your document wallet",
    blocks: [
      p("**Documents** keeps the papers you need in one place. The assistant checks this wallet to tell you what is missing for an application."),
      shot("documents", "Document wallet with two sample document cards and an Add document button"),
      { t: "steps", items: [
        "Press **Add document**.",
        "Choose the **Document type**: Aadhaar, Driving licence, Land record (RTC / Pahani), Bank passbook / cheque, Certificate or Other.",
        "Give it a **Title** (optional) and choose a **File** (PDF, JPG, PNG or TXT), which is also optional.",
        "Press **Save**.",
      ] },
      shot("add-document", "Add a document dialog with document type, title and file"),
      p("Each card has a **download** icon and a **bin** icon to delete it. Cards tagged **Sample (demo data)** are practice documents."),
      { t: "note", tone: "warn", text: "Do not upload real identity documents to this demo." },
    ],
  },
  {
    id: "notes",
    title: "Notes",
    blocks: [
      p("**Notes** has two lists side by side."),
      { t: "list", items: [
        "**My notes:** yours alone. Choose **To-do** or **Question** in the small box, type the note and press **+** (or Enter). To-dos you have not finished show up on Home.",
        "**AI notes:** the assistant's notes about each application. They update automatically as you make progress, and never mix with yours.",
      ] },
      shot("notes", "Notes page with My notes on the left and AI notes on the right"),
    ],
  },
  {
    id: "profile",
    title: "Your profile",
    blocks: [
      p("**Profile** holds details that Sahayak can put on a form for you when you press **Use my profile**. The more complete it is, the fewer questions you get asked."),
      { t: "list", items: [
        "**About you:** full name, mobile number, email for forms, father's or spouse's name, date of birth and nationality.",
        "**Preferred language:** English, हिन्दी or ಕನ್ನಡ.",
        "**Where you live:** address, state, district, taluk, village, PIN code and country.",
        "**Work & land:** occupation and land in acres. Many farming schemes depend on these.",
      ] },
      p("Press **Save profile** at the bottom when you are done."),
      shot("profile", "Profile page with a completion bar and the About you section"),
      { t: "note", tone: "info", text: "PAN and Aadhaar numbers are **never** stored in your profile. You type those on the form itself." },
    ],
  },
  {
    id: "phone",
    title: "Using Sahayak on a phone",
    blocks: [
      p("Everything works on a phone. The menu moves to a bar at the bottom with the four most-used places, and **More** holds the rest."),
      { t: "phones", imgs: [
        img("phone-home", "Home page on a phone with the bottom bar"),
        img("phone-more", "The More sheet with Fill a Form, Documents, Notes, Profile, How to use and Sign out"),
        img("phone-assistant", "Assistant on a phone"),
        img("phone-forms", "Fill a form page on a phone"),
      ] },
      { t: "list", items: [
        "**Bottom bar:** Home, Assistant, Schemes, Applications and More.",
        "**More:** Fill a Form, Documents, Notes, Profile, How to use and Sign out.",
        "**Filling an uploaded form:** switch between **Fields**, **Form** and **Assistant** at the top so each gets the whole screen.",
        "**Voice:** works best in Chrome on Android.",
      ] },
    ],
  },
  {
    id: "safety",
    title: "Your privacy and safety",
    blocks: [
      { t: "list", items: [
        "**Your answers are checked by code.** The values you enter on a form (numbers, dates, addresses) are validated by Sahayak itself. Anything that is sent to the AI has personal details removed first.",
        "**OTPs, passwords and PINs** are never asked for and never stored.",
        "**Uploads are private.** Your forms and documents belong to your account only, and your original file is never changed.",
        "**Screen sharing is optional.** If you turn it on, a single picture is used only when you ask a question. Nothing is recorded or stored. You can stop at any time with **Stop Assistance**, and please do not show passwords, OTPs or PINs.",
        "**You are in control.** Nothing is filled without your answer and nothing is submitted without your confirmation.",
      ] },
    ],
  },
  {
    id: "help",
    title: "Something not working?",
    blocks: [
      { t: "faq", items: [
        ["I cannot see the microphone button, or it says voice input is not supported.", "Your browser does not support voice input. Open Sahayak in **Chrome** or **Edge** and allow the microphone when asked. You can always type instead."],
        ["It says my session expired.", "Sign in again. You will be taken back to where you were."],
        ["I forgot my password.", "On the Sign in page press **Forgot?**, enter your email and set a new password."],
        ["My uploaded form could not be read.", "Press **Try again** on the form card. If it still fails, use a clearer photo or scan, or a PDF, under 25 MB."],
        ["The assistant does not recognise a field on my form.", "Press **Name it** in the amber box under that field and type what the field is."],
        ["My PDF was made but some values are missing.", "Sahayak lists the values it could not write. Write those by hand on the printed PDF."],
        ["I cannot press Confirm & submit.", "Required fields are still empty. The Review page lists them in red; press **Go back and finish them**. Then tick the confirmation box."],
        ["The answer says it is not verified.", "The assistant did not find an official source for it. Check the scheme on its **Official portal** before you act."],
        ["Where did my form go?", "Guided forms are under **Applications**. Forms you uploaded are under **Fill a Form → Your forms**."],
      ] },
    ],
  },
];
