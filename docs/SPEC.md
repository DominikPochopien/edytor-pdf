# Edytor PDF w przeglądarce – specyfikacja dla agenta

Zbuduj od zera edytor PDF działający w przeglądarce, podobny w podstawowym zakresie do Adobe Acrobat. Pracujesz jako agent: sam tworzysz pliki, budujesz, uruchamiasz testy i commitujesz.

## Cel i założenia
- Aplikacja jest publicznie dostępna pod linkiem, na start z GitHub Pages. Każda obca osoba otwiera link w przeglądarce i od razu edytuje PDF: bez konta, logowania, instalacji i pobierania czegokolwiek.
- Aplikacja działa w 100% po stronie klienta. Pliki PDF NIGDY nie są wysyłane na żaden serwer. Nie ma backendu, analityki, śledzenia ani zewnętrznych CDN.
- Opcjonalnie można ją zainstalować jako PWA (ikona na pulpicie, własne okno). Po pierwszym otwarciu działa offline.
- Musi dać się łatwo przenieść na inny hosting (Netlify, Cloudflare Pages, własna domena lub serwer). Wynik budowania to zwykłe pliki statyczne.
- Interfejs po polsku, zrozumiały dla osoby nietechnicznej.
- Typowy dokument testowy: polski arkusz maturalny wygenerowany w LaTeX-u (polskie znaki, wzory matematyczne, osadzone podzbiory fontów). Aplikacja musi sobie z takimi plikami radzić.

## Krok 0: technologia (ustalona, nie zmieniaj bez pytania mnie)
- Język: TypeScript w trybie strict.
- Interfejs: React + Vite.
- Wygląd: Tailwind CSS + Radix UI (dostępne komponenty: menu, okna dialogowe, podpowiedzi) + ikony Lucide.
- Silnik PDF: MuPDF.js (WebAssembly), uruchomiony w Web Workerze. Komunikacja z workerem przez Comlink z pełnym typowaniem.
- Warstwa obiektów edycji (tekst, rysunki, kształty, obrazy, uchwyty, zaznaczanie): Fabric.js, nałożony na wyrenderowaną stronę.
- Stan aplikacji: Zustand. Historia Cofnij/Ponów jest oparta na wzorcu Command w warstwie application, nie w komponentach.
- Tłumaczenia: i18next. PWA i offline: vite-plugin-pwa.
- Testy: Vitest (jednostkowe i integracyjne) + Playwright (end-to-end).
- Jakość kodu: ESLint (strict, z regułami dla Reacta i hooków) + Prettier.
- Wszystkie zależności instalowane z npm i dołączane do paczki. Fonty też są w paczce.
- Używaj aktualnych stabilnych wersji.
- Hosting statyczny (GitHub Pages) nie pozwala ustawić nagłówków COOP/COEP, więc aplikacja nie może wymagać SharedArrayBuffer ani wielowątkowego WebAssembly. Użyj jednowątkowej wersji silnika.
- Przed pisaniem właściwego kodu:
  - Sprawdź w dokumentacji MuPDF.js, czy obsługuje wszystko z sekcji Funkcje, szczególnie edycję istniejącego tekstu, redakcję, adnotacje i operacje na stronach. Wynik zapisz w docs/ADR-001-stack.md: co jest wspierane w pełni, co częściowo, a co wymaga obejścia.
  - Zrób mały spike: otwórz PDF, wyrenderuj stronę, dodaj tekst z polskimi znakami, zapisz, otwórz wynik ponownie i wyciągnij tekst. Przejdź dalej dopiero, gdy to działa.

## Architektura (clean code)
Struktura w src/:
- domain/: model dokumentu i obiektów edycji (TextObject, InkStroke, ShapeObject, ImageObject, AnnotationObject, WhiteoutRect, RedactionMark). Współrzędne w punktach PDF. Czysty TypeScript, bez Reacta i bez bibliotek PDF.
- application/: przypadki użycia i polecenia (Command) z Undo/Redo. Tu są też interfejsy: PdfRenderer, PdfDocumentWriter, PdfTextExtractor, FontProvider, FileAccess, AutosaveStorage.
- infrastructure/: adaptery MuPDF.js (w workerze), Fabric.js, dostęp do plików, IndexedDB.
- ui/: komponenty React, hooki i style. Żadnej logiki PDF w komponentach.

Zasady:
- SOLID, małe funkcje i moduły, nazwy w kodzie po angielsku, brak magicznych liczb, brak `any`.
- Lint i build bez błędów i ostrzeżeń.
- Wątek UI nigdy nie może zamarzać: renderowanie i zapis idą w workerze.
- Błędy pokazywane użytkownikowi jako czytelne komunikaty po polsku. Szczegóły tylko w konsoli w trybie deweloperskim.
- Model edycji niedestrukcyjny: zmiany są warstwą obiektów nad oryginałem aż do zapisu. Zapis nakłada zmiany na kopię dokumentu.
- MuPDF.js i Fabric.js są ukryte za interfejsami z warstwy application, żeby dało się je w przyszłości wymienić.

