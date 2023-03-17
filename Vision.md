# Pokerio

### Opis {opis}

Celem projektu jest stworzenie prostej aplikacji mobilnej do gry w pokera. Aplikacja dostępna będzie dla użytkowników telefonów z systemem operacyjnym Android. Projekt motywowany jest brakiem aplikacji pozwalających grać w pokera z grupą znajomych przy użyciu wirtualnych żetonów, które nie są powiązane z fizyczną walutą. Użytkownicy będą łączyć się ze sobą przez centralny serwer.

### Grupy użytkowników

Grupą docelową są grupy pełnoletnich 2 do 8 graczy z całego świata, które są zainteresowane graniem w pokera.

### Funkcjonalność

- Generowanie nowego pokoju gry
- Dołączanie do pokoju gry
- Zarządzanie pokojem gry
- Rozgrywka (wg standardowych zasad dla pokera „Texas Holdem”), przebieg rundy:
  - Każdy z graczy otrzymuje dwie karty
  - Gracze “mała ciemna” oraz “duża ciemna” wchodzą do gry za ustaloną stawkę (duża ciemna = 2 \* mała ciemna)
  - Kolejni gracze muszą wyrównywać do największej stawki na stole lub ją podbić by grać dalej, lub mogą zrezygnować z gry (jeśli mieli jakieś środki w grze, to pozostają one w grze)
  - Pierwsza tura kończy się, kiedy wszyscy gracze, którzy pozostali w grze, grają za tę samą stawkę
  - Odsłania się trzy karty na stole
  - Gracze mogą wyrównywać, podbijać lub rezygnować z gry (j.w.)
  - Runda kończy się j.w.
  - Później następują jeszcze dwie rundy, przed każdą z nich wykłada się na stół jedną kartę
  - Po ostatniej rundzie ustala się zwycięzcę — zwycięzcą jest gracz, który uzyskał najwyższą rękę (Poker królewski, Poker, Karte, Full, Kolor, Trójka, dwie pary, para, najwyższa karta — brak starszeństwo kolorów), lub ostatni gracz w grze. (Ręka gracza - 5 dowolnie wybranych kart spośród 7 w tej rundzie (5 na stole i 2 karty zawodnika))
  - Zwycięzca otrzymuje wszystkie żetony postawione przez graczy w danej rundzie

### Technologie

- Kotlin + Jetpack Compose
- Typescript + Node.js (express)
- Firebase Cloud Messaging
- Oracle DB

### Narzędzia

- Github (Github Actions, Issues, Pull Requests, Milestones)
- Oracle Cloud Infrastrutcture
- JUnit
- Jetpack Compose testing API
- Jest + Supertest
