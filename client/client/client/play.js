const socket = io();
const $ = (id) => document.getElementById(id);

const modal = $("modal");
$("helpBtn").onclick = () => modal.classList.remove("hidden");
$("closeModal").onclick = () => modal.classList.add("hidden");

const screens = {
  join: $("screenJoin"),
  play: $("screenPlay")
};
function show(name){
  Object.values(screens).forEach(s=>s.classList.remove("active"));
  screens[name].classList.add("active");
}

let code = null;
let playerId = null;
let myName = null;

let phase = "idle";
let canAnswer = false;       // האם אפשר ללחוץ תשובות כרגע
let canUse5050 = false;
let disabledBy5050 = new Set();

function setMsg(t){ $("msg").textContent = t || ""; }
function setJoinMsg(t){ $("joinMsg").textContent = t || ""; }

function renderAnswers(options){
  const wrap = $("answers");
  wrap.innerHTML = "";
  if(!options || !options.length){
    return;
  }
  options.forEach((opt, idx)=>{
    const btn = document.createElement("button");
    btn.className = "answer";
    btn.textContent = opt;
    btn.disabled = !canAnswer || disabledBy5050.has(idx);
    btn.onclick = ()=>{
      if(!canAnswer) return;
      canAnswer = false;
      updateButtonsDisabled();
      socket.emit("submit_answer", { code, playerId, index: idx });
      setMsg("נשלח…");
    };
    wrap.appendChild(btn);
  });
}

function updateButtonsDisabled(){
  document.querySelectorAll(".answer").forEach((b, idx)=>{
    b.disabled = !canAnswer || disabledBy5050.has(idx);
  });
}

$("joinBtn").onclick = ()=>{
  const c = $("code").value.trim().toUpperCase();
  const n = $("name").value.trim();
  if(!c || c.length < 4){ return setJoinMsg("אנא הזן/י קוד בן 4 תווים"); }
  if(!n){ return setJoinMsg("אנא הזן/י שם"); }
  code = c; myName = n;
  setJoinMsg("מצטרפ/ת…");
  socket.emit("join_room", { code, name: myName });
};

socket.on("error_msg", ({ message })=>{
  setJoinMsg(message);
});

socket.on("joined", ({ playerId: pid, code: c })=>{
  playerId = pid;
  code = c;
  $("mePill").textContent = `שלום ${myName}`;
  show("play");
  setMsg("ממתין להתחלת המשחק…");
});

socket.on("room_state", (state)=>{
  // לא חובה, אבל נוח לעדכונים עתידיים
});

socket.on("question_public", ({ question, round, turnPlayerId, seconds })=>{
  $("explainBox").classList.add("hidden");
  phase = "question";
  disabledBy5050 = new Set();

  $("question").textContent = question;
  $("roundLabel").textContent = `${round}/7`;
  $("timerLabel").textContent = String(seconds);

  // כולם רואים שאלה, אבל תשובות רק אם נקבל question_private
  $("statePill").textContent = (turnPlayerId === playerId) ? "התור שלך!" : "ממתין…";
  canAnswer = false;
  canUse5050 = false;
  $("fiftyBtn").disabled = true;
  $("fiftyInfo").textContent = "";
  renderAnswers([]); // מסתיר תשובות למי שלא בתור
  setMsg((turnPlayerId === playerId) ? "ענה/י מהטלפון" : "רק השחקן בתורו רואה תשובות");
});

socket.on("question_private", ({ options, canUse5050: can5050 })=>{
  // מגיע רק לשחקן שבתורו
  canAnswer = true;
  canUse5050 = !!can5050;
  $("fiftyBtn").disabled = !canUse5050;
  $("fiftyInfo").textContent = canUse5050 ? "זמין פעם אחת" : "כבר נוצל";
  $("statePill").textContent = "התור שלך!";
  setMsg("בחר/י תשובה");
  renderAnswers(options);
});

$("fiftyBtn").onclick = ()=>{
  if(!canUse5050) return;
  canUse5050 = false;
  $("fiftyBtn").disabled = true;
  $("fiftyInfo").textContent = "נשלח 50/50…";
  socket.emit("use_5050", { code, playerId });
};

socket.on("5050_result", ({ disableIndexes })=>{
  disabledBy5050 = new Set(disableIndexes || []);
  $("fiftyInfo").textContent = "50/50 הופעל";
  updateButtonsDisabled();
});

socket.on("steal_open", ({ options, seconds })=>{
  phase = "steal";
  disabledBy5050 = new Set(); // בגניבה אין 50/50
  canAnswer = true;
  canUse5050 = false;
  $("fiftyBtn").disabled = true;
  $("fiftyInfo").textContent = "בגניבה אין 50/50";
  $("statePill").textContent = `גניבה! (${seconds}s)`;
  setMsg("הראשון שעונה נכון גונב את הקלף!");
  renderAnswers(options);
});

socket.on("steal_locked", ()=>{
  // לשחקן שטעה
  phase = "steal";
  canAnswer = false;
  canUse5050 = false;
  $("fiftyBtn").disabled = true;
  $("fiftyInfo").textContent = "";
  $("statePill").textContent = "גניבה פתוחה לאחרים…";
  renderAnswers([]); // מסתיר תשובות אצלו
  setMsg("חכה/י – אחרים יכולים לגנוב");
});

socket.on("timer", ({ phase: ph, seconds })=>{
  $("timerLabel").textContent = String(seconds);
  // לא מחייב, אבל נעים למשתמש:
  if(ph === "steal"){
    $("statePill").textContent = `גניבה! (${seconds}s)`;
  }
});

socket.on("toast", ({ text })=>{
  setMsg(text);
  setTimeout(()=>{ if($("msg").textContent === text) setMsg(""); }, 1400);
});

socket.on("explain", (exp)=>{
  phase = "explain";
  canAnswer = false;
  canUse5050 = false;
  $("fiftyBtn").disabled = true;
  renderAnswers([]);

  $("exp1").textContent = `✅ התשובה הנכונה: ${exp.correct}`;
  $("exp2").textContent = exp.short;
  $("exp3").textContent = exp.mistake;
  $("explainBox").classList.remove("hidden");
  $("statePill").textContent = "הסבר";
  setMsg("");
});

socket.on("game_over", (state)=>{
  // אפשר להציג מנצח גם בטלפון (בגרסה הבאה)
  phase = "idle";
  canAnswer = false;
  renderAnswers([]);
  $("statePill").textContent = "סיום";
  setMsg("המשחק הסתיים 🎉");
});