## Funkcje

### Pierwsze uruchomienie (dla obcej osoby)
- Ekran powitalny:
  - duży przycisk "Otwórz PDF" i strefa przeciągnij i upuść,
  - przycisk "Wypróbuj na przykładowym pliku" z dołączonym przykładowym PDF-em,
  - krótka, widoczna informacja: "Twoje pliki nie są nigdzie wysyłane – wszystko dzieje się na Twoim komputerze".
- Ekran ładowania z paskiem postępu, gdy pobiera się silnik PDF.
- Krótki samouczek przy pierwszej wizycie (3–5 podpowiedzi, z możliwością pominięcia i ponownego uruchomienia z menu Pomoc).
- Okno "O programie": wersja, licencja, link do kodu źródłowego, informacja o prywatności, lista licencji użytych bibliotek.
- Przeglądarki:
  - w przeglądarce bez potrzebnych funkcji pokaż po polsku, że najlepiej działa w Chrome lub Edge,
  - Firefox ma działać, z zapisem przez pobranie pliku,
  - na telefonie pokaż informację, że aplikacja jest przeznaczona na komputer; podgląd może działać.

### Pliki
- Otwieranie przez przycisk, przeciągnij i upuść oraz listę ostatnich plików (IndexedDB). Obsługa PDF-ów z hasłem.
- Zapis:
  - w Chrome i Edge przez File System Access API, łącznie z "Zapisz" do tego samego pliku po zgodzie użytkownika,
  - w pozostałych przeglądarkach jako pobranie pliku,
  - "Zapisz jako" zawsze tworzy nowy plik.
- Po instalacji PWA program można ustawić do otwierania plików .pdf przez "Otwórz za pomocą" (File Handling API, gdzie jest dostępne).
- Bezpieczeństwo:
  - JavaScript osadzony w PDF nigdy się nie wykonuje,
  - linki z PDF otwierają się dopiero po potwierdzeniu, z pokazanym adresem,
  - uszkodzony lub złośliwy plik nie może zawiesić aplikacji, tylko pokazać komunikat.

### Przeglądanie
- Ciągłe przewijanie stron, zoom (Ctrl+kółko, dopasuj do szerokości lub strony), panel miniatur, przejście do strony.
- Wirtualizacja: renderowane są tylko widoczne strony, z cache i zwalnianiem pamięci. Ostre renderowanie przy devicePixelRatio > 1.
- Warstwa tekstowa pozwala zaznaczać i kopiować tekst. Wyszukiwanie (Ctrl+F) z podświetleniem wyników.

### Tekst
- Dodawanie pola tekstowego kliknięciem. Ustawienia: font, rozmiar, kolor, pogrubienie, kursywa, podkreślenie, wyrównanie, interlinia, zawijanie w ramce.
- Fonty:
  - dołączony zestaw darmowych fontów z polskimi znakami: Noto Sans, Noto Serif, Roboto, Lato, Open Sans, Latin Modern (do dokumentów z LaTeX-a),
  - wczytanie własnego pliku .ttf lub .otf,
  - opcjonalnie fonty systemowe przez Local Font Access API, gdzie przeglądarka to obsługuje.
- Edycja istniejącego tekstu:
  - kliknięcie w linię lub akapit wykrywa tekst, pozycję, rozmiar, kolor i font,
  - oryginalny fragment jest usuwany z content streamu, jeśli silnik na to pozwala; w przeciwnym razie zostaje zakryty, a aplikacja wyraźnie o tym informuje,
  - nowy tekst trafia w to samo miejsce,
  - jeśli osadzony font jest podzbiorem bez potrzebnych znaków (częste przy LaTeX-u), aplikacja dobiera najbardziej podobny dostępny font i pokazuje to w UI.
- Zmiana fontu, rozmiaru i koloru zaznaczonego tekstu.
- Osadzanie fontów jako podzbiorów. Znaki ąćęłńóśźż i ĄĆĘŁŃÓŚŹŻ muszą zawsze działać.

### Zamalowywanie (whiteout)
- Prostokąt w dowolnym kolorze, domyślnie białym. Pipeta pobiera kolor tła. Na zamalowanym miejscu można potem pisać.
- UI jasno mówi, że whiteout tylko zakrywa, a nie usuwa danych. Do usuwania służy Redakcja.

