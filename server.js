import express from 'express';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/StringSession.js';
import { Api } from 'telegram/tl/index.js';

const app = express();
app.use(express.json());

// Health check endpoint for UptimeRobot
app.get('/', (req, res) => res.send('OK'));

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
// Trim any hidden spaces or newline characters from the session string
const sessionString = (process.env.TELEGRAM_SESSION || '').trim();
const stringSession = new StringSession(sessionString);

const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 3,
  timeout: 10000, // 10s socket timeout to avoid long hangs
});

let isConnected = false;

async function initTelegram() {
  try {
    console.log("Connecting to Telegram...");
    await client.connect();
    const authorized = await client.checkAuthorization();
    if (!authorized) {
      console.error("CRITICAL: TELEGRAM_SESSION is invalid or expired!");
    } else {
      console.log("Telegram client authenticated successfully!");
      isConnected = true;
    }
  } catch (err) {
    console.error("Failed to connect to Telegram:", err.message);
  }
}
initTelegram();

app.post('/add-contact', async (req, res) => {
  const { phone, chatId } = req.body;
  if (!phone || !chatId) {
    return res.status(400).json({ error: 'Missing phone or chatId' });
  }

  if (!isConnected) {
    return res.status(500).json({ error: 'Telegram client is not connected. Check server logs.' });
  }

  try {
    console.log(`Importing contact: ${phone}`);
    const result = await client.invoke(
      new Api.contacts.ImportContacts({
        contacts: [
          new Api.InputPhoneContact({
            clientId: BigInt(Math.floor(Math.random() * 1000000000)),
            phone: phone,
            firstName: 'User',
            lastName: '',
          }),
        ],
      })
    );

    const user = result.users[0];
    if (!user) {
      return res.status(400).json({ error: 'User phone number not found on Telegram.' });
    }

    console.log(`Inviting user ID ${user.id} to chat ${chatId}`);
    await client.invoke(
      new Api.channels.InviteToChannel({
        channel: chatId,
        users: [user],
      })
    );

    res.json({ success: true, message: 'User added to group successfully' });
  } catch (err) {
    console.error("Telegram operation error:", err.message);
    res.status(500).json({ error: err.message || 'Telegram operation failed' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
