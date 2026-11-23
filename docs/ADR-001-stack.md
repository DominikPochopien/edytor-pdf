# ADR-001: Stos technologiczny i możliwości MuPDF.js

- Status: przyjęta
- Data: 2026-11-23
- Kontekst: specyfikacja „Edytor PDF w przeglądarce”, Krok 0

## Decyzja

| Obszar                 | Wybór                                                                                    | Wersja               |
| ---------------------- | ---------------------------------------------------------------------------------------- | -------------------- |
| Język                  | TypeScript (strict)                                                                      | 6.0.3                |
| UI                     | React + Vite                                                                             | React 19.3, Vite 8.3 |
| Wygląd                 | Tailwind CSS 4 + Radix UI + lucide-react                                                 | 4.3 / 1.x / 1.78     |
| Silnik PDF             | MuPDF.js (WASM, jednowątkowy) w Web Workerze                                             | 1.28.6               |
| Komunikacja z workerem | Comlink                                                                                  | 4.4.2                |
| Warstwa obiektów       | Fabric.js                                                                                | 7.4                  |
| Stan                   | Zustand                                                                                  | 5.1                  |
| Tłumaczenia            | i18next + react-i18next                                                                  | 27 / 18              |
| PWA                    | vite-plugin-pwa (Workbox)                                                                | 2.0                  |
| Testy                  | Vitest + Playwright                                                                      | 5.1 / 1.65           |
| Jakość                 | ESLint 10 (typescript-eslint strict-type-checked, @eslint-react, react-hooks) + Prettier |                      |

### Odstępstwa od „najnowszej wersji” (świadome)

- **TypeScript 6.0.3 zamiast 7.0.2.** TypeScript 7 (natywny kompilator) jest już wydany, ale
  `typescript-eslint` 8.74 obsługuje tylko `typescript <6.1`. Bez tego nie ma lintu z typami,
  którego wymaga specyfikacja. Przejście na TS 7 będzie możliwe po wydaniu zgodnego `typescript-eslint`.
- **`@eslint-react/eslint-plugin` zamiast `eslint-plugin-react`.** `eslint-plugin-react` 7.37 nie
  wspiera ESLint 10. `@eslint-react` jest jego aktywnie rozwijanym następcą (reguły dla JSX, DOM,
  hooków i wydajności) i wspiera ESLint 10. Reguły hooków daje oficjalny `eslint-plugin-react-hooks` 7.

## Weryfikacja MuPDF.js

Źródła: definicje typów `mupdf/dist/mupdf.d.ts` (1.28.6, dokładne API, które dostajemy),
dokumentacja https://mupdf.readthedocs.io/ oraz spike (`scripts/spike/spike.mjs`, uruchamiany w Node
na arkuszu wygenerowanym przez pdflatex: fonty Type 1 Latin Modern, podzbiory, matematyka).

Legenda: ✅ pełne wsparcie, 🟡 częściowe / wymaga własnego kodu, 🔧 obejście.

### Uruchomienie i bezpieczeństwo

| Wymaganie                                                | Status | Jak                                                                                                                                                                                                                                        |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bez SharedArrayBuffer / wątków                           | ✅     | Paczka npm jest jednowątkowa (brak `pthread`/`SharedArrayBuffer` w `mupdf-wasm.js`). Działa na GitHub Pages bez COOP/COEP.                                                                                                                 |
| Praca w Web Workerze                                     | ✅     | Moduł ES z top-level await → worker typu `module` (Chrome, Edge, Firefox ≥ 114, Safari ≥ 15).                                                                                                                                              |
| Kontrola ładowania WASM (postęp, dowolna ścieżka bazowa) | ✅     | Przed importem ustawiamy `globalThis.$libmupdf_wasm_Module = { wasmBinary }`; plik `.wasm` (10,4 MB, ok. 3,6 MB po kompresji brotli) pobieramy sami przez `fetch` ze strumieniem, więc mamy pasek postępu i działa pod każdym `BASE_PATH`. |
| JavaScript z PDF nigdy się nie wykonuje                  | ✅     | Ta kompilacja nie ma silnika JS: `isJSSupported()` zwraca `false`. Nie wołamy `enableJS()`.                                                                                                                                                |
| Linki                                                    | ✅     | `Page.getLinks()`, `Link.getURI()`, `isExternal()`. Otwieranie po potwierdzeniu robimy w UI.                                                                                                                                               |
| Uszkodzone pliki                                         | ✅     | MuPDF naprawia xref (`wasRepaired()`); wyjątki łapiemy w workerze i tłumaczymy na komunikaty. Worker można zrestartować, jeśli się zawiesi.                                                                                                |
| Hasła                                                    | ✅     | `needsPassword()`, `authenticatePassword()` (sprawdzone na AES-256). Zapis bez hasła: opcja `decrypt`, z hasłem: `encrypt=…`.                                                                                                              |

