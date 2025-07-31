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

// Обработчик GET запросов
app.get('/', async (req, res) => {
  try {
    // Получаем данные из query-параметров
    const queryData = req.query;
    const userIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    console.log('GET request from:', userIp, 'data:', queryData);

    // Отправляем данные в Telegram
    await sendToTelegram(userIp, queryData);

    // Отправляем изображение
    const imageBuffer = Buffer.from(LOGO_BASE64, 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', imageBuffer.length);
    res.setHeader('Cache-Control', 'no-cache'); // Отключаем кэширование
    res.status(200).send(imageBuffer);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Функция отправки в Telegram
// @ts-ignore
async function sendToTelegram(ip, data) {
  try {
    const message = `🌐 GET запрос логотипа\n\n` +
                   `🖥️ IP: ${ip}\n` +
                   `📊 Данные: ${JSON.stringify(data, null, 2)}\n` +
                   `🔗 Referer: ${data.ref || 'не указан'}`;

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Ошибка Telegram:', error);
  }
}

export default app;