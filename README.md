# Edytor PDF

**Aplikacja:** https://dominikpochopien.github.io/edytor-pdf/

Twoje pliki nie są nigdzie wysyłane – wszystko dzieje się w przeglądarce na Twoim komputerze.

> Projekt w budowie – etap 2 z 10 (przeglądanie, warstwa obiektów, Cofnij/Ponów, zapis). Pełna instrukcja pojawi się po ostatnim etapie.

## Jak używać

1. Otwórz link powyżej.
2. Kliknij „Otwórz PDF” albo przeciągnij plik PDF do okna.
3. Edytuj i zapisz (Ctrl+S). W Chrome i Edge plik zapisuje się bezpośrednio na dysku, w innych przeglądarkach – jako pobrany plik.

## Dla programistów

Wymagany Node.js 22 lub nowszy.

```bash
npm install
npm run dev        # serwer deweloperski
npm run lint       # ESLint + Prettier
npm run build      # wynik w folderze dist/
npm test           # Vitest: testy jednostkowe i integracyjne (MuPDF w Node.js)
npx playwright install chromium firefox
npm run test:e2e   # Playwright: Chromium i Firefox na zbudowanej aplikacji
```

Ścieżkę bazową ustawia zmienna `BASE_PATH` (domyślnie `/edytor-pdf/`, w katalogu głównym
domeny: `BASE_PATH=/`).

- Architektura i plan: [docs/PLAN.md](docs/PLAN.md)
- Decyzje technologiczne i możliwości MuPDF.js: [docs/ADR-001-stack.md](docs/ADR-001-stack.md)
- Specyfikacja: [docs/SPEC.md](docs/SPEC.md)

## Licencja

GNU AGPL-3.0 (plik [LICENSE](LICENSE)), ponieważ silnik MuPDF.js jest na tej licencji.
Licencje użytych bibliotek: plik `THIRD_PARTY_LICENSES.txt` generowany przy budowaniu.