### Rysowanie i kształty
- Pióro odręczne z wygładzaniem i obsługą tabletu lub rysika (Pointer Events, nacisk), półprzezroczysty zakreślacz, gumka do własnych rysunków.
- Linia, strzałka, prostokąt, elipsa i wielokąt. Ustawienia: obrys, wypełnienie, grubość, przezroczystość, styl linii.
- Shift wymusza prostą linię, kwadrat lub koło.

### Obiekty (wszystko, co dodane)
- Zaznaczanie, przesuwanie, zmiana rozmiaru uchwytami, obracanie, usuwanie i duplikowanie.
- Kopiuj i wklej, także między stronami. Kolejność warstw (na wierzch, na spód).
- Linie przyciągania i wyrównania. Przesuwanie strzałkami (z Shift większy krok).
- Panel właściwości zaznaczonego obiektu.

### Adnotacje (prawdziwe adnotacje PDF, widoczne w innych czytnikach)
- Zakreślenie, podkreślenie i przekreślenie zaznaczonego tekstu.
- Notatki samoprzylepne i komentarze tekstowe.
- Pieczątki: Zatwierdzono, Wersja robocza, Poufne oraz własne z obrazka.
- Panel listy komentarzy z przejściem do miejsca w dokumencie.
- Przy zapisie wybór: zostawić adnotacje edytowalne albo je spłaszczyć.

### Obrazy
- Wstawianie PNG i JPG z pliku, przez przeciągnięcie i ze schowka (Ctrl+V). Skalowanie z zachowaniem proporcji, obracanie, przycinanie.
- Podmiana i usuwanie obrazów, które już są w PDF-ie.
- Eksport strony lub zaznaczonego obszaru do PNG.

### Redakcja (trwałe usuwanie)
- Oznaczanie do redakcji obszarów oraz wyszukanych fraz (wszystkie wystąpienia), z podglądem.
- "Zastosuj redakcję" fizycznie usuwa tekst, grafikę i fragmenty obrazów pod spodem, a opcjonalnie także metadane.
- Przed zastosowaniem pojawia się ostrzeżenie, że operacja jest nieodwracalna. Wynik zapisuje się jako nowy plik.
- Test automatyczny: po redakcji ekstrakcja tekstu NIE może zwrócić usuniętej treści.

### Strony
- Obracanie, usuwanie, duplikowanie i zmiana kolejności przez przeciąganie miniatur.
- Wstawianie pustych stron oraz stron z innego PDF-a.
- Łączenie wielu plików, dzielenie pliku, wyodrębnianie zakresu stron.
- Przycinanie strony (crop box).

### Bezpieczeństwo pracy
- Cofnij i Ponów (Ctrl+Z, Ctrl+Y) dla WSZYSTKICH operacji.
- Skróty Ctrl+S, Ctrl+P, Ctrl+F i Ctrl+O przejmowane od przeglądarki, gdy fokus jest w aplikacji.
- Gwiazdka (*) przy niezapisanych zmianach i ostrzeżenie przed zamknięciem karty (beforeunload).
- Autozapis stanu edycji do IndexedDB (lokalnie w przeglądarce) i propozycja przywrócenia po ponownym otwarciu lub awarii karty.
- Czytelny komunikat, gdy plik jest za duży dla pamięci przeglądarki.
- Drukowanie wyniku oraz edycja metadanych dokumentu (tytuł, autor).

### UI/UX
- Układ: pasek narzędzi u góry, lewy panel (miniatury, komentarze, wyszukiwanie), dokument na środku, prawy panel właściwości.
- Skróty klawiszowe narzędzi: V zaznacz, T tekst, P pióro, H zakreślacz, R prostokąt, E gumka. Lista skrótów pod klawiszem "?".
- Jasny i ciemny motyw (domyślnie według systemu), pasek stanu (strona x/y, zoom), podpowiedzi przy przyciskach.
- Dostępność: obsługa klawiaturą, etykiety ARIA, widoczny fokus.
- Wszystkie teksty interfejsu w plikach tłumaczeń i18next, żeby dało się później dodać inny język.

Poza zakresem wersji 1: formularze, podpis elektroniczny i OCR.

## Publikacja i hosting
- GitHub Pages:
  - automatyczne publikowanie przez GitHub Actions przy każdym pushu na main,
  - przed publikacją workflow uruchamia lint, build i testy; jeśli coś nie przejdzie, nie publikuje,
  - przeprowadź mnie krok po kroku przez jednorazową konfigurację (założenie repozytorium, włączenie Pages, pierwsza publikacja) i podaj mi gotowy link.
