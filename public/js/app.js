const socket = io();

let currentMessage;

socket.on('connect', function(data) {
  socket.emit('join', 'Support interface connected...');
});

socket.on('newMessage', function(message) {
  createNewMessage(message, 'inbound');
});

const createNewMessage = (message, messageType) => {

  if (messageType == 'inbound') {
    currentMessage = message;
    console.log(currentMessage)
  }

  const incomingMessageArea = document.getElementById('incoming');
  const messageContainer = document.createElement('div');
  messageContainer.className = 'row';

  if (messageType == 'inbound') {
    messageContainer.innerHTML = `
      <div class="green right message-bubble">
        <span class="white-text">${message.translation}</span>
      </div>
    `
  } else {
    messageContainer.innerHTML = `
      <div class="blue left message-bubble">
        <span class="white-text">${message}</span>
      </div>
    `
  }

  incomingMessageArea.appendChild(messageContainer);
}


const replyButton = document.getElementById('reply-button');

replyButton.addEventListener('click', (e) => {
  const replyBox = document.getElementById('reply-box');

  let reply = {
    text: replyBox.value,
    number: currentMessage.msisdn,
    lang: currentMessage.lang
  }
  
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