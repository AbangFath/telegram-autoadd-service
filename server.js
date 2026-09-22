import express from 'express';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/StringSession.js';
import { Api } from 'telegram/tl/index.js';

const app = express();
app.use(express.json());

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession(process.env.TELEGRAM_SESSION || '');

const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

await client.connect();

app.post('/add-contact', async (req, res) => {
  const { phone, chatId } = req.body;
  if (!phone || !chatId) {
    return res.status(400).json({ error: 'Missing phone or chatId' });
  }

  try {
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
      return res.status(400).json({ error: 'User not found on Telegram' });
    }

    await client.invoke(
      new Api.channels.InviteToChannel({
        channel: chatId,
        users: [user],
      })
    );

    res.json({ success: true, message: 'User added to group successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
