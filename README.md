# Sluneční soustava v Sobětuchách

Záměr terénního modelu sluneční soustavy v obci Sobětuchy. Slunce má stát v obci a planety po okolních cestách, ve stejném měřítku pro velikost i vzdálenost (1 : 1 miliarda, Neptun 4,5 km od Slunce).

**Web:** GitHub Pages ze složky [`docs/`](docs/)

- `docs/index.html`: popis záměru, fotky existujících modelů, náhled mapy
- `docs/map.html`: mapová aplikace pro návrh rozmístění (MapLibre GL v5). Umožňuje přesunout Slunce, nastavit měřítko a zapínat tělesa. Kružnice drah jsou geodetické na elipsoidu WGS84.
- `podklady/reserse-modely-v-terenu.md`: rešerše existujících modelů

## Lokální spuštění

```bash
python -m http.server 8765 -d docs
```

Pak otevřete http://localhost:8765/.

## Licence

Kód je pod licencí MIT (viz [LICENSE](LICENSE)). Fotografie v `docs/img/models/` pocházejí z Wikimedia Commons a platí pro ně licence uvedené u každé fotky na webu. Mapové podklady: © Seznam.cz a.s. a další (Mapy.com), data © přispěvatelé OpenStreetMap.
