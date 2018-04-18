// This is DotEnv. If in 'production' don't use it.
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
  }

// Load the modules we need for the app
const express = require('express');
const app = express();
const bodyParser = require('body-parser');

// Set the port to either the server port or port 8000
const port = process.env.PORT || 8000;

// The Nexmo number that we'll be replying from
const sender = process.env.SENDER;

// Init Nemo with details from .env
const Nexmo = require('nexmo');
var nexmo = new Nexmo({
  apiKey: process.env.NEXMO_API_KEY,
  apiSecret: process.env.NEXMO_API_SECRET
});

// Init a server instance and bind our Express instance to it
const server = require('http').createServer(app);

// Tell Express to use bodyParser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Tell Express where our static HTML, JS and CSS live
app.use(express.static('public'));

// Set up SocketIO
const io = require('socket.io')(server);

// Bind SocketIO to our Express instance
app.io = io;

// When the front end connects, let us know
io.on('connection', client => {  
  console.log('Client side connected...');

  client.on('join', data => {
    console.log(data);
  });
});


// Init the IBM Watson SDK and set up a language translator
const watson = require('watson-developer-cloud');
const LanguageTranslatorV2 = require('watson-developer-cloud/language-translator/v2');

const languageTranslator = new LanguageTranslatorV2({
  username: process.env.IBM_WATSON_USERNAME,
  password: process.env.IBM_WATSON_PASSWORD,
  url: 'https://gateway.watsonplatform.net/language-translator/api/'
});


// This function translates text into a target language
const translateText = (text, targetLanguage, cb) => { 
  languageTranslator.identify({text: text}, (err, language) => {
    
    if (err) {
      cb(err);
    }
    
    // What language is 'text' in?
    let languageDecision = language.languages[0].language;

    // If it's English, and the target lang is also English, stop here.
    if (languageDecision == 'en' && targetLanguage == 'en') {
      cb({translated: false, text, lang: languageDecision})
    } else {
      
      // Translate the text into the targetLanguge
      languageTranslator.translate({
        text: text,
        source: languageDecision,
        target: targetLanguage
      }, (err, translation) => {

        if (err) { cb(err) }

        // Get the first translation off the returned array
        let translationData = translation.translations[0];

        // Bundle up a new object with the translated text in it
        cb({
          text,
          translation: translationData.translation,
          lang:languageDecision,
          translated: true
        });
      });
    
    }
            
  });
};

// Load our index page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'))
});

// Receive new messages from Nexmo and send them for translation
app.post('/inbound', (req, res) => {
  const text = req.body.text;

  const translation =  translateText(text, 'en', (translationObj) => {
    if (translationObj.error) {
      console.log(translationObj);
    }

    // Pass the translated message object, and the object from Nexmo to the client
    req.app.io.emit('newMessage', {
      ...translationObj,
      ...req.body
    });

  });

  res.sendStatus(200); // 200 OK
});


// Translate replies and send them back to the user
app.post('/outbound-reply', (req, res) => {

  // If the language we get from the user is not English, translate it
  if (req.body.lang != 'en') {
    translateText(req.body.text, req.body.lang, (translatedMessage) => {

      // Send the translated message back to the user as a Unicode message
      nexmo.message.sendSms(sender, req.body.number, translatedMessage.translation, {'type': 'unicode'}, () => {
        res.json({messageStatus: 'sent', translated: true, message: translatedMessage.translation});
      });
    });
  } else {

    // If it's just English all the way, don't bother with translation
    nexmo.message.sendSms(sender, req.body.number, req.body.text, {'type': 'text'}, () => {
      res.json({messageStatus: 'sent', translated: false, message: req.body.text});
    });
  }
});


// Set up the server to listen out for all of the things...
server.listen(port, () => {
  console.log(`App is listening on ${port}`);
});