### Renderowanie i tekst

| Wymaganie                                  | Status | Jak                                                                                                                                   |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Render strony / miniatur                   | ✅     | `Page.toPixmap(matrix, DeviceRGB, alpha, showExtras)` → `getPixels()` → `ImageData` / `ImageBitmap`. Skala = zoom × devicePixelRatio. |
| Warstwa tekstowa (zaznaczanie, kopiowanie) | ✅     | `toStructuredText().asJSON()` lub `walk()` (znaki, quady, font, rozmiar, kolor).                                                      |
| Wyszukiwanie                               | ✅     | `Page.search(needle)` zwraca quady do podświetlenia.                                                                                  |
| Metadane                                   | ✅     | `getMetaData` / `setMetaData` (`info:Title`, `info:Author`…).                                                                         |

### Edycja treści

| Wymaganie                                        | Status | Jak                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dodanie tekstu z polskimi znakami                | ✅     | Sprawdzone dwiema metodami: (A) `addFont(font)` (CID, Identity-H, ToUnicode) + własny content stream; (B) `Text.showString` → `DisplayList` → `setAppearanceFromDisplayList` → spłaszczenie. W obu ekstrakcja zwraca „Zażółć gęślą jaźń – ĄĆĘŁŃÓŚŹŻ ąćęłńóśźż”.                                                                                                                                                                                                            |
| Osadzanie fontów jako podzbiorów                 | ✅     | `PDFDocument.subsetFonts()`; wynik w `pdffonts`: `TQUOUH+NotoSans CID TrueType Identity-H emb sub uni`.                                                                                                                                                                                                                                                                                                                                                                    |
| Rysunki, kształty, obrazy w treści strony        | ✅     | Metoda (B): urządzenie `DisplayListDevice` przyjmuje `fillPath`, `strokePath`, `fillText`, `fillImage`, przezroczystość i tryby mieszania. Jeden mechanizm dla wszystkich obiektów Fabric.js.                                                                                                                                                                                                                                                                              |
| Spłaszczanie tylko naszych obiektów              | 🟡     | `bake()` spłaszcza wszystkie adnotacje naraz. Nasze obiekty wstawiamy więc jako Form XObject (strumień wyglądu) dopisany do treści strony (`q … /Fx Do Q`), a adnotacje użytkownika zostają nietknięte. Do sprawdzenia w etapie 2 testem round-trip.                                                                                                                                                                                                                       |
| Edycja istniejącego tekstu – wykrycie            | ✅     | `StructuredText.walk().onChar` daje znak, pozycję, quad, font (`getName`, `isBold`, `isItalic`, `isSerif`), rozmiar i kolor. JSON daje linie z bbox i fontem.                                                                                                                                                                                                                                                                                                              |
| Edycja istniejącego tekstu – usunięcie oryginału | 🔧     | Brak API „usuń ten operator Tj”. Obejście: redakcja tylko tekstu (`applyRedactions(false, IMAGE_NONE, LINE_ART_NONE, TEXT_REMOVE)`) w obszarze edytowanej linii. **Fizycznie usuwa glify ze strumienia treści** bez czarnych prostokątów i bez naruszania grafiki (sprawdzone: fraza znika z ekstrakcji, reszta akapitu zostaje). Ryzyko: glif sąsiedniej linii nachodzący na obszar też zniknie, więc quady lekko zmniejszamy, a podgląd pokazujemy przed zatwierdzeniem. |
| Edycja istniejącego tekstu – font z LaTeX-a      | 🔧     | Osadzone podzbiory Type 1 z LaTeX-a nie mają mapy Unicode: `encodeCharacter()` zwraca 0 dla każdego znaku (sprawdzone na LMRoman10/12). Takich fontów nie da się użyć do nowego tekstu. Obejście z specyfikacji: dobieramy dołączony font po nazwie i cechach (`LMRoman10-Bold` → Latin Modern Roman Bold, serif/sans/mono, bold/italic) i pokazujemy to w UI.                                                                                                             |

### Adnotacje

| Wymaganie                                  | Status | Jak                                                                                                                                                                                                    |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Zakreślenie / podkreślenie / przekreślenie | ✅     | `createAnnotation("Highlight" / "Underline" / "StrikeOut")` + `setQuadPoints`.                                                                                                                         |
| Notatki i komentarze                       | ✅     | `Text` (ikona notatki) i `FreeText`; `setContents`, `setAuthor`, daty.                                                                                                                                 |
| Pieczątki standardowe                      | ✅     | `Stamp` + `setIcon("Approved" / "Draft" / "Confidential")`. Polskie napisy („Zatwierdzono” itd.) tworzymy własnym wyglądem przez `setAppearanceFromDisplayList`, bo ikony standardowe są po angielsku. |
| Pieczątka z obrazka                        | ✅     | `setStampImage(image)`.                                                                                                                                                                                |
| Lista komentarzy                           | ✅     | `getAnnotations()` na każdej stronie.                                                                                                                                                                  |
| Spłaszczanie przy zapisie                  | ✅     | `bake(true, false)`.                                                                                                                                                                                   |

