# Overview
If you’ve ever worked in customer support for a company whose services are used in many countries, you’ll know that receiving messages in a foreign language can be a regular occurance.

When these messages come in there’s only so much, “Hey, does anyone speak Spanish?”, that you can do before you need something better.

Wouldn’t it be great if the inbound messages were automatically translated into your language of choice, and the replies that you send back were translated into the recipients native tongue? Sure would.

In this example we’re going to show you how to build out a simple solution that automatically translates inbound and outbound messages into different languages in real time.

In addition to this basic outline code, we've created a more complete application that you can clone from [GitHub](https://github.com/martyndavies/transporter-support) and use further (see below). Although if you'd like the code for this tutorial, you can [get that right here](https://github.com/martyndavies/nxm-blog-demo).

![The final app](https://cl.ly/1A3l2E093B35/Screen%20Recording%202018-04-16%20at%2009.55%20am.gif)

# Before you begin…
If you’re going to build along then you’ll need a few things before we start, so fire up another tab and grab yourself the following:

* A [Nexmo account](https://dashboard.nexmo.com/sign-up) - We’ll use this for the inbound and outbound messaging.
* An [IBM Cloud](https://console.bluemix.net/) account - We’ll be using the [IBM Watson Language Translator](https://console.bluemix.net/catalog/services/language-translator) to handle the translation in this example, so you’ll need to activate that once your account is ready.

Make sure you have your API keys for both accounts handy as we’ll need them shortly.

We’re going to build this app using a simple backend API that we’ll create in NodeJS, so if you need to install that, [you can do so here](https://nodejs.org/en/download/package-manager/). 

For development purposes, you'll also need [Ngrok](https://ngrok.com/) so you can receive inbound messages on your local machine. We'll cover how it's used in this project below.

# Steps

## Set up Nexmo
Nexmo requires the least amount of work, so we'll set that up first.

Start by purchasing a new number that supports SMS.

![Buying numbers in the Nexmo dashboard](https://cl.ly/341A193z2z43/[539a483011db5933ada06811d494d79f]_Image%202018-04-16%20at%2012.35.15%20pm.png)

Once you have your number, you'll need to set it up to send all of the incoming messages through to your local development environment, and `ngrok` is going to help us do that.

In your terminal, run the following code:

`$ ngrok http 8000`

Ngrok will launch, and provide you with a URL (as shown below).

![Ngrok in Terminal](https://cl.ly/2j2a401D0D0t/[86d18c55ebd03b172d79f09b5ed91fbc]_Image%202018-04-16%20at%2012.27.21%20pm.png)

In the *Your Numbers* section of the Nexmo dashboard, you can edit the settings for the number you're using for the app. Set the webhook to point to the URL that Ngrok gave you:

![Nexmo Edit Number](https://cl.ly/0w3J0N1W3d26/Image%202018-04-16%20at%2012.37.50%20pm.png)

## Setup the app
You'll notice that we added `/inbound` to the URL, this is the route that app will accept incoming messages on, let's set it up:

In a fresh directory, initialise a new NodeJS app:

`$ npm init`

Then install the dependencies:

`$ npm install express body-parser nexmo socket.io watson-developer-cloud dotenv`

So you don't have to keep stopping and restarting the server, we'll also install Nodemon.

`$ npm install nodemon --save-dev`

Next, a little safety prep. For security reasons it's good practice not to keep any password information directly in files you might push to GitHub or anywhere else, so we're keeping it elsewhere.

Above, we added DotEnv to our app, so go ahead and create a `.env` file in the root directory so you can keep everything you need for this app safe:

`$ touch .env`

Open the file, and add these variables:

```
NEXMO_API_KEY=YOUR_NEXMO_API_KEY
NEXMO_API_SECRET=YOUR_NEXMO_API_SECRET
IBM_WATSON_USERNAME=YOUR_IBM_WATSON_USERNAME
IBM_WATSON_PASSWORD=YOUR_IBM_WATSON_PASSWORD
SENDER=YOUR_NEXMO_PHONE_NUMBER
```

You don't want this file ending up in a repository either, so let's make a `.gitignore` file:

```
$ touch .gitignore
```
Then add the following two lines to it:

```
node_modules/
.env
```
Finally, create a file to house all our server code:

`$ touch server.js`

...and add the following code:

```javascript
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

// Receive new messages from Nexmo and send them for translation
app.post('/inbound', (req, res) => {
  console.log(req.body);
  res.sendStatus(200); // 200 OK
});

// Set up the server to listen out for all of the things...
server.listen(port, () => {
  console.log(`App is listening on ${port}`);
});
```
Right now, all this will do is log all the information that Nexmo sends to the console.

You can run it and test sending messages to your Nexmo number:

`$ nodemon server`


## Set up IBM Language Translator
Next, we need to figure out what language the incoming message is in and translate it.

Thanks to their easy to use Node SDK and the fact that the first 1,000,000 characters translated through the service are free; IBM's Language Translator is our choice for this app.

Their API allows us to both *identify* the language a piece of text is in, as well as *translate* to and from different languages.

Let's set it up by adding the following to `server.js`:

```javascript
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
    if (languageDecision === 'en' && targetLanguage == 'en') {
      cb({translated: false, text})
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
        // pass it back to the callback
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
```
Breaking down the above code, it's achieving two things.

1. Identify the language of the text in the incoming message.
2. Translate the text from the message to English, if it isn't already in that language.

A caveat worth noting is that the first object the language translator returns is actually an array of languages it considers the text could be, along with a certainty score. It's ordered by *most certain*, but IBM's naming conventions are a little janky so to get the first language we have to use the somewhat repetative:

`translation.translations[0].translation`

### Translating the incoming messages
Now that we have a functon that can identify the language an incoming message is in, we need to apply it to our route.

In `server.js` modify the `/inbound` route to look like this:

```javascript
app.post('/inbound', (req, res) => {
  const text = req.body.text;

  const translation =  translateText(text, 'en', (translationObj) => {
    if (translationObj.error) {
      console.log(translationObj);
    }

    console.log(translationObj);

  });

  res.sendStatus(200); // 200 OK
});

```

The above code takes the inbound SMS messages and passes them to our `translateText` function, translates them into English and logs them to the console.

## Passing the messages to the browser
Now that we've got incoming messages being translated, we need to pass them to the browser to our 'support agents' can interact with them.

To do this in real time, we'll need to use [Socket.io](https://socket.io/).

In your `server.js` file add:

```javascript
// Init SocketIO and bind to the server instance
const io = require('socket.io')(server);

// Bind IO to our Express instance
app.io = io;

// Let us know when SocketIO is up and running
io.on('connection', client => {  
  console.log('Client side connected...');

  // Let us know when the client side is connected
  client.on('join', data => {
    console.log(data);
  });
});

```
Above we set up the code we need for SocketIO, but the important piece to note is the line `app.io = io`. This takes the instance of SocketIO and binds it to our Express instance we set up earlier and called `app`. With this in place you can more easily emit messages to SocketIO as part of the usual Express routes.

Modify your `/inbound` route to emit the translated messages via socket.io using our newly combined Express & SocketIO instance:

```javascript
app.post('/inbound', (req, res) => {
  // Get the text of the incoming message
  const text = req.body.text;

  // Pass the text to our translateText function and get the translated result
  const translation =  translateText(text, 'en', (translationObj) => {
    if (translationObj.error) {
      console.log(translationObj);
    }

    // Combine the object translateText returns with
    // the object we get originally from Nexmo and emit it
    // to the client side via SocketIO
    req.app.io.emit('newMessage', {
      translationObj,
      ...req.body
    });

  });

  res.sendStatus(200); // 200 OK
});

```

## Build an interface to reply with
In your terminal, run the following commands in the root of your app directory:

```
$ mkdir public && mkdir public/js
$ touch ./public/index.html && touch ./public/js/app.js 
```
Then add the following to `server.js`:

```javascript
app.use(express.static('public'));

// Load our index page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname + '/public/index.html'))
});

```
Open up the `index.html` file and copy in the contents of [this file](https://gist.github.com/martyndavies/ddb63b7191e0cf87d0502b3db491ffa0). It contains all you need for a simple frontend to reply to the messages.

Next, open `public/js/app.js` and add the the code to set up Socket.io on the client side:

```javascript
// Init SocketIO
const socket = io();

// Let us know when the server is connected
socket.on('connect', function(data) {
  socket.emit('join', 'Support interface connected...');
});

// Log any messages marked 'newMessage' to the console
socket.on('newMessage', function(message) {
  console.log(message);
});
```

Save it. Then reload `http://localhost:8000` and open your console. If you now send a text message to your Nexmo number, you should see the result returned here.

Let's get the message into the page itself. Start by heading back into `public/js/app.js` and load it up with all the JS that you can find in this [GitHub Gist](https://gist.github.com/martyndavies/a8effab804f013b74d489ef10fdfd0c4)

This code handles displaying the messages within the page, and also takes care of sending replies back to the server.

## Sending back translated replies
In order to accept those replies and send them on we need to add a new route to our `server.js` file:

```javascript
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

```

We're passing an object from the client side that contains the text we want to send back to the user as well as the target language, and their number.

In the `/outbound-reply` route we first check to see if the target language is English, and if it isn't then we pass the text over for translation and return the correctly worded response, which is then sent out.

If no translation is needed then the message is sent without the need for translating.

You'll notice that the message type for the translated messages is set to `unicode`. This is so that special characters will be properly handled in the translated replies, but does also shorten the message's overall character count. As a result you may send more SMS to achieve the same result as with `text`, which will increase your costs.

You can find more detail on Nexmo's handling of message types in the article [How Long is a Single SMS body](https://help.nexmo.com/hc/en-us/articles/204076866-How-Long-is-a-Single-SMS-body-), found in our Knowledge Base.

# Conclusion
As you can see from the code, adding translation to this app is actually relatively trivial and doesn't require a huge amount of effort. This means that it could well be worth considering how APIs, like those provided by IBM in this case, can better enhance your overall user experience.

Just by adding this to our little app we've given ourselves the ability to communicate in at least 6 more languages in a manner we couldn't before. How might this change the way you think about your next app build? The world is now your oyster.

# Where next?
A natrual next step for this would be to take it beyond SMS and apply the same principles to other messaging applications. A lot of the groundwork has been done here, so why don't you check out what you can do with our new [Messages API](https://www.nexmo.com/products/messages) and starting using this with input from Facebook Messenger and Viber?
