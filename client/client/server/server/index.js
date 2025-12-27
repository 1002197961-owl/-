import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const clientDir = path.join(__dirname, "..", "client");
app.use(express.static(clientDir));

// דפי מצב כיתה: /display ו-/play
app.get("/display", (_, res) => res.sendFile(path.join(clientDir, "display.html")));
app.get("/play", (_, res) => res.sendFile(path.join(clientDir, "play.html")));

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

function genQuestion(difficulty){
  const denomMax = 12;
  const p = 1 + Math.floor(Math.random()*9);
  const q = 2 + Math.floor(Math.random()*(denomMax-1));
  const rr = reduceFrac(p,q);
  let pn = rr.n, qd = rr.d;

  let gTarget = 1;
  if(difficulty === "easy") gTarget = 1;
  if(difficulty === "medium") gTarget = 2 + Math.floor(Math.random()*4); // 2..5
  if(difficulty === "hard") gTarget = 2 + Math.floor(Math.random()*9);   // 2..10

  const rawN = pn * gTarget;
  const rawD = qd * gTarget;

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

  let tries = 0;
  while((b>denomMax*2 || d>denomMax*2) && tries<40){
    b = pick(dFac); d = rawD / b;
    tries++;
  }

  const correct = reduceFrac(a*c, b*d);

  if(difficulty === "easy" && correct.g !== 1) return genQuestion(difficulty);
  if(difficulty !== "easy"){
    const limit = (difficulty === "medium") ? 5 : 10;
    if(correct.g < 2 || correct.g > limit) return genQuestion(difficulty);
  }

  const correctStr = fracStr(correct.n, correct.d);
  const rawStr = fracStr(a*c, b*d);

  const wOnlyNumer = fracStr(reduceFrac(a*c, b).n, reduceFrac(a*c, b).d);
  const wOnlyDenom = fracStr(reduceFrac(a, b*d).n, reduceFrac(a, b*d).d);
  const wCross = fracStr(reduceFrac(a*d, b*c).n, reduceFrac(a*d, b*c).d);

  const set = new Set([correctStr]);
  const distractors = [];
  const pushUnique = (s) => { if(!set.has(s) && s.includes("/") && !s.includes("NaN")){ set.add(s); distractors.push(s); } };

  pushUnique(rawStr);
  pushUnique(wOnlyNumer);
  pushUnique(wOnlyDenom);
  pushUnique(wCross);

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

function buildDeck(diff){
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

function explainForWrong(q, chosenIndex){
  const chosen = q.options[chosenIndex];
  let mistake = "טעות נפוצה: זכרו לכפול מונה×מונה ומכנה×מכנה ואז לצמצם.";
  if(chosen === q.raw) mistake = "טעות נפוצה: שכחת לצמצם את התוצאה.";
  else mistake = "טעות נפוצה: אל תכפילי מונה עם מכנה — כופלים מונה×מונה ומכנה×מכנה.";

  return {
    correct: q.correct,
    short: "הסבר קצר: כופלים מונה×מונה, מכנה×מכנה, ואז מצמצמים עד לשבר מצומצם.",
    mistake
  };
}

// Rooms state
const rooms = new Map();

function makeCode(){
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for(let i=0;i<4;i++) code += letters[Math.floor(Math.random()*letters.length)];
  return code;
}

function roomPublicState(room){
  return {
    code: room.code,
    started: room.started,
    diff: room.diff,
    round: room.round,
    turn: room.turn,
    players: room.players.map(p=>({ id:p.id, name:p.name, score:p.score, used5050:p.used5050 })),
    phase: room.phase, // "idle" | "question" | "steal" | "explain"
    timer: room.timer,
    publicQuestion: room.publicQuestion, // question string
  };
}

function broadcastRoom(room){
  io.to(room.code).emit("room_state", roomPublicState(room));
}

function startQuestion(room){
  room.phase = "question";
  room.timer = 45;
  room.publicQuestion = room.currentQ.question;

  // ציבורי לכולם: רק השאלה
  io.to(room.code).emit("question_public", {
    question: room.currentQ.question,
    round: room.round,
    turnPlayerId: room.players[room.turn].id,
    seconds: 45
  });

  // פרטי לשחקן בתורו: התשובות
  const current = room.players[room.turn];
  io.to(current.socketId).emit("question_private", {
    options: room.currentQ.options,
    canUse5050: !current.used5050
  });

  // טיימר שרת
  clearInterval(room._tick);
  room._tick = setInterval(()=>{
    room.timer--;
    io.to(room.code).emit("timer", { phase: room.phase, seconds: room.timer });
    if(room.timer <= 0){
      clearInterval(room._tick);
      // זמן נגמר → הקלף לתחתית החפיסה
      room.deck.unshift(room.currentQ);
      room.message = "הזמן נגמר — הקלף חזר לתחתית החפיסה";
      nextTurn(room, { showExplain:false });
    }
  }, 1000);

  broadcastRoom(room);
}

function nextTurn(room, { showExplain=true, explainPayload=null }={}){
  clearInterval(room._tick);

  if(showExplain && explainPayload){
    room.phase = "explain";
    io.to(room.code).emit("explain", explainPayload);
    broadcastRoom(room);
    // אחרי 2 שניות עוברים תור
    setTimeout(()=> advanceTurn(room), 2000);
  } else {
    advanceTurn(room);
  }
}

function advanceTurn(room){
  // תור הבא
  room.turn = (room.turn + 1) % room.players.length;
  room.turnCountInRound++;
  if(room.turnCountInRound >= room.players.length){
    room.turnCountInRound = 0;
    room.round++;
  }

  if(room.round > 7){
    room.phase = "idle";
    io.to(room.code).emit("game_over", roomPublicState(room));
    broadcastRoom(room);
    return;
  }

  // שולפים קלף חדש
  room.currentQ = room.deck.pop();
  startQuestion(room);
}

function startSteal(room, wrongChosenIndex){
  room.phase = "steal";
  room.timer = 8;

  // פותחים תשובות לכל מי שלא בתור (לא לשחקן שטעה)
  const current = room.players[room.turn];
  room.players.forEach(p=>{
    if(p.id !== current.id){
      io.to(p.socketId).emit("steal_open", { options: room.currentQ.options, seconds: 8 });
    } else {
      io.to(p.socketId).emit("steal_locked");
    }
  });

  clearInterval(room._tick);
  room._tick = setInterval(()=>{
    room.timer--;
    io.to(room.code).emit("timer", { phase: room.phase, seconds: room.timer });
    if(room.timer <= 0){
      clearInterval(room._tick);
      // לא נגנב → מציגים הסבר
      const exp = explainForWrong(room.currentQ, wrongChosenIndex);
      nextTurn(room, { showExplain:true, explainPayload: exp });
    }
  }, 1000);

  broadcastRoom(room);
}

io.on("connection", (socket)=>{
  socket.on("display_create_room", ({ diff })=>{
    const code = makeCode();
    const room = {
      code,
      diff,
      started:false,
      players:[],
      deck: buildDeck(diff),
      round:1,
      turn:0,
      turnCountInRound:0,
      phase:"idle",
      timer:0,
      currentQ:null,
      publicQuestion:"",
      displaySocketId: socket.id,
      _tick:null
    };
    rooms.set(code, room);
    socket.join(code);
    socket.emit("room_created", { code });
    broadcastRoom(room);
  });

  socket.on("join_room", ({ code, name })=>{
    const room = rooms.get(code);
    if(!room) return socket.emit("error_msg", { message:"קוד חדר לא נמצא" });
    if(room.started) return socket.emit("error_msg", { message:"המשחק כבר התחיל" });
    if(room.players.length >= 5) return socket.emit("error_msg", { message:"החדר מלא" });

    const player = {
      id: crypto.randomUUID(),
      socketId: socket.id,
      name: (name||"שחקן").slice(0,18),
      score:0,
      used5050:false
    };
    room.players.push(player);
    socket.join(code);

    socket.emit("joined", { playerId: player.id, code });
    broadcastRoom(room);
  });

  socket.on("start_game", ({ code })=>{
    const room = rooms.get(code);
    if(!room) return;
    if(room.players.length < 1) return;
    room.started = true;

    // קלף ראשון
    room.currentQ = room.deck.pop();
    startQuestion(room);
  });

  socket.on("use_5050", ({ code, playerId })=>{
    const room = rooms.get(code);
    if(!room) return;
    const current = room.players[room.turn];
    if(current.id !== playerId) return; // רק בתורו
    if(current.used5050) return;
    if(room.phase !== "question") return;

    current.used5050 = true;

    const q = room.currentQ;
    const wrongIdx = [0,1,2,3].filter(i=> i!==q.correctIndex);
    shuffle(wrongIdx);
    const toDisable = wrongIdx.slice(0,2);

    io.to(current.socketId).emit("5050_result", { disableIndexes: toDisable });
    broadcastRoom(room);
  });

  socket.on("submit_answer", ({ code, playerId, index })=>{
    const room = rooms.get(code);
    if(!room || !room.currentQ) return;

    const q = room.currentQ;
    const current = room.players[room.turn];

    // מי יכול לענות?
    if(room.phase === "question"){
      if(current.id !== playerId) return; // רק בתורו
      clearInterval(room._tick);

      if(index === q.correctIndex){
        const bonus = (room.round === 7) ? 2 : 1;
        current.score += bonus;

        io.to(room.code).emit("toast", { text:"🏆 אלוף המתמטיקלף!" });
        nextTurn(room, { showExplain:false });
      } else {
        // טעה → חלון גניבה 8 שניות
        io.to(room.code).emit("toast", { text:`❌ תשובה לא נכונה — גניבה נפתחה!` });
        startSteal(room, index);
      }
      return;
    }

    if(room.phase === "steal"){
      // בגניבה: כל מי שלא השחקן שטעה יכול לענות, הראשון שנכנס נועל
      if(current.id === playerId) return;

      // נועל גניבה (פעם אחת בלבד)
      if(room._stealLocked) return;
      room._stealLocked = true;

      clearInterval(room._tick);

      const thief = room.players.find(p=> p.id === playerId);
      if(!thief){
        room._stealLocked = false;
        return;
      }

      if(index === q.correctIndex){
        const bonus = (room.round === 7) ? 2 : 1;
        thief.score += bonus;
        io.to(room.code).emit("toast", { text:`⚡ גניבה הצליחה! ${thief.name} זכה/תה בקלף` });
        nextTurn(room, { showExplain:false });
      } else {
        // גם הגניבה טעתה → מציגים הסבר
        io.to(room.code).emit("toast", { text:"❌ גם הגניבה לא הצליחה" });
        const exp = explainForWrong(q, index);
        nextTurn(room, { showExplain:true, explainPayload: exp });
      }

      room._stealLocked = false;
      return;
    }
  });

  socket.on("disconnect", ()=>{
    // אפשרות: לנקות שחקנים שהתנתקו
    // כדי לא לסבך – נשאיר פשוט. אם תרצי, נוסיף “ניהול ניתוקים” אחר כך.
  });
});

server.listen(3000, "0.0.0.0", ()=>{
  console.log("מתמטיקלף רץ על http://localhost:3000");
  console.log("מסך כיתה: http://localhost:3000/display");
  console.log("טלפונים:  http://localhost:3000/play");
});
