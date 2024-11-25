// Загружаем переменные окружения из .env файла для хранения конфиденциальных данных (например, API-ключей)
require('dotenv').config()

// Подключаем библиотеку для работы с Telegram Bot API
const TelegramBot = require('node-telegram-bot-api')

// Подключаем библиотеку axios для выполнения HTTP-запросов
const axios = require('axios')

// Подключаем библиотеку moment-timezone для работы с часовыми поясами
const moment = require('moment-timezone')

// Получаем токен бота из .env файла
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

// Получаем API-ключ OpenWeatherMap из .env файла
const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY

// Создаем экземпляр бота, включаем режим опроса обновлений
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true })

// Хранилище для временных данных пользователей
const storage = {}

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id // Получаем идентификатор чата

  // Отправляем сообщение с приветствием и меню кнопок
  bot.sendMessage(
      chatId,
      'Привет! Выберите опцию из меню ниже:',
      {
        reply_markup: {
          keyboard: [
            ['☀️ Узнать погоду', '⏳ Узнать время'], // Кнопки для выбора опций
            ['⛔️ Стоп', '🆘 Помощь'], // Кнопки для отмены и помощи
          ],
          resize_keyboard: true, // Кнопки адаптируются под размер экрана
          one_time_keyboard: false, // Меню остается активным после использования кнопки
        },
      }
  )
})

// Обработка входящих сообщений
bot.on('message', async (msg) => {
  const chatId = msg.chat.id // Идентификатор чата
  const text = msg.text // Текст сообщения от пользователя

  // Обработка нажатия кнопок
  if (text === '☀️ Узнать погоду') {
    const userData = getUserData(chatId) // Получаем данные пользователя
    userData.waitingForCity = true // Ожидаем ввода города
    userData.waitingForWeather = true // Ожидаем запрос погоды
    bot.sendMessage(chatId, 'Введите название города для получения погоды или нажмите "Стоп" для отмены:')
  } else if (text === '⏳ Узнать время') {
    const userData = getUserData(chatId) // Получаем данные пользователя
    userData.waitingForCity = true // Ожидаем ввода города
    userData.waitingForTime = true // Ожидаем запрос времени
    bot.sendMessage(chatId, 'Введите название города для получения времени или нажмите "Стоп" для отмены:')
  } else if (text === '⛔️ Стоп') {
    bot.sendMessage(chatId, 'Операция остановлена. Выберите новую команду из меню ниже:')
    resetUserData(chatId) // Сбрасываем состояние пользователя
  } else if (text === '🆘 Помощь') {
    bot.sendMessage(chatId, 'Этот бот помогает узнать погоду и текущее время в любом городе. Выберите команду из меню или напишите /start, чтобы перезапустить меню.')
  } else {
    // Если введено имя города
    const userData = getUserData(chatId)
    if (userData && userData.waitingForCity) {
      const city = text // Город, введенный пользователем
      let messageText = ''
      try {
        if (userData.waitingForWeather) {
          messageText = await getWeatherData(city) // Получаем данные о погоде
        } else if (userData.waitingForTime) {
          messageText = await getTimeData(city) // Получаем данные о времени
        }
        bot.sendMessage(chatId, messageText) // Отправляем результат пользователю
      } catch (error) {
        if (error.response && error.response.status === 404) {
          bot.sendMessage(chatId, 'Город не найден. Пожалуйста, проверьте правильность написания и попробуйте снова.')
        } else {
          bot.sendMessage(chatId, `Извините, произошла ошибка: ${error.message}`)
        }
      }
      resetUserData(chatId) // Сбрасываем состояние пользователя
      bot.sendMessage(chatId, 'Выберите новую команду из меню ниже:')
    }
  }
})

// Функция для получения данных о погоде
async function getWeatherData(city) {
  // Запрос к OpenWeatherMap API
  const response = await axios.get(
      `http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&lang=ru&appid=${OPENWEATHERMAP_API_KEY}`
  )
  const weatherData = response.data // Получаем данные из ответа API
  const temperature = Math.round(weatherData.main.temp - 273.15) // Конвертируем температуру из Кельвинов в Цельсии
  return `Погода в ${city}: ${weatherData.weather[0].description}, температура ${temperature}°C.` // Формируем текст для пользователя
}

// Функция для получения текущего времени
async function getTimeData(city) {
  // Используем данные OpenWeatherMap для получения временной зоны
  const response = await axios.get(
      `http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&lang=ru&appid=${OPENWEATHERMAP_API_KEY}`
  )
  const timezone = response.data.timezone // Получаем временную зону
  const time = moment().utcOffset(timezone / 60).format('HH:mm') // Рассчитываем время в формате HH:mm
  return `Текущее время в ${city}: ${time}.`
}

// Функция для получения данных пользователя
function getUserData(chatId) {
  let userData = storage[chatId] // Проверяем, есть ли данные пользователя в хранилище
  if (!userData) {
    userData = {
      waitingForCity: false, // Ожидание ввода города
      waitingForWeather: false, // Запрос на получение погоды
      waitingForTime: false, // Запрос на получение времени
    }
    storage[chatId] = userData // Инициализируем данные для нового пользователя
  }
  return userData
}

// Функция для сброса данных пользователя
function resetUserData(chatId) {
  const userData = getUserData(chatId) // Получаем данные пользователя
  userData.waitingForCity = false // Сбрасываем ожидание города
  userData.waitingForWeather = false // Сбрасываем ожидание погоды
  userData.waitingForTime = false // Сбрасываем ожидание времени
}