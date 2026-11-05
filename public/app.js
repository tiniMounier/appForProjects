import { playSound, ringUntil, unlockAudio } from "./sounds.js";

// Apparence et voix de chaque personnage (les « rôles » sont côté serveur).
const CHARACTERS = [
  { id: "police", name: "La Police", emoji: "🚓", color: "#2563eb", sound: "siren", pitch: 0.9, rate: 1.0 },
  { id: "loup", name: "Le Grand Méchant Loup", emoji: "🐺", color: "#4b5563", sound: "howl", pitch: 0.3, rate: 0.85 },
  { id: "pere-noel", name: "Le Père Noël", emoji: "🎅", color: "#dc2626", sound: "bells", pitch: 0.6, rate: 0.92 },
  { id: "dragon", name: "Le Dragon", emoji: "🐉", color: "#16a34a", sound: "roar", pitch: 0.2, rate: 0.85 },
  { id: "petite-souris", name: "La Petite Souris", emoji: "🐭", color: "#db2777", sound: "magic", pitch: 1.8, rate: 1.1 },
  { id: "marchand-de-sable", name: "Le Marchand de Sable", emoji: "🌙", color: "#6d28d9", sound: "chime", pitch: 0.8, rate: 0.75 },
];

const PROBLEMS = [
  { label: "🥊 Se disputent", text: "les enfants se disputent et se chamaillent" },
  { label: "📢 Crient", text: "les enfants crient et font beaucoup de bruit" },
  { label: "🚗 En voiture", text: "on est en voiture, les enfants doivent rester assis et attachés et laisser le conducteur se concentrer" },
  { label: "😴 Au lit !", text: "les enfants ne veulent pas aller se coucher ou dormir" },
  { label: "🍽️ À table", text: "les enfants ne veulent pas manger ou ne restent pas à table" },
  { label: "🧦 S'habiller", text: "les enfants refusent de s'habiller ou de se préparer" },
  { label: "🦷 Les dents", text: "les enfants ne veulent pas se brosser les dents" },
  { label: "🧸 Ranger", text: "les enfants ne veulent pas ranger leurs jouets" },
];

const $ = (sel) => document.querySelector(sel);

// ---------- Réglages (prénoms) : confort local, l'appli marche sans ----------
const store = {
  get(k) {
    try {
      return localStorage.getItem(k) || "";
    } catch {
      return "";
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

// ---------- Accueil ----------
let selectedProblem = null;

function renderHome() {
  const grid = $("#bubbles");
  grid.innerHTML = "";
  for (const c of CHARACTERS) {
    const b = document.createElement("button");
    b.className = "bubble";
    b.style.setProperty("--c", c.color);
    b.innerHTML = `<span class="emoji">${c.emoji}</span><span class="label">${c.name}</span>`;
    b.addEventListener("click", () => startCall(c));
    grid.appendChild(b);
  }
  const chips = $("#problems");
  chips.innerHTML = "";
  for (const p of PROBLEMS) {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = p.label;
    chip.addEventListener("click", () => {
      selectedProblem = selectedProblem === p ? null : p;
      for (const el of chips.children) el.classList.toggle("on", el === chip && selectedProblem === p);
    });
    chips.appendChild(chip);
  }
}

// ---------- Synthèse vocale ----------
let frVoice = null;
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  frVoice = voices.find((v) => v.lang === "fr-FR" && /google|amelie|thomas|audrey/i.test(v.name)) ||
    voices.find((v) => v.lang?.startsWith("fr")) || null;
}
if ("speechSynthesis" in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

function speak(text, character) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window) || !text.trim()) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    if (frVoice) u.voice = frVoice;
    u.pitch = character.pitch;
    u.rate = character.rate;
    u.onend = u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

// ---------- Reconnaissance vocale ----------
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function listen(timeoutMs = 9000) {
  return new Promise((resolve) => {
    if (!Recognition) {
      // Pas de micro disponible : on laisse un petit temps puis on continue.
      setTimeout(() => resolve(""), 6000);
      return;
    }
    const r = new Recognition();
    r.lang = "fr-FR";
    r.interimResults = true;
    r.continuous = false;
    let finalText = "";
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        r.stop();
      } catch {}
      resolve(finalText.trim());
    };
    const timer = setTimeout(finish, timeoutMs);
    r.onresult = (e) => {
      let interim = "";
      finalText = "";
      for (const res of e.results) {
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      setCaption(`« ${(finalText || interim).trim()} »`, "kid");
    };
    r.onend = finish;
    r.onerror = finish;
    call.recognition = r;
    try {
      r.start();
    } catch {
      finish();
    }
  });
}

