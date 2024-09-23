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

// Get nearest stations API
// ref. https://express.heartrails.com/api.html
const GET_STATIONS_API =
  "https://express.heartrails.com/api/json?method=getStations";

// ------------------------------
// Webhook Endpoint
// ------------------------------
async function doPost(e) {
  const json = JSON.parse(e.postData.contents);

  // Ref: https://developers.line.biz/ja/reference/messaging-api/#message-event
  const replyToken = json.events[0].replyToken;
  const messageId = json.events[0].message.id;
  const messageType = json.events[0].message.type;
  const messageText = json.events[0].message.text;
  const userID = json.events[0]?.source.userId;

  // Get user's location
  // WARNING: location data become `undefined` when type is not `location`
  const longitude = json.events[0]?.message.longitude;
  const latitude = json.events[0]?.message.latitude;
  const address = json.events[0]?.message.address;

  if (!replyToken || typeof replyToken === "undefined") {
    return;
  }

  // Show Loading
  if (userID) {
    showLoading({ userID });
  }

  const relyMessages = await getReplyText({
    messageText,
    position: {
      longitude,
      latitude,
      address,
    },
    isLocation: messageType === "location",
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
      messages: [...relyMessages],
    }),
  };

  // POST message
  try {
    UrlFetchApp.fetch(LINE_REPLY_API, option);
    return;
  } catch (error) {
    console.log(error);
    return "error";
  }
}

// ------------------------------
// Show loading placeholder
// ------------------------------
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

// ------------------------------
// Get Reply Text
// ------------------------------
const getReplyText = async ({ messageText, position, isLocation }) => {
  // Search Station
  if (isLocation) {
    const { longitude, latitude, address } = position;

    const stations = await getStations({ longitude, latitude });
    const stationsMessage = formatStations(stations);

    // cf. https://developers.line.biz/ja/docs/messaging-api/flex-message-elements/
    return [
      {
        type: "flex",
        altText: "最寄り駅一覧",
        contents: {
          type: "bubble",
          direction: "ltr",
          header: {
            type: "box",
            layout: "vertical",
            backgroundColor: "#a1cdcf",
            contents: [
              {
                type: "text",
                text: "現在地からの置最寄駅一覧",
                align: "center",
                weight: "bold",
              },
              {
                type: "text",
                text: "駅名をクリックでGoogleMap",
                size: "sm",
                align: "center",
              },
            ],
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [...stationsMessage],
          },
        },
        text: JSON.stringify(stations),
      },
    ];
  }

  // Ask Gemini
  const answerText = await askGemini({
    prompt: messageText,
  });

  return [
    {
      type: "text",
      text: answerText,
    },
  ];
};

// ------------------------------
// ASK Gemini
// ------------------------------
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

  try {
    const res = UrlFetchApp.fetch(GEMINI_API, options);
    const json = JSON.parse(res.getContentText());
    // console.log(json.candidates[0].content.parts);
    const text = json.candidates[0].content.parts[0].text;

    return text ?? "回答できませんでした";
  } catch (error) {
    console.log(`askGemini`, error);
    return "回答できませんでした";
  }
};

// ------------------------------
// Get Nearest stations
// ------------------------------
const getStations = async ({ longitude, latitude }) => {
  const API = `${GET_STATIONS_API}&x=${longitude}&y=${latitude}`;

  try {
    const res = UrlFetchApp.fetch(API);
    const json = JSON.parse(res.getContentText());

    return json?.response.station ?? undefined;
  } catch (error) {
    console.log(`getStations`, error);
    return undefined;
  }
};

const formatStations = (stations = []) => {
  if (stations.length < 1) {
    return [
      {
        type: "text",
        text: "該当する最寄り駅を取得できませんでした",
      },
    ];
  }

  return stations.map((item) => {
    const { name, line, distance } = item;
    const stationName = `${name}駅 (${line})`;
    const encodeName = encodeURI(`${name}駅 ${line}`);
    const url = `https://maps.google.co.jp/maps?q=${encodeName}`;

    return {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: `${distance} 先`,
        },
        {
          type: "button",
          style: "link",
          action: {
            type: "uri",
            label: stationName,
            uri: url,
          },
        },
      ],
    };
  });
};
