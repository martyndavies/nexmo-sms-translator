if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
  }
  
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const port = process.env.PORT || 8000;
const sender = process.env.SENDER;

const Nexmo = require('nexmo');
var nexmo = new Nexmo({
  apiKey: process.env.NEXMO_API_KEY,
  apiSecret: process.env.NEXMO_API_SECRET
});

const server = require('http').createServer(app);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

const io = require('socket.io')(server);

// Bind IO to our Express instance
app.io = io;

io.on('connection', client => {  
  console.log('Client side connected...');

  client.on('join', data => {
    console.log(data);
  });
});

const watson = require('watson-developer-cloud');
const LanguageTranslatorV2 = require('watson-developer-cloud/language-translator/v2');

const languageTranslator = new LanguageTranslatorV2({
  username: process.env.IBM_WATSON_USERNAME,
  password: process.env.IBM_WATSON_PASSWORD,
  url: 'https://gateway.watsonplatform.net/language-translator/api/'
});

const translateText = (text, targetLanguage, cb) => { 
  languageTranslator.identify({text: text}, (err, language) => {
    
    if (err) {
      cb(err);
    }
    
    let languageDecision = language.languages[0].language;

    if (languageDecision == 'en' && targetLanguage == 'en') {
      cb({translated: false, text, lang: languageDecision})
    } else {
        
      languageTranslator.translate({
        text: text,
        source: languageDecision,
        target: targetLanguage
      }, (err, translation) => {

        if (err) { cb(err) }

        let translationData = translation.translations[0];

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

app.post('/inbound', (req, res) => {
  const text = req.body.text;

  const translation =  translateText(text, 'en', (translationObj) => {
    if (translationObj.error) {
      console.log(translationObj);
    }

    req.app.io.emit('newMessage', {
      ...translationObj,
      ...req.body
    });

  });

  res.sendStatus(200); // 200 OK
});

app.post('/outbound-reply', (req, res) => {
  if (req.body.lang != 'en') {
    translateText(req.body.text, req.body.lang, (translatedMessage) => {
      nexmo.message.sendSms(sender, req.body.number, translatedMessage.translation, {'type': 'unicode'}, () => {
        res.json({messageStatus: 'sent', translated: true, message: translatedMessage.translation});
      });
    });
  } else {
    nexmo.message.sendSms(sender, req.body.number, req.body.text, {'type': 'text'}, () => {
      res.json({messageStatus: 'sent', translated: false, message: req.body.text});
    });
  }
});

server.listen(port, () => {
  console.log(`App is listening on ${port}`);
});