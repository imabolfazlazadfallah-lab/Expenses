/* Root-scoped service worker for PWA push notifications. */
self.addEventListener("install", event => {
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("push", event => {
    let payload = {
        title: "یادآوری مدیریت هزینه",
        body: "اگر امروز هزینه‌ای داشتی، ثبتش کن تا گزارش‌هایت دقیق بماند.",
        url: "/"
    };

    if (event.data) {
        try {
            payload = { ...payload, ...event.data.json() };
        } catch (_) {
            payload.body = event.data.text() || payload.body;
        }
    }

    event.waitUntil(self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/static/icons/icon-192.png",
        badge: "/static/icons/icon-192.png",
        tag: payload.tag || "daily-expense-reminder",
        renotify: false,
        data: { url: payload.url || "/" },
        dir: "rtl",
        lang: "fa"
    }));
});

self.addEventListener("notificationclick", event => {
    event.notification.close();
    const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of windows) {
            if (new URL(client.url).origin === self.location.origin && "focus" in client) {
                await client.focus();
                if ("navigate" in client && client.url !== targetUrl) await client.navigate(targetUrl);
                return;
            }
        }
        if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
    })());
});
