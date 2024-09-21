// get Script properties
const scriptProperties = PropertiesService.getScriptProperties();
const CHANNEL_TOKEN =
  scriptProperties.getProperty('LINE_CHANNEL_TOKEN') ?? undefined;

// API Endpoint
const LINE_REPLY_API = 'https://api.line.me/v2/bot/message/reply';

function doPost(e) {
  const json = JSON.parse(e.postData.contents);

  // Ref: https://developers.line.biz/ja/reference/messaging-api/#message-event
  const replyToken = json.events[0].replyToken;
  const messageId = json.events[0].message.id;
  const messageType = json.events[0].message.type;
  const messageText = json.events[0].message.text;

  if ( !replyToken || typeof replyToken === 'undefined' ) {
    return;
  }

  // :parrot: Reply

  const option = {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + CHANNEL_TOKEN,
    },
    'method': 'post',
    'payload': JSON.stringify({
      'replyToken': replyToken,
      'messages': [{
        'type': 'text',
        'text': messageText,
      }],
    }),
  };

  // POST message
  UrlFetchApp.fetch(LINE_REPLY_API, option);

  return;
}