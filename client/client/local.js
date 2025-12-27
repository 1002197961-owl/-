// מתמטיקלף — מצב מכשיר אחד (ל-GitHub Pages)
// כולל: 7 סיבובים, 45 קלפים (לא חוזר), 3 רמות קושי, 45 שניות, 50/50 פעם לשחקן,
// תשובות תמיד מצומצמות, מסיחים חכמים, “אלוף המתמטיקלף” על הצלחה, בונוס בסיבוב 7.

const $ = (id) => document.getElementById(id);

const screens = {
  home: $("screenHome"),
  game: $("screenGame"),
  end: $("screenEnd"),
};

const modal = $("modal");
$("helpBtn").onclick = () => modal.classList.remove("hidden");
$("howBtn").onclick = () => modal.classList.remove("hidden");
$("closeModal").onclick = () => modal.classList.add("hidden");

function gcd(a,b){ while(b){ [a,b]=[b,a%b]; } return Math.abs(a); }
function reduceFrac(n,d){
  const g = gcd(n,d);
  return { n: n/g, d: d/g, g };
}
function fracStr(n,d){ return `${n}/${d}`; }

function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]] = [arr[j],arr[i]];
  }
  return arr;
}

// יוצר שאלה לפי רמת קושי ותנאים
function genQuestion(difficulty){
  // טווחים “נוחים” לכיתה
  const denomMax = 12;

  // בונים תשובה מצומצמת p/q ואז מייצרים מכפלה שתיתן אותה
  const p = 1 + Math.floor(Math.random()*9);
  const q = 2 + Math.floor(Math.random()* (denomMax-1));

  // מבטיחים p/q מצומצם
  const rr = reduceFrac(p,q);
  let pn = rr.n, qd = rr.d;

  // קובעים גורם צמצום לפי רמה
  let gTarget = 1;
  if(difficulty === "easy") gTarget = 1;
  if(difficulty === "medium") gTarget = 2 + Math.floor(Math.random()*4); // 2..5
  if(difficulty === "hard") gTarget = 2 + Math.floor(Math.random()*9);   // 2..10

  // גורם צמצום אמיתי: בקל חייב להיות 1; בבינוני/קשה חייב להיות >1
  if(difficulty !== "easy"){
    // לפעמים p/q עלול לייצר ערכים גדולים; ננסה עד שמתקבל משהו סביר
    // וגם נוודא gTarget <= limit
  }

  // מכפלת מונים/מכנים לפני צמצום
  const rawN = pn * gTarget;
  const rawD = qd * gTarget;

  // עכשיו “מפרקים” rawN ו-rawD לשני שברים: a/b * c/d
  // נבחר a|rawN ו-b|rawD כדי להימנע משברים מוזרים
  const factors = (x) => {
    const f = [];
    for(let i=1;i<=x;i++) if(x%i===0) f.push(i);
    return f;
  };

  const nFac = factors(rawN);
  const dFac = factors(rawD);

  const pick = (arr) => arr[Math.floor(Math.random()*arr.length)];

  let a = pick(nFac), c = rawN / a;
  let b = pick(dFac), d = rawD / b;

  // נעדיף מכנים לא גדולים מדי
  let tries = 0;
  while((b>denomMax*2 || d>denomMax*2) && tries<40){
    b = pick(dFac); d = rawD / b;
    tries++;
  }

  // חישוב תשובה נכונה מצומצמת
  const correct = reduceFrac(a*c, b*d);
  // בקל: חייב שלא יהיה צמצום (כלומר gcd=1)
  if(difficulty === "easy" && correct.g !== 1) return genQuestion(difficulty);
  // בינוני/קשה: חייב צמצום >1 ובטווח
  if(difficulty !== "easy"){
    const limit = (difficulty === "medium") ? 5 : 10;
    if(correct.g < 2 || correct.g > limit) return genQuestion(difficulty);
  }

  const correctStr = fracStr(correct.n, correct.d);

  // מסיחים חכמים:
  // 1) כופלים רק מונים (ומשאיר מכנים לא מוכפלים)
  const wrong1 = reduceFrac(a*c, Math.max(1, b)).n + "/" + reduceFrac(a*c, Math.max(1, b)).d; // ייצוג, אבל נחליף בהמשך
  // נבנה מסיחים אמיתיים:
  const wOnlyNumer = reduceFrac(a*c, b).n + "/" + reduceFrac(a*c, b).d; // טעות: ד' לא הוכפל
  const wOnlyDenom = reduceFrac(a, b*d).n + "/" + reduceFrac(a, b*d).d; // טעות: מונים לא הוכפלו
  const wCross = reduceFrac(a*d, b*c).n + "/" + reduceFrac(a*d, b*c).d; // טעות: “מונה עם מכנה”/החלפה

  // 2) שוכחים לצמצם (אם יש צמצום)
  const rawStr = fracStr(a*c, b*d);

  // בונים 4 אפשרויות: אחת נכונה + 3 שגויות, ייחודיות
  const set = new Set([correctStr]);
  const distractors = [];

  const pushUnique = (s) => { if(!set.has(s) && s.includes("/") && !s.includes("NaN")){ set.add(s); distractors.push(s); } };

  pushUnique(rawStr);
  pushUnique(wOnlyNumer);
  pushUnique(wOnlyDenom);
  pushUnique(wCross);

  // אם חסר (לפעמים אחד יצא שווה במקרה), נוסיף “שינוי קטן” מבוקר
  while(distractors.length < 3){
    const bumpN = Math.max(1, correct.n + (Math.random()<0.5 ? 1 : -1));
    const bumpD = Math.max(2, correct.d + (Math.random()<0.5 ? 1 : -1));
    const r = reduceFrac(bumpN, bumpD);
    pushUnique(fracStr(r.n, r.d));
  }

  const options = shuffle([correctStr, ...distractors.slice(0,3)]);
  const correctIndex = options.indexOf(correctStr);

  return {
    a,b,c,d,
    question: `${a}/${b} × ${c}/${d} = ?`,
    correct: correctStr,
    options,
    correctIndex,
    raw: rawStr,
  };
}

