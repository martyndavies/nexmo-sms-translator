// Set up SocketIO
const socket = io();

// If SocketIO connects to the server, let us know.
socket.on('connect', function(data) {
  socket.emit('join', 'Support interface connected...');
});

// If a newMessage is recieved from the server
socket.on('newMessage', function(message) {
  createNewMessage(message, 'inbound');
});

// Each newMessage inbound is held here
let currentMessage;


// Check the type of message and place it in the DOM
const createNewMessage = (message, messageType) => {

  if (messageType == 'inbound') {
    currentMessage = message;
    console.log(currentMessage)
  }

  const incomingMessageArea = document.getElementById('incoming');
  const messageContainer = document.createElement('div');
  messageContainer.className = 'row';

  // New inbound messages come up green like an SMS would
  if (messageType == 'inbound') {
    messageContainer.innerHTML = `
      <div class="green right message-bubble">
        <span class="white-text">${message.translation}</span>
      </div>
    `
  } else {

    // Replies come up blue like an iMessage would
    messageContainer.innerHTML = `
      <div class="blue left message-bubble">
        <span class="white-text">${message}</span>
      </div>
    `
  }

  // Add the message bubbles to the DOM
  incomingMessageArea.appendChild(messageContainer);
}

// Define where the reply button is
const replyButton = document.getElementById('reply-button');

// Listen for clicks on the reply button
replyButton.addEventListener('click', (e) => {
  const replyBox = document.getElementById('reply-box');

  let reply = {
    text: replyBox.value,
    number: currentMessage.msisdn,
    lang: currentMessage.lang
  }
  
  // Pass the reply back to the server along with the target lang, and the number to reply to
  fetch('/outbound-reply', {
    method: 'POST',
    body: JSON.stringify(reply),
    headers: new Headers({'Content-Type': 'application/json'})
  })
  .then(res => res.json())
  .then(data => {
    console.log(data);
    createNewMessage(reply.text, 'reply');
    replyBox.value = '';
  })
  .catch(err => {
    console.log(err)
  });

});