// ---------- Appel ----------
let call = null;

function setStatus(text) {
  $("#call-status").textContent = text;
}
function setCaption(text, who = "char") {
  const el = $("#caption");
  el.textContent = text;
  el.dataset.who = who;
}

function startCall(character) {
  unlockAudio();
  // Débloque la synthèse vocale sur iOS (doit être fait pendant le geste de l'utilisateur).
  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(""));
  }

  call = {
    character,
    messages: [],
    active: true,
    startedAt: null,
    timer: null,
    pendingNote: null,
    recognition: null,
    abort: null,
    silences: 0,
  };

  const screen = $("#call");
  screen.style.setProperty("--c", character.color);
  $("#call-emoji").textContent = character.emoji;
  $("#call-name").textContent = character.name;
  setStatus("Appel en cours…");
  setCaption("");
  screen.hidden = false;
  $("#home").hidden = true;

  const opening = selectedProblem
    ? `[Parent : l'appel commence. Le problème : ${selectedProblem.text}.]`
    : "[Parent : l'appel commence. Les enfants sont agités.]";
  conversation(opening);
}

function endCall() {
  if (!call) return;
  call.active = false;
  call.abort?.abort();
  try {
    call.recognition?.abort();
  } catch {}
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  clearInterval(call.timer);
  call = null;
  $("#call").hidden = true;
  $("#home").hidden = false;
}

function startTimer() {
  call.startedAt = Date.now();
  call.timer = setInterval(() => {
    const s = Math.floor((Date.now() - call.startedAt) / 1000);
    $("#call-timer").textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }, 500);
}

// Boucle : le personnage parle, puis on écoute les enfants, puis on recommence.
async function conversation(firstUserText) {
  const me = call;
  let userText = firstUserText;
  while (me.active) {
    me.messages.push({ role: "user", content: userText });
    const ended = await characterTurn(me);
    if (!me.active) return;
    if (ended) {
      setStatus("L'appel est terminé");
      await new Promise((r) => setTimeout(r, 1500));
      if (me.active) endCall();
      return;
    }

    setStatus("🎤 J'écoute…");
    const heard = await listen();
    if (!me.active) return;
    const note = me.pendingNote;
    me.pendingNote = null;
    const parts = [];
    if (note) parts.push(`[Parent : ${note}]`);
    parts.push(heard ? `Enfants : ${heard}` : "[Silence]");
    userText = parts.join("\n");
  }
}

