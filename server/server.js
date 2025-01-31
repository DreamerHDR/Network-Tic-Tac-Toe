const express = require('express');
const path = require('path');
const http = require("http");
const WebSocket = require("ws");

const app = express();
app.use(express.static(path.join(__dirname, '..', 'client')));
app.listen(3000);

const httpServer = http.createServer();
const wss = new WebSocket.Server({ server: httpServer });
httpServer.listen(8080);

const clientConnections = {};
const chatConnections = {}; // Хранение соединений чата
const opponents = {}; // Хранение пар игроков
let clientIdsWaitingMatch = []; // Идентификаторы клиентов, ожидающие матч

wss.on("connection", connection => {
  const clientId = createClientId();
  clientConnections[clientId] = connection;
  chatConnections[clientId] = connection; // Сохранение соединения

  matchClients(clientId); // Поиск оппонента

  // Отправляем сообщение о присоединении к чату
  connection.send(JSON.stringify({
    method: "chatJoin",
    clientId: clientId,
  }));

  // Обработчик сообщений
  connection.on("message", message => {
    const result = JSON.parse(message);
		console.log(`Received message from client: ${JSON.stringify(result)}`);
    if (result.method === "move") {
      moveHandler(result, clientId);
    } else if (result.method === "restart") {
      restartGame(clientId);
    } else if (result.method === "chatMessage") {
      // Пересылаем сообщение всем клиентам в чате
      for (const id in chatConnections) {
        chatConnections[id].send(JSON.stringify({
          method: "chatMessage",
          clientId: clientId,
          message: result.message,
        }));
      }
    }
  });

  connection.on("close", () => {
    closeClient(connection, clientId);
		delete chatConnections[clientId];
  });
});

function matchClients(clientId) {
  clientIdsWaitingMatch.push(clientId);

  if (clientIdsWaitingMatch.length < 2) return;

  const firstClientId = clientIdsWaitingMatch.shift();
  const secondClientId = clientIdsWaitingMatch.shift();

  opponents[firstClientId] = secondClientId;
  opponents[secondClientId] = firstClientId;

  clientConnections[firstClientId].send(JSON.stringify({
    method: "join",
    symbol: "X",
    turn: "X"
  }));

  clientConnections[secondClientId].send(JSON.stringify({
    method: "join",
    symbol: "O",
    turn: "X"
  }));
}

function moveHandler(result, clientId) {
  const opponentClientId = opponents[clientId];

  if (checkWin(result.field)) {
    [clientId, opponentClientId].forEach(cId => {
      clientConnections[cId].send(JSON.stringify({
        method: "result",
        message: `${result.symbol} win`,
        field: result.field,
      }));
    });
    return;
  }

  if (checkDraw(result.field)) {
    [clientId, opponentClientId].forEach(cId => {
      clientConnections[cId].send(JSON.stringify({
        method: "result",
        message: "Draw",
        field: result.field,
      }));
    });
    return;
  }

  [clientId, opponentClientId].forEach(cId => {
    clientConnections[cId].send(JSON.stringify({
      method: "update",
      turn: result.symbol === "X" ? "O" : "X",
      field: result.field,
    }));
  });
}

function closeClient(connection, clientId) {
  connection.close();
  const isLeftUnmachedClient = clientIdsWaitingMatch.some(unmatchedClientId => unmatchedClientId === clientId);

  if (isLeftUnmachedClient) {
    clientIdsWaitingMatch = clientIdsWaitingMatch.filter(unmatchedClientId => unmatchedClientId !== clientId);
  } else {
    const opponentClientId = opponents[clientId];
    clientConnections[opponentClientId].send(JSON.stringify({
      method: "left",
      message: "opponent left",
    }));
  }
}

function restartGame() {
  // Очищаем данные и отправляем уведомление обновления игры всем клиентам
  clientIdsWaitingMatch = [];
  opponents = {};
  for (const clientId in clientConnections) {
    clientConnections[clientId].send(JSON.stringify({ method: "restart" }));
  }
}

const winningCombos = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],  // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8],  // Columns
  [0, 4, 8], [2, 4, 6]              // Diagonals
];

function checkWin(field) {
  return winningCombos.some(combo => {
    const [first, second, third] = combo;
    return field[first] !== "" && field[first] === field[second] && field[first] === field[third];
  });
}

function checkDraw(field) {
  return field.every(symbol => symbol === "X" || symbol === "O");
}

let clientIdCounter = 0;
function createClientId() {
  clientIdCounter++;
  return clientIdCounter;
}
