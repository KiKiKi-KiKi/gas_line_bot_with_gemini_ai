// get Script properties
const scriptProperties = PropertiesService.getScriptProperties();
const CHANNEL_TOKEN =
  scriptProperties.getProperty("LINE_CHANNEL_TOKEN") ?? undefined;
const GEMINI_API_KEY =
  scriptProperties.getProperty("GEMINI_API_KEY") ?? undefined;

// API Endpoint
const LINE_REPLY_API = "https://api.line.me/v2/bot/message/reply";
// ref. https://developers.line.biz/ja/reference/messaging-api/#display-a-loading-indicator
const LINE_CHAT_LOADING_API = "https://api.line.me/v2/bot/chat/loading/start";

// Gemini API
const GEMINI_API = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

async function doPost(e) {
  const json = JSON.parse(e.postData.contents);

  // Ref: https://developers.line.biz/ja/reference/messaging-api/#message-event
  const replyToken = json.events[0].replyToken;
  const messageId = json.events[0].message.id;
  const messageType = json.events[0].message.type;
  const messageText = json.events[0].message.text;
  const userID = json.events[0]?.source.userId;

  if (!replyToken || typeof replyToken === "undefined") {
    return;
  }

  // Show Loading
  if (userID) {
    showLoading({ userID });
  }

  // Ask Gemini
  const answerText = await askGemini({
    prompt: messageText,
  });

  // Reply
  const option = {
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      Authorization: "Bearer " + CHANNEL_TOKEN,
    },
    method: "post",
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [
        {
          type: "text",
          text: answerText,
        },
      ],
    }),
  };

  // POST message
  UrlFetchApp.fetch(LINE_REPLY_API, option);

  return;
}

const showLoading = ({ userID }) => {
  const option = {
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      Authorization: "Bearer " + CHANNEL_TOKEN,
    },
    method: "post",
    payload: JSON.stringify({
      chatId: userID,
      loadingSeconds: 60,
    }),
  };

  UrlFetchApp.fetch(LINE_CHAT_LOADING_API, option);
};

const askGemini = async ({ prompt }) => {
  if (!prompt || prompt.length < 3) {
    return "回答できませんでした";
  }

  const options = {
    headers: {
      "Content-Type": "application/json",
    },
    method: "post",
    payload: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `次の質問に140文字以内で回答してください。
                質問: ${prompt}`,
            },
          ],
        },
      ],
    }),
  };

  const res = UrlFetchApp.fetch(GEMINI_API, options);
  const json = JSON.parse(res.getContentText());
  // console.log(json.candidates[0].content.parts);
  const text = json.candidates[0].content.parts[0].text;

  return text ?? "回答できませんでした";
};