function diffLabel(diff){
  if(diff==="easy") return "קל";
  if(diff==="medium") return "בינוני";
  return "מאתגר";
}

// State
let state = null;
let timer = null;

function renderNamesInputs(n){
  const wrap = $("namesWrap");
  wrap.innerHTML = "";
  for(let i=0;i<n;i++){
    const div = document.createElement("div");
    div.className = "field";
    div.innerHTML = `<span>שם שחקן ${i+1}</span><input id="name_${i}" placeholder="הקליד/י שם" value="שחקן ${i+1}" />`;
    wrap.appendChild(div);
  }
}

$("playersCount").addEventListener("change", (e)=> renderNamesInputs(Number(e.target.value)));
renderNamesInputs(Number($("playersCount").value));

function showScreen(name){
  Object.values(screens).forEach(s=>s.classList.remove("active"));
  screens[name].classList.add("active");
}

function buildDeck(diff){
  // 45 שאלות לא חוזרות
  const deck = [];
  const seen = new Set();
  while(deck.length < 45){
    const q = genQuestion(diff);
    if(!seen.has(q.question)){
      seen.add(q.question);
      deck.push(q);
    }
  }
  return deck;
}

function renderScoreboard(){
  const sb = $("scoreboard");
  sb.innerHTML = "";
  state.players.forEach((p, idx)=>{
    const row = document.createElement("div");
    row.className = "playerRow" + (idx===state.turn ? " active":"");
    row.innerHTML = `
      <div>
        <div class="playerName">${p.name}</div>
        <div class="mini">50/50: ${p.used5050 ? "נוצל" : "זמין"}</div>
      </div>
      <div class="playerScore"><strong>${p.score}</strong> קלפים</div>
    `;
    sb.appendChild(row);
  });
}

function setMessage(text){
  $("message").textContent = text || "";
}

function setExplain({correct, short, mistake}){
  $("explainCorrect").textContent = `✅ התשובה הנכונה: ${correct}`;
  $("explainShort").textContent = short;
  $("explainMistake").textContent = mistake;
  $("explain").classList.remove("hidden");
}

function hideExplain(){
  $("explain").classList.add("hidden");
}

function updateProgress(){
  $("roundLabel").textContent = `${state.round}/7`;
  $("progressBar").style.width = `${(state.round-1)/7*100}%`;
}

function flipCard(showFront){
  const card = $("card");
  if(showFront) card.classList.add("flip");
  else card.classList.remove("flip");
}

function stopTimer(){
  if(timer){ clearInterval(timer); timer=null; }
}

function startTimer(seconds, onEnd){
  stopTimer();
  let t = seconds;
  $("timerLabel").textContent = t;
  timer = setInterval(()=>{
    t--;
    $("timerLabel").textContent = t;
    if(t<=0){
      stopTimer();
      onEnd?.();
    }
  }, 1000);
}

function renderQuestion(q){
  $("diffPill").textContent = diffLabel(state.diff);
  $("questionText").textContent = q.question;

  const answers = $("answers");
  answers.innerHTML = "";
  q.options.forEach((opt, i)=>{
    const btn = document.createElement("button");
    btn.className = "answer";
    btn.textContent = opt;
    btn.onclick = ()=> submitAnswer(i);
    answers.appendChild(btn);
  });

  // 50/50
  const p = state.players[state.turn];
  $("fiftyBtn").disabled = p.used5050;
  $("fiftyInfo").textContent = p.used5050 ? "כבר השתמשת" : "פעם אחת במשחק";

  flipCard(true);
}

