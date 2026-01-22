Address Search (ArcGIS) – Frontend
 Описание
Уеб страница за търсене на адреси с:
- подсказки при писане (autocomplete)
- списък с намерени резултати
- бутон „Отвори в Maps“

Използва ArcGIS World Geocoding Service (suggest + findAddressCandidates).

 Файлове
- index.html
- styles.css
- app.js

Стартиране
Вариант 1: VS Code + Live Server (препоръчително)
1) Отвори папката с проекта във VS Code
2) Отвори index.html
3) Натисни “Go Live” (Live Server)

Вариант 2: Локален HTTP сървър (Python)
В папката с файловете:
python -m http.server 5500
Отвори:
http://localhost:5500/index.html

Тестване
1) Въведи "Sofia" (или "Plovdiv") в полето „Адрес“
2) Избери подсказка
3) Виж резултатите и използвай „Отвори в Maps“

Използвани заявки (endpoints)
- Suggest: https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest
- Find candidates: https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates
