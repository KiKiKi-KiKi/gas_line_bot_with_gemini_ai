// get Script properties
const scriptProperties = PropertiesService.getScriptProperties();
const CHANNEL_TOKEN =
  scriptProperties.getProperty('LINE_CHANNEL_TOKEN') ?? undefined;

// API Endpoint
const LINE_REPLY_API = 'https://api.line.me/v2/bot/message/reply';
// ref. https://developers.line.biz/ja/reference/messaging-api/#display-a-loading-indicator
const LINE_CHAT_LOADING_API = 'https://api.line.me/v2/bot/chat/loading/start';

function doPost(e) {
  const json = JSON.parse(e.postData.contents);

  // Ref: https://developers.line.biz/ja/reference/messaging-api/#message-event
  const replyToken = json.events[0].replyToken;
  const messageId = json.events[0].message.id;
  const messageType = json.events[0].message.type;
  const messageText = json.events[0].message.text;
  const userID = json.events[0]?.source.userId;

  if ( !replyToken || typeof replyToken === 'undefined' ) {
    return;
  }

  // Show Loading
  if (userID) {
    showLoading({ userID });
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

const showLoading = ({ userID }) => {
  const option = {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + CHANNEL_TOKEN,
    },
    'method': 'post',
    'payload': JSON.stringify({
      'chatId': userID,
      'loadingSeconds': 60,
    }),
  };

  UrlFetchApp.fetch(LINE_CHAT_LOADING_API, option);
};
