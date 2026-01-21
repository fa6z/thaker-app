// 1. تحميل المكتبات المطلوبة
require('dotenv').config();
const { app, BrowserWindow, Notification, ipcMain, Tray, Menu } = require('electron');
const { Client, GatewayIntentBits } = require('discord.js');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// 2. إعدادات التطبيق
app.setAppUserModelId("تطبيق ذَكِّرْ");
let win;
let tray = null;
let isQuiting = false;
let notificationsEnabled = true;

// إعدادات التحديث التلقائي
autoUpdater.autoDownload = true;

// 3. إعداد بوت ديسكورد
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

// التحقق من التوكن
if (!BOT_TOKEN) {
    console.log("❌ خطأ: لم يتم العثور على DISCORD_BOT_TOKEN في ملف .env");
} else {
    client.login(BOT_TOKEN).catch(err => console.error("❌ فشل دخول البوت:", err.message));
}

client.on('ready', () => {
    console.log(`✅ البوت جاهز باسم: ${client.user.tag}`);
});

// 4. استقبال الرسائل من ديسكورد وتحويلها لإشعارات
client.on('messageCreate', (message) => {
    if (notificationsEnabled && message.channelId === CHANNEL_ID && !message.author.bot) {
        const displayName = message.member ? message.member.displayName : (message.author.globalName || message.author.username);
        
        const iconPath = path.join(__dirname, 'icon.png');
        const notificationOptions = {
            title: 'تنبيه جديد',
            body: `${displayName}: ${message.content}`
        };
        
        // إضافة الأيقونة فقط إذا كانت موجودة لتجنب الأخطاء
        if (fs.existsSync(iconPath)) {
            notificationOptions.icon = iconPath;
        }

        new Notification(notificationOptions).show();

        if (win) {
            win.webContents.send('discord-notice', { author: displayName, content: message.content });
        }
    }
});

// 5. وظائف النافذة والـ Tray
function createWindow() {
    win = new BrowserWindow({
        width: 1100,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        },
        autoHideMenuBar: true
    });

    win.loadFile('index.html');

    win.on('close', (event) => {
        if (!isQuiting) {
            event.preventDefault();
            win.hide();
        }
    });
}

function createTray() {
    const iconPath = path.join(__dirname, 'icon.png');
    
    // التحقق من وجود الأيقونة قبل إنشاء الـ Tray
    if (!fs.existsSync(iconPath)) {
        console.log("⚠️ تحذير: ملف icon.png غير موجود، لن يتم إنشاء أيقونة بجانب الساعة.");
        return;
    }

    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
        { label: 'فتح التطبيق', click: () => win.show() },
        { label: 'إغلاق نهائي', click: () => { isQuiting = true; app.quit(); } }
    ]);
    tray.setToolTip('تطبيق ذَكِّرْ');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => win.show());
}

// 6. نظام التحديثات (التلقائي واليدوي)
ipcMain.on('check-for-updates', () => {
    console.log("🔍 جاري التحقق من التحديثات يدوياً...");
    autoUpdater.checkForUpdatesAndNotify();
});

autoUpdater.on('update-available', () => {
    if (win) win.webContents.send('update_available');
});

autoUpdater.on('update-not-available', () => {
    if (win) win.webContents.send('update_not_available');
});

autoUpdater.on('update-downloaded', () => {
    if (win) win.webContents.send('update_downloaded');
});

ipcMain.on('restart_app', () => {
    autoUpdater.quitAndInstall();
});

// 7. تشغيل التطبيق
app.whenReady().then(() => {
    createWindow();
    createTray();
    autoUpdater.checkForUpdatesAndNotify(); // فحص تلقائي عند التشغيل
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('update-notify-status', (event, status) => {
    notificationsEnabled = status;
});
