require('dotenv').config()
const TelegramBot = require('node-telegram-bot-api')
const axios = require('axios')
const moment = require('moment-timezone')
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true })
const storage = {}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id 

  bot.sendMessage(
      chatId,
      'Привет! Выберите опцию из меню ниже:',
      {
        reply_markup: {
          keyboard: [
            ['☀️ Узнать погоду', '⏳ Узнать время'], 
            ['⛔️ Стоп', '🆘 Помощь'], 
          ],
          resize_keyboard: true, 
          one_time_keyboard: false, 
        },
      }
  )
})

bot.on('message', async (msg) => {
  const chatId = msg.chat.id 
  const text = msg.text 

  if (text === '☀️ Узнать погоду') {
    const userData = getUserData(chatId) 
    userData.waitingForCity = true 
    userData.waitingForWeather = true 
    bot.sendMessage(chatId, 'Введите название города для получения погоды или нажмите "Стоп" для отмены:')
  } else if (text === '⏳ Узнать время') {
    const userData = getUserData(chatId) 
    userData.waitingForCity = true 
    userData.waitingForTime = true 
    bot.sendMessage(chatId, 'Введите название города для получения времени или нажмите "Стоп" для отмены:')
  } else if (text === '⛔️ Стоп') {
    bot.sendMessage(chatId, 'Операция остановлена. Выберите новую команду из меню ниже:')
    resetUserData(chatId) 
  } else if (text === '🆘 Помощь') {
    bot.sendMessage(chatId, 'Этот бот помогает узнать погоду и текущее время в любом городе. Выберите команду из меню или напишите /start, чтобы перезапустить меню.')
  } else {
   
    const userData = getUserData(chatId)
    if (userData && userData.waitingForCity) {
      const city = text 
      let messageText = ''
      try {
        if (userData.waitingForWeather) {
          messageText = await getWeatherData(city) 
        } else if (userData.waitingForTime) {
          messageText = await getTimeData(city) 
        }
        bot.sendMessage(chatId, messageText) 
      } catch (error) {
        if (error.response && error.response.status === 404) {
          bot.sendMessage(chatId, 'Город не найден. Пожалуйста, проверьте правильность написания и попробуйте снова.')
        } else {
          bot.sendMessage(chatId, `Извините, произошла ошибка: ${error.message}`)
        }
      }
      resetUserData(chatId) 
      bot.sendMessage(chatId, 'Выберите новую команду из меню ниже:')
    }
  }
})

async function getWeatherData(city) {

  const response = await axios.get(
      `http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&lang=ru&appid=${OPENWEATHERMAP_API_KEY}`
  )
  const weatherData = response.data 
  const temperature = Math.round(weatherData.main.temp - 273.15) 
  return `Погода в ${city}: ${weatherData.weather[0].description}, температура ${temperature}°C.` 
}

async function getTimeData(city) {
  const response = await axios.get(
      `http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&lang=ru&appid=${OPENWEATHERMAP_API_KEY}`
  )
  const timezone = response.data.timezone 
  const time = moment().utcOffset(timezone / 60).format('HH:mm') 
  return `Текущее время в ${city}: ${time}.`
}

function getUserData(chatId) {
  let userData = storage[chatId] 
  if (!userData) {
    userData = {
      waitingForCity: false, 
      waitingForWeather: false, 
      waitingForTime: false, 
    }
    storage[chatId] = userData 
  }
  return userData
}

function resetUserData(chatId) {
  const userData = getUserData(chatId) 
  userData.waitingForCity = false 
  userData.waitingForWeather = false 
  userData.waitingForTime = false 
}
