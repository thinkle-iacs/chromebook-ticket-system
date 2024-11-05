

function testMessage () {
  sendCardMessageToGoogleChat(
    "Test Message",
    "A greeting",
    [
      "Testing whether mailto links work or not",
      "Here is some more information",
      `
          <a href="mailto:thinkle@innovationcharter.org">Email Link!</a>
          <b>This text is bold</b>
          <i>This is italics!</i>
      `,
      "<a href='https://www.iacs.mobi'>Here is a normal old link</a>"
    ]
  );
}

/**
 * Sends a rich card message to a Google Chat webhook.
 *
 * @param {string} title - The title of the card.
 * @param {string} subtitle - The subtitle of the card.
 * @param {string[]} sections - An array of strings to include in the card sections.
 */
function sendCardMessageToGoogleChat(title, subtitle, sections, image) {
  console.log('send',title,subtitle,sections)
  // Construct the card payload as per Google Chat webhook requirements
  const payload = {
    "cards": [
      {
        "header": {
          "title": title,
          "subtitle": subtitle,
          "imageUrl" : image,
          "imageStyle" : image && "IMAGE" || undefined          
        },
        "sections": sections.map(sectionText => ({
          "widgets": [
            {
              "textParagraph": {
                "text": sectionText
              }
            }
          ]
        }))
      }
    ]
  };
  
  // Set the options for the POST request
  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload)
  };
  
  try {
    // Send the POST request to the webhook URL
    const response = UrlFetchApp.fetch(ticketChatWebhookUrl, options);
    
    // Optionally, you can log the response for debugging
    Logger.log("Card message sent to Google Chat successfully.");
    Logger.log("Response Code: " + response.getResponseCode());
    Logger.log("Response Body: " + response.getContentText());
    
  } catch (error) {
    // Handle errors gracefully
    Logger.log("Error sending card message to Google Chat: " + error);
  }
}