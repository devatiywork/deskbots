# Интерфейс DeskBots: архитектура

Две страницы, которые открывает приложение (Tauri):

- **wallpaper** — офис на обоях: пиксельная сцена на canvas и панель справа;
- **settings** — окно настроек.

Стек: Vite, React 18, TypeScript, SCSS-модули. Код разложен по слоям
[Feature-Sliced Design](https://feature-sliced.design): верхний слой может брать из нижних, наоборот нельзя.

```
src/
  app/        точки входа (entries/*.tsx) и глобальные стили
  pages/      страницы: wallpaper, settings
  widgets/    крупные блоки: сцена офиса, панель на обоях, вкладки настроек
  features/   действия и сценки: пицца, визит Grand Ermii, смена вывески, реакции на хуки…
  entities/   сущности: агент, человек, машина, кот, окружение (время, сезон, погода), мир сцены, настройки
  shared/     без предметной логики: связь с Tauri, тексты, пиксельное рисование и шрифт, звук, UI-кит
```

## Тексты

Все тексты — подписи, реплики агентов, диалоги, фразы сценок — лежат в `src/shared/i18n/ru/*.json`.
В коде только ключи. Подстановка параметров: `fill('Привет, {name}!', { name })`.
Новые реплики и диалоги добавляются правкой JSON, без изменения кода.

## Сцена офиса (обои)

Сцена — не React-компоненты, а движок на TypeScript: 30 кадров в секунду на canvas, пиксель-арт.
React отвечает за оболочку (canvas, панель, связь с приложением), движок — за симуляцию и рисование.

- Логика считается в клетках 384×216, рисуется в буфер вдвое точнее (768×432, «мелкие пиксели»),
  буфер растягивается на экран без сглаживания.
- `entities/world` — общее состояние сцены: агенты, гости, машины, очередь отложенных действий (`later`),
  шина событий (`bus`), реестр сценок (`scenes`), данные от сервера.
- Сценки (`features/scene-*`) регистрируются в реестре: у каждой `step(dt, t)`, `draw(t)` и признак «идёт».
  Пока идёт одна большая сценка, другие не начинаются.
- Связь между фичами — только через шину: например, `push` от хука → руководство Grand Ermii хвалит.
- `widgets/office-scene` собирает кадр: фон, мебель, агенты по глубине, погода, подписи, вывод на экран.

## Карта слайсов

| Слой | Слайсы |
|---|---|
| pages | `wallpaper` (сцена + панель + мост к приложению: настройки, мышь, звук), `settings` |
| widgets | `office-scene` (движок кадра, фон и декор в `lib/`, звуки фона, вывод, настройки сцены), `office-panel` (панель на обоях), `settings-nav`, `settings-sections` |
| features | жизнь в офисе: `agent-life` (приезд и уход, перерывы, кофейня, чай, диалоги, брифинг, распорядок, стажёры), `office-cat`; сценки: `scene-gulls`, `scene-pizza`, `scene-inspection`, `scene-outage`, `scene-typhoon`, `scene-tiger`, `scene-icebreaker`, `scene-fireworks`, `scene-vacuum` (робот-пылесос), `scene-client-call` (звонок клиента), `scene-coffee-broken` (поломка кофемашины), `scene-birthday` (день рождения с тортом), `scene-ermii` (визит руководства), `scene-sign` (новая вывеска); `hook-fx` (реакции на хуки, конфетти, кубки, игра и созвон); `office-data` (опрос, демо, реальная погода), `focus-agent`; настройки: `edit-sign`, `pick-monitors`, `pick-place`, `manage-hooks`, `call-ermii` |
| entities | `world` (планировка, мир сцены), `environment`, `agent` (модель и рисунок), `person` (гости и руководство), `car`, `settings`, `office`, `trophy` |
| shared | `api` (Tauri), `i18n/ru/*.json` (все тексты), `lib/pixel` (холст, шрифт, слои, рамка), `audio`, `ui` (поля настроек), `styles`, `config` |

Тексты по файлам: `lines.json` — реплики агентов, `dialogs.json` — диалоги, разговоры в кофейне, брифинг, `scenes.json` и `scenes2.json` — сценки,
`ermii.json` — Grand Ermii, `sign.json`, `hookfx.json`, `cat.json`, `panel.json`, `scene.json` (билборд и табло), `settings.json` — окно настроек.

## Связь с приложением

`shared/api/tauri.ts`: команды (`get_settings`, `set_settings`, `state`, `screen`, …) и события
(`settings`, `screen`, `desk`, `visit`). Вне приложения (в браузере) страница обоев работает в демо-режиме
(`#demo` в адресе): ненастоящие агенты, без сервера.

## Отладочные флаги в адресе обоев

`#demo` — демо-агенты; `fast` — всё чаще; `visit`, `pizza`, `inspect`, `outage`, `gull`, `brief`, `vacuum`, `client`, `coffee`, `birthday` — сценка сразу;
`night`/`dusk`/`day`, `spring`…`winter`, `clear`…`wind`, `typhoon` — время и погода; `limo` — ChatGPT на лимузине.
Флаги склеиваются через дефис: `#demo-visit-fast`.