### Obrazy

| Wymaganie                                | Status | Jak                                                                                                                                                                                                                                                       |
| ---------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wstawianie PNG/JPG                       | ✅     | `new Image(bytes)` + `fillImage` w metodzie (B) albo `addImage`.                                                                                                                                                                                          |
| Wykrycie obrazów na stronie              | ✅     | `StructuredText.walk().onImageBlock(bbox, transform, image)` (opcja `preserve-images`).                                                                                                                                                                   |
| Podmiana / usunięcie istniejącego obrazu | 🟡     | Brak gotowej funkcji. Usunięcie: redakcja `REDACT_IMAGE_REMOVE` w obszarze obrazu. Podmiana: zamiana strumienia XObject w zasobach strony przez API `PDFObject` (`writeRawStream` + słownik) albo usunięcie i wstawienie nowego. Do zrobienia w etapie 7. |
| Eksport strony / obszaru do PNG          | ✅     | `toPixmap` (z macierzą przycięcia) → `asPNG()`.                                                                                                                                                                                                           |

### Redakcja

| Wymaganie                                           | Status | Jak                                                                                                                                         |
| --------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Oznaczanie obszarów i fraz                          | ✅     | `createAnnotation("Redact")` + `setRect` / `addQuadPoint`; frazy z `search`.                                                                |
| Fizyczne usunięcie tekstu, grafiki, pikseli obrazów | ✅     | `applyRedactions(true, REDACT_IMAGE_PIXELS, REDACT_LINE_ART_REMOVE_IF_TOUCHED, REDACT_TEXT_REMOVE)`.                                        |
| Usunięcie metadanych                                | ✅     | `setMetaData` na pustą wartość + usunięcie `/Metadata` (XMP) z katalogu, zapis z `garbage=compact`, żeby stare obiekty nie zostały w pliku. |
| Test „brak usuniętej treści”                        | ✅     | Sprawdzone w spike: po zapisie fraza nie występuje w ekstrakcji.                                                                            |

### Strony i dokument

| Wymaganie                                   | Status | Jak                                                                                |
| ------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| Obracanie                                   | ✅     | `/Rotate` w obiekcie strony (`getObject().put`).                                   |
| Usuwanie / zmiana kolejności / duplikowanie | ✅     | `deletePage`, `rearrangePages` (powtórzony indeks = duplikat).                     |
| Puste strony                                | ✅     | `addPage` + `insertPage`.                                                          |
| Strony z innego PDF-a, łączenie             | ✅     | `graftPage` / `newGraftMap()` (wspólne zasoby).                                    |
| Dzielenie, wyodrębnianie zakresu            | ✅     | Nowy `PDFDocument` + `graftPage` lub kopia + `rearrangePages`.                     |
| Przycinanie (crop box)                      | ✅     | `PDFPage.setPageBox("CropBox", rect)`.                                             |
| Zapis                                       | ✅     | `saveToBuffer("garbage=compact,compress")`. Sprawdzone: `qpdf --check` bez błędów. |
| Kopia dokumentu do zapisu                   | ✅     | `new PDFDocument(clone)` – model niedestrukcyjny nakłada zmiany na kopię.          |

### Cofnij / Ponów

MuPDF ma własny dziennik (`enableJournal`, `undo`, `redo`), ale zgodnie ze specyfikacją historia
jest wzorcem Command w warstwie `application`. Dziennika MuPDF nie używamy, żeby historia nie była
związana z silnikiem.

## Ryzyka i ograniczenia

1. **Rozmiar silnika**: ok. 3,6 MB (brotli) przy pierwszej wizycie. Łagodzimy to ładowaniem
   równolegle z ekranem powitalnym, paskiem postępu i cache service workera. GitHub Pages
   kompresuje `.wasm` gzipem (ok. 4–5 MB transferu).
2. **Edycja istniejącego tekstu** jest „najlepszym wysiłkiem”: działa na poziomie linii i akapitu,
   nie odtwarza kerningu i ligatur oryginału, a dla fontów z LaTeX-a zawsze używa fontu zastępczego.
3. **Firefox**: brak File System Access API, więc zapis przez pobranie pliku. Brak Local Font Access API.
4. **Licencja**: MuPDF.js jest na AGPL-3.0, więc projekt też (plik LICENSE, link do źródeł w aplikacji).

## Wynik spike

```
[pages] 2
[render] 1191x1684
[A text found] true
[B text found] true
[redacted text gone] true
[rest kept] true
qpdf --check: No syntax or stream encoding errors found
TQUOUH+NotoSans   CID TrueType   Identity-H   emb yes  sub yes  uni yes
```

Spike przeszedł, więc stos zostaje zatwierdzony.