- Przenośność na inny hosting:
  - ścieżka bazowa (base) jest ustawiana zmienną środowiskową (np. BASE_PATH), z domyślną wartością dla GitHub Pages (https://<użytkownik>.github.io/<repozytorium>/) i działaniem także w katalogu głównym domeny,
  - worker, WebAssembly, fonty i service worker ładują się poprawnie pod każdą ścieżką,
  - dołącz gotowe pliki konfiguracyjne dla Netlify i Cloudflare Pages (w tym nagłówki bezpieczeństwa i poprawny typ MIME dla .wasm),
  - w docs/HOSTING.md opisz po polsku, jak przenieść aplikację na Netlify, Cloudflare Pages, własną domenę i zwykły serwer (skopiowanie folderu dist).
- Content Security Policy:
  - przez znacznik meta, bo GitHub Pages nie pozwala ustawić nagłówków,
  - connect-src 'self', bez zewnętrznych skryptów, z 'wasm-unsafe-eval' potrzebnym dla WebAssembly i niczym więcej.
- PWA:
  - po wydaniu nowej wersji aplikacja pokazuje po polsku komunikat "Dostępna nowa wersja – odśwież" zamiast cicho podmieniać kod w trakcie pracy,
  - service worker cache'uje wszystkie pliki, w tym WebAssembly i fonty.
- Licencje:
  - MuPDF.js jest na licencji AGPL, więc cały projekt też jest na AGPL-3.0 (plik LICENSE),
  - w aplikacji jest widoczny link do kodu źródłowego,
  - THIRD_PARTY_LICENSES generuje się automatycznie przy budowaniu.

## Jakość i testy
- Vitest: testy jednostkowe dla domain i application (polecenia, undo/redo, geometria, przeliczanie współrzędnych ekran↔PDF z uwzględnieniem obrotu strony i zoomu).
- Testy integracyjne "round-trip" dla każdej funkcji edycji: otwórz, zmień, zapisz, otwórz ponownie i sprawdź efekt (tekst, liczba stron, adnotacje, brak zredagowanej treści).
- Playwright: testy end-to-end najważniejszych scenariuszy (otwórz, dodaj tekst, narysuj, zapisz, cofnij, operacje na stronach, redakcja) w Chromium i Firefoksie.
- Testowe PDF-y generuj w kodzie testów. Potrzebne są pliki z polskimi znakami, z obróconą stroną, z hasłem oraz jeden ok. 300-stronicowy.
- Zapisane pliki muszą mieć poprawną strukturę. Sprawdzaj je np. przez qpdf --check, jeśli jest dostępny.
- Wydajność:
  - przy pliku 300-stronicowym pierwsza strona pokazuje się w mniej niż 2 s, a przewijanie jest płynne,
  - pierwsze załadowanie aplikacji jest jak najlżejsze: podział kodu, silnik PDF ładowany równolegle z ekranem powitalnym.
- Po publikacji: test Playwright pod docelowym adresem (otwarcie, edycja, zapis i działanie offline po ponownym załadowaniu).

## Sposób pracy
1. Przeczytaj ten dokument, wykonaj Krok 0, a potem zapisz plan i strukturę projektu w docs/PLAN.md.
2. Pracuj etapami. Każdy etap kończy się działającą aplikacją, zielonymi testami i commitem:
   1. Szkielet projektu, worker z MuPDF.js, ekran powitalny, otwieranie, przeglądanie, zoom, miniatury; od razu workflow GitHub Pages, żebym miał działający link
   2. Warstwa obiektów (Fabric.js), zaznaczanie i przesuwanie, undo/redo, zapis i pobieranie
   3. Dodawanie tekstu, fonty, whiteout
   4. Rysowanie i kształty
   5. Edycja istniejącego tekstu
   6. Adnotacje
   7. Obrazy
   8. Operacje na stronach, łączenie i dzielenie
   9. Redakcja
   10. PWA i offline, autozapis, odzyskiwanie, drukowanie, motywy, samouczek, okno "O programie", konfiguracje innych hostingów, dopracowanie UX
3. Po każdym etapie:
   - `npm run lint`, `npm run build` i `npm test` mają przejść bez błędów i ostrzeżeń,
   - napisz krótko, co działa, a co nie i jak to przetestować ręcznie pod opublikowanym linkiem,
   - zatrzymaj się i poczekaj na moje "dalej".
4. Jeśli czegoś nie da się zrobić w wybranej bibliotece albo w danej przeglądarce, nie udawaj, że działa. Opisz ograniczenie i zaproponuj obejście.
5. Na koniec napisz README.md po polsku, prostym językiem:
   - na górze link do aplikacji i jedno zdanie o prywatności,
   - "Jak używać" w najwyżej 3 krokach: otwórz link → przeciągnij PDF → zapisz,
   - "Jak zainstalować jako aplikację (opcjonalnie)" z opisem, gdzie kliknąć w Chrome i Edge,
   - lista funkcji i skrótów, wspierane przeglądarki, znane ograniczenia,
   - osobna sekcja dla programistów: uruchomienie lokalne, architektura, testy, link do docs/HOSTING.md.