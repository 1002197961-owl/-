const socket = io();

const $ = (id) => document.getElementById(id);

const modal = $("modal");
$("helpBtn").onclick = () => modal.classList.remove("hidden");
$("closeModal").onclick = () => modal.classList.add("hidden");

let roomCode = null;
let lastState = null;
let history = [];

function phaseHeb(phase){
  if(phase === "idle") return "ממתין";
  if(phase === "question") return "שאלה";
  if(phase === "steal") return "גניבה";
  if(phase === "explain") return "הסבר";
  return "—";
}

function diffHeb(diff){
  if(diff === "easy") return "קל";
  if(diff === "medium") return "בינוני";
  if(diff === "hard") return "מאתגר";
  return "—";
}

function renderPlayers(players, turnId){
  const wrap = $("players");
  wrap.innerHTML = "";
  players.forEach(p=>{
    const row = document.createElement("div");
    row.className = "playerRow" + (p.id === turnId ? " active":"");
    row.innerHTML = `
      <div>
        <div class="playerName">${p.name}</div>
        <div class="mini">50/50: ${p.used5050 ? "נוצל" : "זמין"}</div>
      </div>
      <div class="playerScore"><strong>${p.score}</strong> קלפים</div>
    `;
    wrap.appendChild(row);
  });
}

function renderHistory(){
  const ol = $("history");
  ol.innerHTML = "";
  history.slice(-6).forEach(item=>{
    const li = document.createElement("li");
    li.textContent = item;
    ol.appendChild(li);
  });
}

function setToast(text){
  $("toast").textContent = text || "";
  if(text){
    setTimeout(()=>{ $("toast").textContent = ""; }, 1400);
  }
}

$("createRoomBtn").onclick = ()=>{
  const diff = $("diff").value;
  socket.emit("display_create_room", { diff });
};

$("startBtn").onclick = ()=>{
  if(!roomCode) return;
  socket.emit("start_game", { code: roomCode });
};

socket.on("room_created", ({ code })=>{
  roomCode = code;
  $("roomCode").textContent = code;
  $("roomHint").textContent = "התלמידים נכנסים ל־/play ומקלידים את הקוד";
  $("question").textContent = "ממתין לשחקנים…";
  $("startBtn").disabled = true;
  history = [];
  renderHistory();
});

socket.on("room_state", (state)=>{
  lastState = state;
  $("phaseLabel").textContent = phaseHeb(state.phase);
  $("roundLabel").textContent = state.started ? `${state.round}/7` : "—";
  $("timerLabel").textContent = state.started ? String(state.timer ?? "—") : "—";
  $("progressBar").style.width = state.started ? `${((state.round-1)/7)*100}%` : "0%";

  const turnPlayer = state.players?.[state.turn] || null;
  const turnId = turnPlayer?.id || null;

  renderPlayers(state.players || [], turnId);

  if(state.started && state.publicQuestion){
    $("question").textContent = state.publicQuestion;
  }

  $("turnLabel").textContent = state.started && turnPlayer
    ? `תור: ${turnPlayer.name} • רמה: ${diffHeb(state.diff)}`
    : `רמה: ${diffHeb(state.diff)}`;

  // כפתור התחלה – רק אם יש לפחות שחקן אחד
  $("startBtn").disabled = !(state.players && state.players.length >= 1) || state.started;
});

socket.on("question_public", ({ question, round, turnPlayerId, seconds })=>{
  $("explainBox").classList.add("hidden");
  $("question").textContent = question;
  $("roundLabel").textContent = `${round}/7`;
  $("timerLabel").textContent = String(seconds);
  $("progressBar").style.width = `${((round-1)/7)*100}%`;

  // היסטוריה
  history.push(question);
  renderHistory();

  // סימון תור לפי state (מגיע ב-room_state) – יתעדכן אוטומטית
});

socket.on("timer", ({ phase, seconds })=>{
  $("phaseLabel").textContent = phaseHeb(phase);
  $("timerLabel").textContent = String(seconds);
});

socket.on("toast", ({ text })=>{
  setToast(text);
});

socket.on("explain", (exp)=>{
  $("exp1").textContent = `✅ התשובה הנכונה: ${exp.correct}`;
  $("exp2").textContent = exp.short;
  $("exp3").textContent = exp.mistake;
  $("explainBox").classList.remove("hidden");
});
