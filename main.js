const { app, BrowserWindow, Notification, ipcMain, Tray, Menu } = require('electron');
const { Client, GatewayIntentBits } = require('discord.js');
const { autoUpdater } = require('electron-updater');
const path = require('path');

// --- 1. حماية من التدبيل (منع تشغيل نسختين في نفس الوقت) ---
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (win) {
            if (win.isMinimized()) win.restore();
            win.show();
            win.focus();
        }
    });

    // تعريف هوية التطبيق لويندوز
    app.setAppUserModelId("تطبيق ذَكِّرْ");

    let win;
    let tray = null;
    let isQuiting = false;
    let notificationsEnabled = true;

    // --- إعداد التحديثات التلقائية ---
    autoUpdater.autoDownload = true;

    // --- إعداد بوت ديسكورد ---
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    });

    // سحب التوكن من نظام الويندوز (آمن ولا يظهر في الكود)
    const BOT_TOKEN = process.env.DISCORD_TOKEN; 
    const CHANNEL_ID = '1463249781835956254';

    client.on('ready', () => {
        console.log(`تم تسجيل الدخول باسم: ${client.user.tag}`);
    });

    // استقبال رسائل ديسكورد
    client.on('messageCreate', (message) => {
        if (notificationsEnabled && message.channelId === CHANNEL_ID && !message.author.bot) {
            const displayName = message.member ? message.member.displayName : (message.author.globalName || message.author.username);

            // إظهار إشعار الويندوز
            new Notification({
                title: 'تنبيه ذَكِّرْ',
                body: `${displayName}: ${message.content}`,
                icon: path.join(__dirname, 'icon.png')
            }).show();

            // --- 2. ميزة الظهور فوق الألعاب ---
            if (win) {
                win.setAlwaysOnTop(true, 'screen-saver'); // يظهر فوق كل شيء
                win.showInactive(); // يظهره بدون سحب التركيز من اللعبة
                setTimeout(() => win.setAlwaysOnTop(false), 5000); // يعود لوضعه الطبيعي بعد 5 ثواني

                win.webContents.send('discord-notice', {
                    author: displayName,
                    content: message.content
                });
            }
        }
    });

    client.login(BOT_TOKEN);

    // --- إعداد النافذة والخلفية ---
    function createWindow() {
        win = new BrowserWindow({
            width: 1100,
            height: 800,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                webSecurity: false
            },
            autoHideMenuBar: true,
            icon: path.join(__dirname, 'icon.png')
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
        tray = new Tray(path.join(__dirname, 'icon.png'));
        const contextMenu = Menu.buildFromTemplate([
            { label: 'فتح التطبيق', click: () => win.show() },
            { label: 'إغلاق نهائي', click: () => {
                isQuiting = true;
                app.quit();
            }}
        ]);
        tray.setToolTip('تطبيق ذَكِّرْ');
        tray.setContextMenu(contextMenu);
        tray.on('double-click', () => win.show());
    }

    // --- أحداث نظام التحديثات ---
    autoUpdater.on('update-available', () => {
        if (win) win.webContents.send('update_available');
    });

    autoUpdater.on('update-downloaded', () => {
        if (win) win.webContents.send('update_downloaded');
    });

    ipcMain.on('restart_app', () => {
        autoUpdater.quitAndInstall();
    });

    ipcMain.on('update-notify-status', (event, status) => {
        notificationsEnabled = status;
    });

    // تشغيل التطبيق
    app.whenReady().then(() => {
        createWindow();
        createTray();
        autoUpdater.checkForUpdatesAndNotify(); // فحص التحديثات فوراً
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });
}