function lockAnswers(lock=true){
  document.querySelectorAll(".answer").forEach(b=> b.disabled = lock);
}

function apply5050(){
  const p = state.players[state.turn];
  if(p.used5050) return;
  p.used5050 = true;

  const q = state.currentQ;
  // מוחקים 2 תשובות שגויות
  const wrongIdx = [0,1,2,3].filter(i=> i!==q.correctIndex);
  shuffle(wrongIdx);
  const toRemove = wrongIdx.slice(0,2);
  document.querySelectorAll(".answer").forEach((btn, idx)=>{
    if(toRemove.includes(idx)){
      btn.disabled = true;
      btn.style.opacity = 0.35;
    }
  });
  renderScoreboard();
}

$("fiftyBtn").onclick = apply5050;

function explainForWrong(q, chosenIndex){
  const chosen = q.options[chosenIndex];
  let mistake = "טעות נפוצה: זכרו לכפול מונה×מונה ומכנה×מכנה ואז לצמצם.";
  if(chosen === q.raw) mistake = "טעות נפוצה: שכחת לצמצם את התוצאה.";
  else if(chosen === reduceFrac(q.a*q.c, q.b).n + "/" + reduceFrac(q.a*q.c, q.b).d) mistake = "טעות נפוצה: כפלית רק את המונים ושכחת לכפול מכנים.";
  else if(chosen === reduceFrac(q.a, q.b*q.d).n + "/" + reduceFrac(q.a, q.b*q.d).d) mistake = "טעות נפוצה: כפלית רק מכנים ושכחת לכפול מונים.";
  else mistake = "טעות נפוצה: אל תכפילי מונה עם מכנה — כופלים מונה×מונה ומכנה×מכנה.";

  return {
    correct: q.correct,
    short: "הסבר קצר: כופלים מונה×מונה, מכנה×מכנה, ואז מצמצמים עד לשבר מצומצם.",
    mistake
  };
}

function champToast(){
  setMessage("🏆 אלוף המתמטיקלף!");
  setTimeout(()=> setMessage(""), 1200);
}

function nextTurn(){
  hideExplain();
  flipCard(false);

  state.turn = (state.turn + 1) % state.players.length;

  // העלאת סיבוב לאחר שכל השחקנים שיחקו תור אחד
  state.turnCountInRound++;
  if(state.turnCountInRound >= state.players.length){
    state.turnCountInRound = 0;
    state.round++;
    updateProgress();
  }

  if(state.round > 7){
    endGame();
    return;
  }

  renderScoreboard();
  drawCard();
}

function drawCard(){
  state.currentQ = state.deck.pop();
  renderQuestion(state.currentQ);
  renderScoreboard();
  lockAnswers(false);
  setMessage(`תור: ${state.players[state.turn].name}`);

  startTimer(45, ()=>{
    // זמן נגמר → קלף לתחתית החפיסה, תור עובר
    state.deck.unshift(state.currentQ);
    lockAnswers(true);
    setMessage("⏳ הזמן נגמר — הקלף חזר לתחתית החפיסה");
    setTimeout(nextTurn, 700);
  });
}

function submitAnswer(index){
  lockAnswers(true);
  stopTimer();

  const q = state.currentQ;
  const isCorrect = index === q.correctIndex;

  if(isCorrect){
    const bonus = (state.round === 7) ? 2 : 1;
    state.players[state.turn].score += bonus;
    champToast();
    renderScoreboard();
    setTimeout(nextTurn, 700);
  } else {
    // במצב מכשיר אחד: אין גניבה אמיתית, אז מציגים הסבר וממשיכים
    const exp = explainForWrong(q, index);
    setExplain(exp);
  }
}

$("nextBtn").onclick = ()=> nextTurn();

function endGame(){
  stopTimer();
  const max = Math.max(...state.players.map(p=>p.score));
  const winners = state.players.filter(p=>p.score===max).map(p=>p.name);
  $("winnerText").textContent = `המנצח/ים: ${winners.join(" , ")} עם ${max} קלפים!`;
  showScreen("end");
}

$("restartBtn").onclick = ()=> showScreen("home");

$("startBtn").onclick = ()=>{
  const n = Number($("playersCount").value);
  const diff = $("difficulty").value;

  const players = [];
  for(let i=0;i<n;i++){
    players.push({ name: $(`name_${i}`).value.trim() || `שחקן ${i+1}`, score:0, used5050:false });
  }

  state = {
    diff,
    players,
    round: 1,
    turn: 0,
    turnCountInRound: 0,
    deck: buildDeck(diff),
    currentQ: null
  };

  updateProgress();
  $("progressBar").style.width = "0%";
  showScreen("game");
  setMessage("");
  flipCard(false);

  // שליפה ראשונה
  setTimeout(drawCard, 300);
};
