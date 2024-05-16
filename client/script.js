const cellElements = document.querySelectorAll('.cell');
const messageElement = document.querySelector('.message');
let field = ["", "", "", "", "", "", "", "", ""];
let isGameActive = false;
let symbol = null;
let turn = null;

let ws = new WebSocket("ws://26.123.19.244:8080");

// Функция для отправки сообщения в чат
function sendMessage() {
  const inputElement = document.getElementById("chat-input");
  const message = inputElement.value.trim();
  
  if (message !== "") {
		console.log(`Sending chat message: ${message}`);
    ws.send(JSON.stringify({ method: "chatMessage", message }));
    inputElement.value = ""; // Очищаем поле ввода после отправки сообщения
  }
}

const sendButton = document.getElementById('sendButton');
sendButton.addEventListener('click', sendMessage);

ws.onmessage = message => {
	console.log(`Received message: ${message.data}`);
  const response = JSON.parse(message.data);

  if (response.method === "join") {
    symbol = response.symbol;
    turn = response.turn;
    isGameActive = symbol === turn;
    updateMessage();
  }

  if (response.method === "update") {
    field = response.field;
    turn = response.turn;
    isGameActive = symbol === turn;
    updateBoard();
    updateMessage();
  }

  if (response.method === "result") {
    field = response.field;
    updateBoard();
    isGameActive = false;
    setTimeout(() => {
      messageElement.textContent = response.message;
    }, 100);
  }

  if (response.method === "left") {
    isGameActive = false;
    messageElement.textContent = response.message;
  }

  if (response.method === "chatMessage") {
		const chatMessagesElement = document.querySelector(".chat-messages");
		console.log(chatMessagesElement);
		const newMessageElement = document.createElement("div");
		newMessageElement.textContent = response.message;
		chatMessagesElement.appendChild(newMessageElement);
  }
};

cellElements.forEach((cell, index) => cell.addEventListener('click', (event) => {
  makeMove(event.target, index);
}));

function makeMove(cell, index) {
  if (!isGameActive || field[index] !== "") {
    return;
  }

  isGameActive = false;
  cell.classList.add(symbol);
  field[index] = symbol;

  ws.send(JSON.stringify({
    "method": "move",
    "symbol": symbol,
    "field": field,
  }));

}

function updateBoard() {
  cellElements.forEach((cell, index) => {
    cell.classList.remove("X", "O");
    field[index] !== "" && cell.classList.add(field[index]);
  });
}

function updateMessage() {
  if (symbol === turn) {
    messageElement.textContent = "move";
  } else {
    messageElement.textContent = `waiting ${turn}...`;
  }
}