// Un tour de parole du personnage : on lit le flux phrase par phrase.
async function characterTurn(me) {
  const c = me.character;
  const queue = [];
  let wake = null;
  let streamDone = false;
  let firstText;
  const gotFirst = new Promise((r) => (firstText = r));
  const push = (item) => {
    queue.push(item);
    wake?.();
  };

  let raw = "";
  let buffer = "";
  const flush = (force) => {
    // Extrait balises et phrases complètes du tampon.
    for (;;) {
      const tag = buffer.match(/\[(SON|FIN)\]/i);
      const sentence = buffer.match(/^[\s\S]*?[.!?…]+(?=\s|$)/);
      if (tag && (!sentence || tag.index < sentence[0].length)) {
        const before = buffer.slice(0, tag.index);
        if (before.trim()) push({ type: "say", text: before });
        push({ type: tag[1].toUpperCase() === "SON" ? "sound" : "end" });
        buffer = buffer.slice(tag.index + tag[0].length);
        continue;
      }
      if (sentence && (force || sentence[0].length < buffer.length)) {
        push({ type: "say", text: sentence[0] });
        buffer = buffer.slice(sentence[0].length);
        continue;
      }
      break;
    }
    if (force && buffer.trim()) {
      push({ type: "say", text: buffer.replace(/\[[^\]]*\]?/g, "") });
      buffer = "";
    }
  };

  me.abort = new AbortController();
  const fetching = (async () => {
    try {
      const res = await fetch("/api/talk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: c.id,
          messages: me.messages,
          kids: store.get("kids"),
        }),
        signal: me.abort.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let sse = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        sse += dec.decode(value, { stream: true });
        let idx;
        while ((idx = sse.indexOf("\n\n")) >= 0) {
          const block = sse.slice(0, idx);
          sse = sse.slice(idx + 2);
          const ev = block.match(/^event: (.*)$/m)?.[1];
          const data = JSON.parse(block.match(/^data: (.*)$/m)?.[1] || "{}");
          if (ev === "text") {
            firstText();
            raw += data.text;
            buffer += data.text;
            flush(false);
          } else if (ev === "refusal" || ev === "error") {
            throw new Error(ev);
          }
        }
      }
      flush(true);
    } catch (err) {
      if (me.active) {
        console.warn(err);
        // Phrase de secours, pour que l'appel ne coupe pas net devant les enfants.
        const fallback = "Oh, la ligne grésille un peu... Je compte sur vous pour rester bien sages. Au revoir !";
        raw += fallback + " [FIN]";
        push({ type: "say", text: fallback });
        push({ type: "end" });
      }
    } finally {
      firstText();
      streamDone = true;
      wake?.();
    }
  })();

  // Au premier appel, ça sonne pendant que le personnage « décroche ».
  if (!me.startedAt) {
    setStatus("Ça sonne…");
    await ringUntil(gotFirst, () => !me.active);
    if (!me.active) return false;
    startTimer();
  }
  setStatus("En ligne");

  let ended = false;
  while (me.active) {
    if (!queue.length) {
      if (streamDone) break;
      await new Promise((r) => (wake = r));
      wake = null;
      continue;
    }
    const item = queue.shift();
    if (item.type === "say") {
      setCaption(item.text.trim(), "char");
      document.body.classList.add("talking");
      await speak(item.text, c);
      document.body.classList.remove("talking");
    } else if (item.type === "sound") {
      await playSound(c.sound);
    } else if (item.type === "end") {
      ended = true;
    }
  }
  await fetching;
  me.messages.push({ role: "assistant", content: raw.trim() || "..." });
  return ended;
}

// ---------- Boutons pendant l'appel ----------
function sendNote(note) {
  if (!call) return;
  call.pendingNote = note;
  // Si on écoute, on coupe l'écoute pour que le personnage réagisse tout de suite.
  try {
    call.recognition?.stop();
  } catch {}
}

$("#hangup").addEventListener("click", endCall);
$("#note-calm").addEventListener("click", () =>
  sendNote("les enfants se sont calmés, félicite-les chaleureusement puis dis au revoir et raccroche."),
);
$("#note-again").addEventListener("click", () =>
  sendNote("ça recommence, les enfants s'agitent de nouveau, sois un peu plus ferme (toujours gentiment)."),
);
$("#note-sound").addEventListener("click", () => call && playSound(call.character.sound));

// ---------- Réglages ----------
$("#settings-btn").addEventListener("click", () => {
  $("#kids").value = store.get("kids");
  $("#settings").showModal();
});
$("#settings-form").addEventListener("submit", () => store.set("kids", $("#kids").value.trim()));

if (!Recognition) $("#mic-warning").hidden = false;
renderHome();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
