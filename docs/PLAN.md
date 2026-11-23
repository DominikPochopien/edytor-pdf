# Plan projektu „Edytor PDF”

Edytor PDF działający w całości w przeglądarce. Specyfikacja: `docs/SPEC.md`.
Decyzje technologiczne i możliwości silnika: `docs/ADR-001-stack.md`.

## Struktura katalogów

```
src/
  domain/                 czysty TypeScript, bez Reacta i bibliotek PDF
    geometry/             Point, Rect, Matrix, przeliczanie PDF ↔ widok (obrót, zoom)
    document/             DocumentInfo, PageInfo, SearchHit, TextLayer
    objects/              (etap 2+) TextObject, InkStroke, ShapeObject, ImageObject,
                          AnnotationObject, WhiteoutRect, RedactionMark
  application/
    ports/                interfejsy: PdfRenderer, PdfTextExtractor, PdfDocumentWriter,
                          FontProvider, FileAccess, RecentFilesStore, AutosaveStorage
    errors/               AppError i kody błędów (tłumaczone w UI)
    viewer/               logika przeglądarki: zoom, układ stron, wirtualizacja, cache renderów
    commands/             (etap 2) Command, History (Cofnij/Ponów)
    use-cases/            przypadki użycia (otwórz dokument, szukaj, zapisz…)
  infrastructure/
    mupdf/                MupdfEngine (czysta klasa, testowalna w Node) + worker + adapter Comlink
    files/                otwieranie, zapis, File System Access API, pobieranie
    storage/              IndexedDB (ostatnie pliki, autozapis)
    fabric/               (etap 2) adapter warstwy obiektów
  ui/
    app/                  App, układ, skróty klawiszowe
    components/           komponenty React (bez logiki PDF)
    hooks/                hooki łączące UI ze store'em i use-case'ami
    store/                Zustand
    i18n/                 i18next + pl.json
    styles/               Tailwind
tests/
  fixtures/               generator testowych PDF-ów (w kodzie, przez MuPDF)
  integration/            testy round-trip silnika w Node
e2e/                      Playwright (Chromium, Firefox) + smoke pod opublikowanym adresem
docs/                     ADR, PLAN, HOSTING
scripts/                  spike, generowanie licencji
```

## Przepływ danych

```
UI (React) → hooki → use-case (application) → port (interfejs)
                                              ↑ implementuje
                          infrastructure/mupdf/WorkerPdfEngine ──Comlink──▶ Web Worker: MupdfEngine
```

- Wątek UI nie dotyka MuPDF. Renderowanie, ekstrakcja, wyszukiwanie i zapis idą w workerze.
- Bitmapy wracają jako `ImageBitmap` przekazywane bez kopiowania (transfer).
- Silnik WASM pobiera się od razu po starcie, równolegle z ekranem powitalnym, z paskiem postępu.
- Model edycji (od etapu 2): obiekty domeny w punktach PDF, warstwa nad stroną; zapis nakłada
  je na kopię dokumentu w workerze.

## Etapy

1. **Szkielet i przeglądanie** – projekt, lint, testy, worker z MuPDF.js, ekran powitalny
   (otwórz, przeciągnij i upuść, przykładowy plik, ostatnie pliki), hasła, ciągłe przewijanie
   z wirtualizacją, zoom, miniatury, przejście do strony, warstwa tekstowa, wyszukiwanie,
   bezpieczne linki, CSP, workflow GitHub Pages.
2. **Warstwa obiektów** – model obiektów w punktach PDF (`domain/objects`), polecenia i historia
   Cofnij/Ponów (`application/commands`), warstwa Fabric.js za interfejsem `ObjectLayer`
   (zaznaczanie, przesuwanie, uchwyty, obrót), prostokąt jako pierwszy obiekt, panel właściwości,
   kopiuj/wklej/duplikuj/usuń, kolejność warstw, strzałki; zapis: kopia z oryginalnych bajtów +
   Form XObject (`infrastructure/mupdf/documentExporter.ts`), „Zapisz” przez File System Access API,
   „Zapisz jako”, pobieranie, gwiazdka i ostrzeżenie przed zamknięciem karty.
3. Dodawanie tekstu, fonty, whiteout.
4. Rysowanie i kształty.
5. Edycja istniejącego tekstu.
6. Adnotacje.
7. Obrazy.
8. Operacje na stronach, łączenie i dzielenie.
9. Redakcja.
10. PWA i offline, autozapis, odzyskiwanie, drukowanie, motywy, samouczek, „O programie”,
    konfiguracje innych hostingów, dopracowanie UX, README.

Każdy etap kończy się: `npm run lint`, `npm run build`, `npm test` (oraz `npm run test:e2e`)
bez błędów i ostrzeżeń, commitem i opisem do ręcznego sprawdzenia.

## Konwencje

- Nazwy w kodzie po angielsku, teksty interfejsu wyłącznie w `src/ui/i18n/locales/pl.json`.
- Brak `any`, brak magicznych liczb (stałe w `constants.ts` danego modułu).
- Współrzędne domeny: punkty PDF (przestrzeń użytkownika strony, oś Y w górę).
  Współrzędne widoku: piksele CSS po obrocie i zoomie (oś Y w dół).
  Przeliczanie tylko przez `domain/geometry`.
