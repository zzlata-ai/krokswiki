---
name: Добавление пользователя в операционную систему роутера KROKS
description: В этой статье описаны необходимые действия регистрации нового пользователя в операционной системе роутера KROKS и его настройки.
---
# Добавление пользователя в операционную систему роутера Крокс

## ***Обновляем репозитории, устанавливаем пакет shadow-useradd, добавляем пользователя***

```bash
opkg update
opkg install shadow-useradd
useradd andrey
```

## ***Указываем пароль пользователя, создаем домашний каталог, редактируем права доступа***

```bash
passwd andrey
mkdir /home
mkdir /home/andrey
chown andrey /home/andrey
```

## ***Добавляем оболочку /bin/ash для пользователя andrey***

```bash
nano /etc/passwd
andrey:x:1000:1000:andrey:/home/andrey:/bin/ash 
```

## ***Проверяем. Работает***

![Система роутера](uploads/5d6e4566-02ec-48bb-b117-12304ce8bfc0/c27e006b-e58a-442a-b515-9497e8b3e5a0/7bee863d-5de6-426d-800d-6895634ae6eb.jpg)
